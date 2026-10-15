import { z } from 'zod';
import { CaptureAttachment } from '../../domain/pre-registration/capture.attachment.entity.ts';
import { type PreRegistration } from '../../domain/pre-registration/pre.registration.entity.ts';
import { CaptureReceipt } from '../../domain/pre-registration/capture.receipt.entity.ts';
import { fillMissingFromCapture } from '../../domain/pre-registration/fill.missing.from.capture.ts';
import { type CaptureDraft } from '../../domain/capture/capture.draft.ts';
import { PresetIdGenerator } from '../shared/preset.id.generator.ts';
import { CreatePreRegistrationUseCase as CreatePreRegistrationOnDatabase } from '../pre-registration/create.pre.registration.use.case.ts';
import { type CaptureResult } from './capture.result.ts';
import { resolveAccountHint } from '../../domain/capture/resolve.account.hint.ts';
import { type Database } from '../shared/database.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type Clock } from '../shared/clock.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { matchWalletContent } from '../../domain/capture/match.wallet.content.ts';
import { type WalletContentCandidate } from '../../domain/capture/wallet.content.candidate.ts';
import { createPreRegistrationFromCaptureInputSchema } from './create.pre.registration.from.capture.input.schema.ts';

/** Anexo como chega na fronteira. */
type AttachmentInput = {
  readonly kind: CaptureAttachment['kind'];
  readonly mimeType?: string | null | undefined;
  readonly content?: string | null | undefined;
  readonly fileRef?: string | null | undefined;
  readonly sha256: string;
};

/**
 * Caso de uso "pre-registrar a partir de uma captura" (spec 022, T091; FR-033..FR-038):
 * resolve a conta citada, marca "conferir" quando a captura tem baixa confianca, vira "cadastro
 * manual" quando nao ha nada util e guarda os anexos. A possivel duplicata so e marcada (FR-027).
 *
 * Spec 027: a notificacao da carteira tem um RECIBO por compra (`captureKey` = `dedupKey`),
 * gravado na mesma transacao do pre-registro e unico no banco - a mesma compra nunca vira dois
 * pre-registros, nem entre conexoes. Uma nova entrega da mesma compra completa o pre-registro
 * (so campos vazios) enquanto o usuario nao o editou; compra ja aprovada/descartada nao volta.
 *
 * Spec 028: a carteira manda VARIAS notificacoes por compra, com chaves e instantes diferentes.
 * Antes de criar, procura um pre-registro pendente da carteira, nao editado, criado na janela, com
 * mesmo valor e estabelecimento/cartao compativeis (`matchWalletContent`); achando, grava o recibo
 * da chave nova apontando para ele e o completa - decisao `merged` (ou `ignored-edited`).
 */
export class CreatePreRegistrationFromCaptureUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  public constructor(database: Database, ids: IdGenerator, clock: Clock) {
    this.database = database;
    this.ids = ids;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<CaptureResult> {
    const parsed = createPreRegistrationFromCaptureInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('pre-registrar captura', flat.fieldErrors, flat.formErrors);
    }
    const { userId, draft, attachments, sourceDevice } = parsed.data;
    const captureKey = draft.origin === 'wallet' ? draft.dedupKey : undefined;
    if (captureKey === undefined) {
      const pre = await this.database.transaction((tx) => this.create(tx, userId, draft, attachments ?? [], sourceDevice, this.ids));
      return { preRegistration: pre, decision: 'created' };
    }

    return this.database.transaction(async (tx) => {
      const preId = this.ids.next();
      const receipt = CaptureReceipt.create({ userId, captureKey, preRegistrationId: preId, createdAt: this.clock.now() });
      // a 1a operacao da transacao e uma ESCRITA (o recibo): pega o lock antes de ler, como na 027
      if (await tx.captureReceipts.insertIfAbsent(receipt)) {
        const match = await this.findContentMatch(tx, userId, draft);
        if (match !== null) return this.mergeInto(tx, receipt, match.pre, match.origin, draft);
        const pre = await this.create(tx, userId, draft, attachments ?? [], sourceDevice, new PresetIdGenerator(preId, this.ids));
        const stored = (await tx.preRegistrations.findById(userId, pre.id)) ?? pre;
        await tx.captureReceipts.save(receipt.withCaptureVersion(stored.updatedAt?.toISOString() ?? null));
        return { preRegistration: stored, decision: 'created' };
      }
      return this.repeat(tx, userId, captureKey, draft);
    });
  }

  /** Nova entrega de uma compra que ja tem recibo: completa, ignora ou nada (spec 027, R3/R4). */
  private async repeat(tx: Database, userId: string, captureKey: string, draft: CaptureDraft): Promise<CaptureResult> {
    const receipt = await tx.captureReceipts.findByKey(userId, captureKey);
    const pre = receipt === null ? null : await tx.preRegistrations.findById(userId, receipt.preRegistrationId);
    if (receipt === null || !receipt.isPending || pre === null) return { preRegistration: null, decision: 'ignored-resolved' };
    // spec 028: a versao "escrita pela captura" mora no recibo de ORIGEM do pre-registro
    const origin = await this.originReceipt(tx, userId, pre, receipt);
    if ((pre.updatedAt?.toISOString() ?? null) !== origin.captureVersion) return { preRegistration: pre, decision: 'ignored-edited' };

    const accounts = (await tx.accounts.listByUser(userId)).filter((account) => !account.archived);
    const patch = fillMissingFromCapture(pre, draft, resolveAccountHint(draft.accountHint, accounts));
    if (Object.keys(patch).length === 0) return { preRegistration: pre, decision: 'filled' };
    await tx.preRegistrations.save(pre.update(patch));
    const stored = (await tx.preRegistrations.findById(userId, pre.id)) ?? pre;
    await tx.captureReceipts.save(origin.withCaptureVersion(stored.updatedAt?.toISOString() ?? null));
    return { preRegistration: stored, decision: 'filled' };
  }

  /** Recibo da captura que CRIOU o pre-registro (`dedupKey` = chave da captura); na falta, `fallback`. */
  private async originReceipt(tx: Database, userId: string, pre: PreRegistration, fallback: CaptureReceipt): Promise<CaptureReceipt> {
    if (pre.dedupKey === null) return fallback;
    return (await tx.captureReceipts.findByKey(userId, pre.dedupKey)) ?? fallback;
  }

  /**
   * Pre-registro pendente da MESMA compra por conteudo (spec 028, R1): da carteira, nao so
   * cadastro manual, com recibo de origem (compras anteriores a spec 027 nao participam).
   */
  private async findContentMatch(
    tx: Database,
    userId: string,
    draft: CaptureDraft,
  ): Promise<{ readonly pre: PreRegistration; readonly origin: CaptureReceipt } | null> {
    if (draft.amountCents === undefined) return null;
    const pending = (await tx.preRegistrations.listByUser(userId)).filter(
      (pre) => pre.origin === 'wallet' && !pre.manualOnly && pre.amount !== null && pre.dedupKey !== null,
    );
    if (pending.length === 0) return null;
    const origins = new Map<string, CaptureReceipt>();
    const candidates: WalletContentCandidate[] = [];
    for (const pre of pending) {
      const origin = await tx.captureReceipts.findByKey(userId, pre.dedupKey!);
      if (origin === null || !origin.isPending) continue;
      origins.set(pre.id, origin);
      candidates.push({ id: pre.id, createdAt: pre.createdAt, amountCents: pre.amount!.cents, description: pre.description, accountId: pre.accountId });
    }
    const accounts = (await tx.accounts.listByUser(userId)).filter((account) => !account.archived);
    const account = { id: resolveAccountHint(draft.accountHint, accounts) ?? null, hinted: draft.accountHint !== undefined };
    const match = matchWalletContent(draft, account, candidates, this.clock.now());
    const pre = match === null ? undefined : pending.find((item) => item.id === match.id);
    return pre === undefined ? null : { pre, origin: origins.get(pre.id)! };
  }

  /**
   * Junta a notificacao de chave nova (recibo ja gravado) ao pre-registro existente (spec 028):
   * o recibo passa a apontar para ele e, se o usuario nao o editou, ele e completado.
   */
  private async mergeInto(
    tx: Database,
    receipt: CaptureReceipt,
    target: PreRegistration,
    origin: CaptureReceipt,
    draft: CaptureDraft,
  ): Promise<CaptureResult> {
    const version = target.updatedAt?.toISOString() ?? null;
    await tx.captureReceipts.save(receipt.withPreRegistrationId(target.id).withCaptureVersion(version));
    if (version !== origin.captureVersion) return { preRegistration: target, decision: 'ignored-edited' };

    const accounts = (await tx.accounts.listByUser(receipt.userId)).filter((account) => !account.archived);
    const patch = fillMissingFromCapture(target, draft, resolveAccountHint(draft.accountHint, accounts));
    if (Object.keys(patch).length === 0) return { preRegistration: target, decision: 'merged' };
    await tx.preRegistrations.save(target.update(patch));
    const stored = (await tx.preRegistrations.findById(receipt.userId, target.id)) ?? target;
    await tx.captureReceipts.save(origin.withCaptureVersion(stored.updatedAt?.toISOString() ?? null));
    return { preRegistration: stored, decision: 'merged' };
  }

  /** Cria o pre-registro da captura e guarda os anexos, tudo no `tx`. */
  private async create(
    tx: Database,
    userId: string,
    draft: CaptureDraft,
    attachments: readonly AttachmentInput[],
    sourceDevice: string | undefined,
    ids: IdGenerator,
  ): Promise<PreRegistration> {
    const accounts = (await tx.accounts.listByUser(userId)).filter((account) => !account.archived);
    const accountId = resolveAccountHint(draft.accountHint, accounts);
    const nothingUseful = draft.amountCents === undefined && draft.description === undefined && draft.date === undefined;

    const pre = await new CreatePreRegistrationOnDatabase(tx, ids, this.clock).execute({
      userId,
      origin: draft.origin,
      ...(draft.amountCents !== undefined ? { amountCents: draft.amountCents } : {}),
      ...(draft.description !== undefined ? { description: draft.description } : {}),
      ...(draft.date !== undefined ? { date: draft.date } : {}),
      ...(accountId !== undefined ? { accountId } : {}),
      ...(draft.paymentMethod !== undefined ? { paymentMethod: draft.paymentMethod } : {}),
      ...(draft.installments !== undefined && draft.paymentMethod === 'credit-card' ? { installments: draft.installments } : {}),
      ...(draft.notes !== undefined ? { notes: draft.notes } : {}),
      ...(draft.dedupKey !== undefined ? { dedupKey: draft.dedupKey } : {}),
      ...(draft.link !== undefined ? { link: draft.link } : {}),
      ...(sourceDevice !== undefined ? { sourceDevice } : {}),
      needsReview: draft.confidence === 'low' || (draft.accountHint !== undefined && accountId === undefined),
      manualOnly: nothingUseful,
    });

    for (const attachment of attachments) {
      await tx.captureAttachments.save(
        CaptureAttachment.create({
          id: this.ids.next(),
          userId,
          preRegistrationId: pre.id,
          kind: attachment.kind,
          mimeType: attachment.mimeType ?? null,
          content: attachment.content ?? null,
          fileRef: attachment.fileRef ?? null,
          sha256: attachment.sha256,
          createdAt: this.clock.now(),
        }),
      );
    }
    return pre;
  }
}

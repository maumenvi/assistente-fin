import { z } from 'zod';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type AgentPayload } from '../format/agent.payload.ts';
import { agentExportOptionsSchema } from './agent.export.options.ts';
import { type BuildAgentPayloadUseCase } from './build.agent.payload.use.case.ts';
import { buildPayloadFiles } from './build.full.history.file.ts';
import { composeInstructionsFileText } from './compose.share.text.ts';
import { type ShareFile } from './share.file.ts';
import { type ShareMode } from './share.mode.ts';
import { type CoveredRange, type PayloadPart, splitPayloadParts } from './split.payload.parts.ts';
import { utf8Bytes } from './utf8.bytes.ts';
import { DEFAULT_CLIPBOARD_BUDGET } from '../ai.exchange.preferences.ts';

const inputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  options: agentExportOptionsSchema.prefault({}),
  /** Texto do pedido pronto escolhido (FR-017); `null` = so as instrucoes. */
  requestText: z.string().trim().min(1).max(4000).nullable().default(null),
  budget: z.int().min(20_000).max(900_000).default(DEFAULT_CLIPBOARD_BUDGET),
  mode: z.enum(['recent', 'complete']).default('recent'),
});

/** Tudo que as telas de compartilhar precisam (spec 029, FR-011, FR-012). */
export interface ShareContent {
  readonly snapshot: AgentPayload['snapshot'];
  readonly mode: ShareMode;
  /** Partes do texto copiado; a parte 1 e a que vai para a area de transferencia na hora. */
  readonly parts: readonly PayloadPart[];
  /** Periodo e quantidade de transacoes da parte 1. */
  readonly covered: CoveredRange;
  /** Partes que faltam depois da primeira ("Copiar mais"). */
  readonly remaining: number;
  readonly totalRows: number;
  readonly textBytes: number;
  /** Arquivo de dados (JSON com instrucoes embutidas) e a versao `.txt`; o compartilhamento leva um por vez. */
  readonly files: readonly ShareFile[];
  readonly fileBytes: number;
}

/**
 * Gera o que o botao "Compartilhar com IA" entrega (spec 029, FR-011): o texto da area de
 * transferencia em partes numeradas e os arquivos do compartilhamento. No modo `recent` o arquivo
 * tem o mesmo recorte da parte 1; no `complete`, o historico inteiro (o texto continua sendo o
 * dos mais recentes, de reserva).
 */
export class BuildShareContentUseCase {
  private readonly payloadBuilder: BuildAgentPayloadUseCase;

  public constructor(payloadBuilder: BuildAgentPayloadUseCase) {
    this.payloadBuilder = payloadBuilder;
  }

  public async execute(rawInput: unknown): Promise<ShareContent> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('montar conteudo para compartilhar', flat.fieldErrors, flat.formErrors);
    }
    const { userId, options, requestText, budget, mode } = parsed.data;

    const payload = await this.payloadBuilder.execute({ userId, options });
    const split = splitPayloadParts(payload, requestText, budget);
    const firstPart = split.parts[0]!;

    const instructions = composeInstructionsFileText(requestText);
    const files = buildPayloadFiles(mode === 'complete' ? payload : firstPart.payload, mode, instructions);

    return {
      snapshot: payload.snapshot,
      mode,
      parts: split.parts,
      covered: split.covered,
      remaining: split.remaining,
      totalRows: split.totalRows,
      textBytes: utf8Bytes(firstPart.text),
      files,
      fileBytes: files.reduce((total, file) => total + utf8Bytes(file.content), 0),
    };
  }
}

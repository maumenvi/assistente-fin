import { type z } from 'zod';
import { type AutoActionKey, autoKeyOf } from '../../../../domain/plan/auto.action.key.ts';
import { type OperationKind } from '../../../../domain/plan/operation.kind.ts';
import { type PlanFlag } from '../../../../domain/plan/plan.flag.ts';
import { type ApplyContext, type OperationContext } from './operation.context.ts';
import { type OperationPreview } from './operation.preview.ts';
import { isInvalid, type OperationValidation } from './operation.validation.ts';
import { type WatchRef } from './watch.ref.ts';

/** Entrada ja validada e normalizada da operacao (o que o item guarda em `input`). */
export type OperationInput = Readonly<Record<string, unknown>>;

/** Item pronto para entrar no plano, antes da avaliacao de politica e de confianca. */
export interface PreparedOperation {
  readonly input: OperationInput;
  readonly preview: OperationPreview;
  readonly flags: readonly PlanFlag[];
  readonly watch: readonly WatchRef[];
}

/** Resultado de `prepare`: item pronto ou motivo de invalidez (volta ao modelo como erro de ferramenta). */
export type PrepareResult = { readonly ok: true; readonly value: PreparedOperation } | { readonly ok: false; readonly reason: string };

/**
 * Adaptador de uma operacao de escrita (spec 033, contracts/operations.md): os argumentos do
 * modelo viram um item verificavel e, na aprovacao, uma chamada ao caso de uso da tela.
 */
export interface OperationAdapter {
  readonly kind: OperationKind;
  readonly autoKey: AutoActionKey | null;
  /** Argumentos vindos do modelo (sem `userId`); base da uniao mostrada ao modelo. */
  readonly schema: z.ZodObject;
  /** Valida a forma, resolve entidades e monta antes/depois. */
  prepare(raw: unknown, ctx: OperationContext): Promise<PrepareResult>;
  /** Registros existentes que a operacao tocara (relidos na revalidacao e no `touched`). */
  watch(input: OperationInput, ctx: OperationContext): Promise<readonly WatchRef[]>;
  /** Chama o caso de uso; devolve os registros criados. */
  apply(input: OperationInput, ctx: ApplyContext): Promise<readonly WatchRef[]>;
}

/** Definicao tipada pelo schema; `defineOperation` apaga o tipo para o registro. */
export interface OperationSpec<S extends z.ZodObject> {
  readonly kind: OperationKind;
  readonly input: S;
  /** Normaliza o que o schema aceitou (ex.: resolve a categoria pelo nome). */
  normalize?(input: z.infer<S>, ctx: OperationContext): Promise<z.infer<S>>;
  watch(input: z.infer<S>, ctx: OperationContext): Promise<readonly WatchRef[]>;
  preview(input: z.infer<S>, ctx: OperationContext): Promise<OperationPreview>;
  validate(input: z.infer<S>, ctx: OperationContext): Promise<OperationValidation>;
  apply(input: z.infer<S>, ctx: ApplyContext): Promise<readonly WatchRef[]>;
}

export function defineOperation<S extends z.ZodObject>(spec: OperationSpec<S>): OperationAdapter {
  return {
    kind: spec.kind,
    autoKey: autoKeyOf(spec.kind),
    schema: spec.input,
    async prepare(raw, ctx) {
      const parsed = spec.input.safeParse(raw);
      if (!parsed.success) return { ok: false, reason: parsed.error.issues.map((i) => `${i.path.join('.') || 'entrada'}: ${i.message}`).join('; ') };
      const input = spec.normalize ? await spec.normalize(parsed.data, ctx) : parsed.data;
      const verdict = await spec.validate(input, ctx);
      if (isInvalid(verdict)) return { ok: false, reason: verdict.invalid };
      return { ok: true, value: { input: input as OperationInput, preview: await spec.preview(input, ctx), flags: verdict.flags, watch: await spec.watch(input, ctx) } };
    },
    watch: (input, ctx) => spec.watch(input as z.infer<S>, ctx),
    apply: (input, ctx) => spec.apply(input as z.infer<S>, ctx),
  };
}

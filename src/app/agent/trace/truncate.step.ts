import { type RunStep } from '../../../domain/agent/run.step.ts';

/** Teto do pedido e da resposta de um passo: 32 KB (data-model.md). */
export const MAX_STEP_PAYLOAD_BYTES = 32 * 1024;

/** Teto do resultado de uma ferramenta guardado no passo: 16 KB. */
export const MAX_TOOL_RESULT_BYTES = 16 * 1024;

/** Tamanho do trecho mantido quando um payload e cortado. */
const PREVIEW_CHARS = 1024;

function sizeOf(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Se o JSON do valor passa do teto, devolve um resumo com o inicio; senao o proprio valor. */
function capPayload(value: unknown): { readonly value: unknown; readonly cut: boolean } {
  if (value === null || value === undefined) return { value: null, cut: false };
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch {
    return { value: { truncated: true, unserializable: true }, cut: true };
  }
  if (json === undefined) return { value: null, cut: false };
  if (sizeOf(json) <= MAX_STEP_PAYLOAD_BYTES) return { value, cut: false };
  return { value: { truncated: true, originalBytes: sizeOf(json), preview: json.slice(0, PREVIEW_CHARS) }, cut: true };
}

/**
 * Aplica os tetos de armazenamento a um passo na emissao (spec 031, D16): `request`/`response` em
 * 32 KB e o resumo de cada ferramenta em 16 KB, marcando `truncated`. Funcao pura.
 */
export function truncateStep(step: RunStep): RunStep {
  const request = capPayload(step.request);
  const response = capPayload(step.response);
  let toolCut = false;
  const toolCalls = step.toolCalls.map((call) => {
    if (sizeOf(call.resultSummary) <= MAX_TOOL_RESULT_BYTES) return call;
    toolCut = true;
    return { ...call, resultSummary: call.resultSummary.slice(0, MAX_TOOL_RESULT_BYTES / 4), truncated: true };
  });
  if (!request.cut && !response.cut && !toolCut) return step;
  return { ...step, request: request.value, response: response.value, toolCalls, truncated: true };
}

import { type FileEditPreview } from '../../../../domain/agent/folder/file.edit.preview.ts';
import { FILE_LIMITS } from '../../../../domain/agent/folder/file.limits.ts';

const CONTEXT = 80;

/** Previa da edicao: so a regiao que mudou (com um pouco de contexto), cortada em `previewChars`. */
export function buildEditPreview(before: string, after: string): FileEditPreview {
  let start = 0;
  const max = Math.min(before.length, after.length);
  while (start < max && before[start] === after[start]) start += 1;
  let endBefore = before.length;
  let endAfter = after.length;
  while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) {
    endBefore -= 1;
    endAfter -= 1;
  }
  const from = Math.max(0, start - CONTEXT);
  const cut = (text: string, end: number): { text: string; truncated: boolean } => {
    const region = text.slice(from, Math.min(text.length, end + CONTEXT));
    return region.length > FILE_LIMITS.previewChars ? { text: `${region.slice(0, FILE_LIMITS.previewChars)}…`, truncated: true } : { text: region, truncated: false };
  };
  const b = cut(before, endBefore);
  const a = cut(after, endAfter);
  return { before: b.text, after: a.text, truncated: b.truncated || a.truncated };
}

import { type RequestDiff } from '../capability.request.ts';
import { type PinnedIdentity } from '../pinned.identity.ts';

/** O que mudou entre a identidade aprovada e a atual (ferramentas novas, removidas e alteradas; arquivos de skill). */
export function diffIdentity(approved: PinnedIdentity, current: PinnedIdentity): RequestDiff {
  const before = new Map(approved.tools.map((t) => [t.name, t]));
  const after = new Map(current.tools.map((t) => [t.name, t]));
  const added = [...after.keys()].filter((n) => !before.has(n));
  const removed = [...before.keys()].filter((n) => !after.has(n));
  const changed = [...after.entries()].filter(([n, t]) => before.has(n) && (before.get(n)?.descriptionHash !== t.descriptionHash || before.get(n)?.schemaHash !== t.schemaHash)).map(([n]) => n);
  const fileBefore = new Map(approved.files.map((f) => [f.path, f.sha256]));
  const fileAfter = new Map(current.files.map((f) => [f.path, f.sha256]));
  return {
    added: [...added, ...[...fileAfter.keys()].filter((p) => !fileBefore.has(p))],
    removed: [...removed, ...[...fileBefore.keys()].filter((p) => !fileAfter.has(p))],
    changed: [...changed, ...[...fileAfter.entries()].filter(([p, h]) => fileBefore.has(p) && fileBefore.get(p) !== h).map(([p]) => p)],
    extraInputs: [],
  };
}

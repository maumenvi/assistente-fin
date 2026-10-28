import { compareCodeUnits } from '../lifecycle/compare.code.units.ts';
import { type Sha256 } from '../lifecycle/fingerprint.identity.ts';
import { type PinnedFile } from '../pinned.identity.ts';
import { type SkillFileInput } from './skill.folder.ts';

/** Hash por arquivo (a tela e o verificador apontam QUAL arquivo mudou). */
export function hashSkillFiles(files: readonly SkillFileInput[], sha256: Sha256): PinnedFile[] {
  return [...files].sort((a, b) => compareCodeUnits(a.path, b.path)).map((f) => ({ path: f.path, sha256: sha256(f.content), bytes: f.bytes }));
}

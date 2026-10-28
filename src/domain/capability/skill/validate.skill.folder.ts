import { SCRIPT_EXTENSIONS, SKILL_ENTRY_FILE, SKILL_MAX_BYTES, SKILL_MAX_FILES } from './skill.limits.ts';
import { type SkillFileInput, type SkillValidation } from './skill.folder.ts';

const SAFE_SEGMENT = /^[^\\\0]+$/;

/** Recusa symlink, caminho que escapa, binario, script, falta de `SKILL.md` e excesso de limite (com o motivo). */
export function validateSkillFolder(files: readonly SkillFileInput[]): SkillValidation {
  if (files.length === 0) return { ok: false, reason: 'a skill esta vazia' };
  if (files.length > SKILL_MAX_FILES) return { ok: false, reason: `a skill tem ${files.length} arquivos (maximo ${SKILL_MAX_FILES})` };
  const total = files.reduce((sum, f) => sum + f.bytes, 0);
  if (total > SKILL_MAX_BYTES) return { ok: false, reason: `a skill tem ${Math.ceil(total / 1024 / 1024)} MB (maximo 5 MB)` };
  const seen = new Set<string>();
  for (const file of files) {
    const path = file.path;
    if (file.symlink === true) return { ok: false, reason: `link simbolico nao e aceito: ${path}` };
    if (path.startsWith('/') || path.split('/').some((s) => s === '..' || s === '' || !SAFE_SEGMENT.test(s))) return { ok: false, reason: `caminho invalido: ${path}` };
    if (seen.has(path)) return { ok: false, reason: `arquivo repetido: ${path}` };
    seen.add(path);
    if (file.binary === true) return { ok: false, reason: `arquivo binario nao e aceito: ${path}` };
    const lower = path.toLowerCase();
    if (SCRIPT_EXTENSIONS.some((ext) => lower.endsWith(ext))) return { ok: false, reason: `script nao e aceito nesta versao: ${path}` };
    if (file.content.startsWith('#!')) return { ok: false, reason: `script (shebang) nao e aceito nesta versao: ${path}` };
  }
  if (!seen.has(SKILL_ENTRY_FILE)) return { ok: false, reason: `falta o arquivo ${SKILL_ENTRY_FILE}` };
  return { ok: true };
}

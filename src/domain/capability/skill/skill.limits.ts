/** Limites de uma pasta de skill (FR-016). */
export const SKILL_MAX_FILES = 200;
export const SKILL_MAX_BYTES = 5 * 1024 * 1024;
export const SKILL_ENTRY_FILE = 'SKILL.md';
/** Extensoes de script recusadas nesta versao. */
export const SCRIPT_EXTENSIONS = ['.sh', '.bash', '.zsh', '.js', '.mjs', '.cjs', '.ts', '.py', '.rb', '.pl', '.ps1', '.bat', '.cmd', '.exe', '.dll', '.so'] as const;

/** Arquivo de uma skill baixada (texto UTF-8); `symlink` e `binary` vem de quem baixou. */
export interface SkillFileInput {
  readonly path: string;
  readonly content: string;
  readonly bytes: number;
  readonly symlink?: boolean | undefined;
  readonly binary?: boolean | undefined;
}

export type SkillValidation = { readonly ok: true } | { readonly ok: false; readonly reason: string };

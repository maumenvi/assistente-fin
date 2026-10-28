/** Imagens empacotadas em `src/assets/guide/<id>.png` (prints reais ja cobertos e ilustracoes). */
export const GUIDE_IMAGE_IDS = [
  'openrouter.home',
  'openrouter.keys',
  'openrouter.form',
  'openrouter.created',
  'google.playground',
  'google.keys',
  'ollama.download',
  'illustration.choose.provider',
  'illustration.paste.key',
  'illustration.terminal.pull',
  'illustration.terminal.context',
] as const;

/** Identificador de uma imagem do guia. */
export type GuideImageId = (typeof GUIDE_IMAGE_IDS)[number];

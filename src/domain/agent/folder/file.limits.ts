/** Limites das ferramentas de arquivo (spec 040): leitura, busca, escrita e paginacao do texto enviado ao modelo. */
export const FILE_LIMITS = Object.freeze({
  readMaxBytes: 2 * 1024 * 1024,
  searchMaxResults: 200,
  searchMaxDepth: 8,
  writeMaxChars: 1_000_000,
  pageChars: 10_000,
  previewChars: 600,
});

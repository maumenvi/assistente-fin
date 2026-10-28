/**
 * `fetch` injetado nos adaptadores. No desktop e o `fetch` global do Node; no Android e o `fetch`
 * de `expo/fetch` (o nativo nao faz streaming). Mesma assinatura do `fetch` padrao.
 */
export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

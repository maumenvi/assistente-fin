/**
 * Janela da deduplicacao por conteudo (spec 028, FR-005): uma notificacao da carteira com mesmo
 * valor e estabelecimento/cartao compativeis, chegada ate este tempo depois da CRIACAO do
 * pre-registro pendente, e a mesma compra. Valor unico e ajustavel.
 */
export const WALLET_CONTENT_DEDUP_WINDOW_MS = 3 * 60 * 1000;

/**
 * Janela curta para quando NAO ha nem estabelecimento nem cartao comparaveis (ex.: Pix sem
 * estabelecimento seguido de Pix com estabelecimento): so o valor e o tempo ligam as notificacoes
 * (spec 028, research R1).
 */
export const WALLET_CONTENT_DEDUP_BLIND_WINDOW_MS = 60 * 1000;

/** Etapa em que a leitura da resposta do modelo falhou (spec 037, FR-017). */
export type LlmProtocolStage = 'chunk_invalido' | 'fim_inesperado' | 'sem_saida';

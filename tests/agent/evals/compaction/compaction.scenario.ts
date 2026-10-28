/** Fato plantado no comeco da conversa e a pergunta de controle que depende dele (spec 032, FR-021). */
export interface PlantedFact {
  readonly id: string;
  readonly kind: 'account' | 'category' | 'decision' | 'pending';
  /** A frase que o usuario/assistente diz no comeco da conversa. */
  readonly said: string;
  /** Trechos que precisam estar no contexto montado depois de compactar para o fato ser respondivel. */
  readonly probes: readonly string[];
  /** A pergunta de controle feita depois da compactacao. */
  readonly question: string;
}

/** Um cenario: fatos plantados, um valor que NAO pode sobreviver como numero e quanto a conversa enche a janela. */
export interface CompactionScenario {
  readonly id: string;
  readonly facts: readonly PlantedFact[];
  /** Valor dito pelo assistente no comeco: depois de compactar tem de ser reconsultado, nunca repetido da memoria. */
  readonly planted: { readonly said: string; readonly figure: string };
  /** Quantos blocos de enchimento (cada um tem 20 mensagens). 3 a 5 estouram a janela varias vezes. */
  readonly fillerBatches: number;
  readonly contextWindow: number;
}

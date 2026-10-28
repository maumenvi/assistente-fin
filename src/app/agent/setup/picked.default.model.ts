/** Resultado de `pickDefaultModel`. `model: null` = nenhum candidato serve. */
export interface PickedDefaultModel {
  readonly model: string | null;
  /** O candidato sondado funcionou com ferramentas (so e `true` quando `model !== null`). */
  readonly supportsTools: boolean;
  readonly latencyMs: number;
  /** O padrao preferido sumiu da listagem do provedor e entrou o substituto (`model.default_replaced`). */
  readonly replaced: boolean;
  /** Ollama sem modelo que sirva: o comando para instalar o recomendado. */
  readonly suggestedCommand: string | null;
}

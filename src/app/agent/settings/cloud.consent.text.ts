/**
 * Texto mostrado antes do primeiro envio a um modelo na nuvem (spec 031, FR-027). Diz o que sai do
 * aparelho, para quem e como revogar. Alterar este texto exige subir `CLOUD_CONSENT_VERSION`.
 */
export const CLOUD_CONSENT_TEXT = {
  title: 'Enviar suas perguntas a um modelo de IA na nuvem?',
  paragraphs: [
    'Para responder, o assistente envia ao provedor do modelo que você escolheu a sua pergunta e os resultados das consultas necessárias à resposta (totais e amostras curtas, como valores e descrições de lançamentos).',
    'A sua base inteira nunca é enviada, e a chave de API fica guardada só neste aparelho.',
    'Você pode revogar este consentimento a qualquer momento em Configurar assistente, ou usar somente modelos locais (no computador), sem que nada saia do aparelho.',
  ],
  accept: 'Aceitar e enviar',
  cancel: 'Cancelar',
} as const;

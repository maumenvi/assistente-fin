/**
 * Texto mostrado antes do primeiro envio de anexos a um modelo na nuvem (spec 036, contracts/consent.md). `{provedor}` e
 * trocado pela tela pelo nome do provedor do modelo que vai ler o anexo. Alterar este texto exige subir `ATTACHMENTS_CONSENT_VERSION`.
 */
export const ATTACHMENTS_CONSENT_TEXT = {
  title: 'Enviar o conteúdo dos seus anexos a um modelo na nuvem?',
  paragraphs: [
    'O conteúdo do arquivo ou da imagem (valores, nomes e descrições) sai do aparelho junto com a sua pergunta.',
    'Ele vai para {provedor}, o provedor do modelo que você escolheu. A sua base inteira nunca é enviada.',
    'Você pode revogar este consentimento a qualquer momento em Configurar assistente › Privacidade, ou usar somente modelos locais, sem que nada saia do aparelho.',
  ],
  accept: 'Aceitar e enviar',
  cancel: 'Cancelar',
} as const;

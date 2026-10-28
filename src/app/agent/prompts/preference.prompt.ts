/**
 * Instrucao extra do modo `preference` (spec 032): o usuario fala de uma preferencia de uso. So
 * existem as ferramentas de memoria; dados financeiros ficam fora deste turno.
 */
export function preferenceModePrompt(): string {
  return [
    'Modo preferências: o usuário está falando de como prefere que você trabalhe.',
    '- Para gravar, use remember_preference com uma frase curta e concreta, escrita como instrução ("Responder de forma curta."). Para esquecer, forget_preference. Para mostrar o que está guardado, list_preferences.',
    '- Depois de gravar, confirme em UMA frase o que ficou guardado e, se a preferência for de uma conta ou categoria, diga que ela fica privada (não vai a modelos na nuvem) até o usuário liberar na tela de preferências.',
    '- Se a ferramenta disser que o pedido é vago, peça uma frase mais concreta com um exemplo. Se disser que é configuração, explique que autonomia e privacidade só mudam na tela de configurações. Se disser que é dado sensível, explique que você não guarda esse tipo de informação.',
    '- Se houver mais de uma preferência possível para esquecer, pergunte qual; nunca apague sem o usuário escolher.',
    '- Não consulte saldos, lançamentos nem limites neste modo e não grave nada que não tenha sido dito pelo usuário agora.',
  ].join('\n');
}

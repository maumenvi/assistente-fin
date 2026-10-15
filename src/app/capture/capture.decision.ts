/**
 * O que a captura fez (spec 027): criou um pre-registro, completou o existente da mesma compra,
 * ignorou porque o usuario ja editou o pre-registro, ou ignorou porque a compra ja foi resolvida.
 * Spec 028: `merged` = notificacao de outra chave juntada, por conteudo, a um pre-registro existente.
 */
export type CaptureDecision = 'created' | 'filled' | 'merged' | 'ignored-edited' | 'ignored-resolved';

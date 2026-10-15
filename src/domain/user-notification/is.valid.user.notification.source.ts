/** Identificador de origem: minusculas, digitos e hifen, comecando por letra, ate 40 chars. */
const SOURCE_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;

/**
 * Diz se `value` e uma origem de notificacao valida (spec 013, research R2b). A origem e um
 * identificador aberto, nao uma lista fechada: uma fonte nova (ex.: `email`) so precisa de um
 * identificador novo, sem mexer no dominio (RF-5).
 */
export function isValidUserNotificationSource(value: string): boolean {
  return SOURCE_PATTERN.test(value);
}

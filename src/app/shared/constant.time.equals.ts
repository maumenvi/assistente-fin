/**
 * Compara duas strings em tempo constante em relacao ao conteudo (spec 022, T008): percorre
 * sempre todos os caracteres e acumula as diferencas com XOR, sem sair no primeiro que diverge.
 * Um `!==` vaza, pelo tempo, quantos caracteres iniciais bateram. Comprimento diferente ja e
 * "nao confere" (os formatos comparados aqui sao fixos).
 *
 * Substitui o `timingSafeEqual` de `node:crypto` para que os casos de uso rodem tambem no
 * celular (Hermes), sem porta nova.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

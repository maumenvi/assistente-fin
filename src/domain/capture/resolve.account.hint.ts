function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Casa a conta/cartao citado numa captura ("no iti", "itau") com uma conta do usuario (spec 022,
 * T090). Sem acento e sem caixa; nome exato vence; senao, a unica conta cujo nome aparece como
 * palavra na dica (ou vice-versa). Ambiguo ou nenhum -> `undefined` (o campo fica "a definir").
 */
export function resolveAccountHint(
  hint: string | null | undefined,
  accounts: readonly { readonly id: string; readonly name: string }[],
): string | undefined {
  if (hint === null || hint === undefined) return undefined;
  const wanted = normalize(hint);
  if (wanted.length < 2) return undefined;
  const exact = accounts.filter((account) => normalize(account.name) === wanted);
  if (exact.length === 1) return exact[0]?.id;
  const words = ` ${wanted} `;
  const contained = accounts.filter((account) => {
    const name = normalize(account.name);
    return name.length >= 2 && (words.includes(` ${name} `) || ` ${name} `.includes(words));
  });
  return contained.length === 1 ? contained[0]?.id : undefined;
}

import { normalizeText } from '../normalize.text.ts';

const PATTERNS: readonly RegExp[] = [
  /\baprov\w* (tudo|sozinh\w*|automatic\w*)\b/,
  /\bnao (me )?(peca|pergunte|precisa\w* (de )?pedir|exija)\b.*\b(confirmacao|aprovacao|permissao|autorizacao)\b/,
  /\bnao (me )?(peca|pergunte)\b/,
  /\bsem (me )?(pedir |perguntar )?(confirmacao|aprovacao|permissao|autorizacao)\b/,
  /\b(faca|execute|lance|registre|pague|apague)\w* (tudo )?sozinh\w*/,
  /\b(mande|envie|mandar|enviar|use|usar)\b.*\b(nuvem|openrouter|provedor externo)\b/,
  /\b(nunca|jamais) (me )?(peca|pedir) (o )?consentimento\b/,
  /\b(dispense|ignore|pule|desative|desligue)\b.*\b(consentimento|confirmacao|aprovacao|privacidade)\b/,
  /\bmodo autonomo\b/,
  /\bautonomia\b/,
  /\bnao (se )?preocupe (com )?(a )?privacidade\b/,
];

/**
 * Pedido de mudar autonomia, privacidade ou confirmacao pelo chat (spec 032, FR-009). Isso so
 * muda nas configuracoes: o agente oferece o atalho e nao grava preferencia. Funcao de codigo,
 * rodada antes do modelo (constituicao VI).
 */
export function isGuardedPolicy(text: string): boolean {
  const normalized = normalizeText(text);
  return PATTERNS.some((p) => p.test(normalized));
}

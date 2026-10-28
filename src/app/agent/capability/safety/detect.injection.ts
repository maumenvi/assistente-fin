const PATTERNS: readonly { readonly label: string; readonly re: RegExp }[] = [
  { label: 'ignorar regras', re: /\b(ignore|ignora|ignorar|esqueca|esquecer|desconsidere|disregard|forget)\b.{0,40}\b(regras|instrucoes|anteriores|rules|instructions|previous|prompt)\b/ },
  { label: 'aprovar ou liberar', re: /\b(aprove|aprovar|approve|libere|liberar|habilite|habilitar|enable)\b.{0,40}\b(plano|plan|autonomia|autonomy|aprovacao|approval|automatic\w*|capacidade|capability)\b/ },
  { label: 'enviar dados para fora', re: /\b(envie|enviar|encaminhe|encaminhar|send|forward|post|upload)\b.{0,80}\b(para|to)\b.{0,60}(https?:\/\/|@)/ },
  { label: 'exfiltrar dados do usuario', re: /\b(envie|enviar|send|exfiltrat\w*|leak)\b.{0,50}\b(lancamentos|saldos?|dados|transacoes|transactions|balances?|data|chave|token|senha|password)\b/ },
  { label: 'papel de sistema', re: /(<\/?system>|\[\/?inst\]|\bsystem:\s|\bassistant:\s)/ },
  { label: 'url com dados', re: /https?:\/\/\S+\?\S*\b(token|data|dados|key|chave|saldo)=/ },
  { label: 'excluir tudo', re: /\b(exclua|apague|delete|remove|drop)\b.{0,30}\b(tudo|todos|all)\b/ },
];

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export interface InjectionVerdict {
  readonly suspected: boolean;
  readonly labels: readonly string[];
}

/**
 * Marca (sem bloquear nem obedecer) texto externo que parece dar ordens ao agente (spec 034, FR-009).
 * O resultado continua sendo dado; a marca vai ao registro de uso e a tela de execucao.
 */
export function detectInjection(text: string): InjectionVerdict {
  const normalized = normalize(text);
  const labels = PATTERNS.filter((p) => p.re.test(normalized)).map((p) => p.label);
  return { suspected: labels.length > 0, labels };
}

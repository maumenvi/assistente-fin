import { type AgentMessage } from '../../../domain/agent/agent.message.ts';
import { llmMessageSize } from '../context/llm.message.size.ts';
import { historyToLlmMessages } from '../context/history.to.llm.messages.ts';
import { compactionThreshold } from './compaction.threshold.ts';

/** Ultimas mensagens que ficam literais (ate caberem em 30% do orcamento). */
export const LITERAL_TAIL = 8;
/** Menos que isto no bloco nao vale uma chamada ao modelo. */
export const MIN_BLOCK_MESSAGES = 6;
const LITERAL_BUDGET_SHARE = 0.3;

/** O trecho a resumir: mensagens `fromSeq`..`toSeq`, em ordem cronologica, e combinados fixos detectados. */
export interface CompactionBlock {
  readonly fromSeq: number;
  readonly toSeq: number;
  readonly messages: readonly AgentMessage[];
  readonly pinnedConstraints?: readonly string[];
}

const PINNED_CONSTRAINT_PATTERN =
  /\b(so\s+(gastos?\s+|despesas?\s+)?(variave\w*|fix\w*)|apenas\s+(gastos?\s+|despesas?\s+)?(variave\w*|fix\w*)|considere\s+(so|apenas)\b[^.!?\n]{1,80}|ignore\s+[^.!?\n]{1,80}|sem\s+contar\s+[^.!?\n]{1,80}|foco\s+(so|apenas)\s+em\s+[^.!?\n]{1,80})/i;

function normalizeAscii(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Detecta combinados fixos ditos pela pessoa na conversa (ex.: "só variáveis", "considere apenas gastos fixos")
 * para reinjecao fora do resumo (spec 037, US4, T039).
 */
export function extractPinnedConstraints(messages: readonly AgentMessage[]): readonly string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const msg of messages) {
    if (msg.role !== 'user') continue;
    const raw = msg.parts.flatMap((p) => (p.type === 'text' ? [p.text] : [])).join(' ').trim();
    if (raw === '') continue;
    const normalized = normalizeAscii(raw);
    const match = PINNED_CONSTRAINT_PATTERN.exec(normalized);
    if (match === null) continue;
    // Extrai o trecho correspondente com acentos originais
    const start = match.index;
    const snippet = raw.slice(start, start + match[0].length).trim();
    const key = snippet.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      found.push(snippet);
    }
  }
  return found;
}

function tokensOf(message: AgentMessage): number {
  return historyToLlmMessages([message]).reduce((sum, m) => sum + llmMessageSize(m), 0);
}

/**
 * Escolhe o bloco a compactar (spec 032, research P7): tudo o que o resumo ainda nao cobre, menos as
 * ultimas mensagens, que ficam literais - 8, ou menos ate caberem em 30% do orcamento da janela. As
 * literais comecam por uma mensagem do usuario (o historico nunca comeca por uma resposta). `null`
 * quando o bloco ficaria com menos de 6 mensagens. Entram so as mensagens completas e com texto.
 */
export function pickBlock(uncovered: readonly AgentMessage[], contextWindow: number): CompactionBlock | null {
  const eligible = uncovered.filter((m) => m.status === 'complete' && historyToLlmMessages([m]).length > 0);
  const budget = contextWindow * compactionThreshold(contextWindow);
  let keep = Math.min(LITERAL_TAIL, eligible.length);
  const tail = (n: number): readonly AgentMessage[] => eligible.slice(eligible.length - n);
  while (keep > 2 && tail(keep).reduce((sum, m) => sum + tokensOf(m), 0) > budget * LITERAL_BUDGET_SHARE) keep -= 1;
  // as literais comecam por uma mensagem do usuario: se nao, segura mais uma de cada vez
  while (keep < eligible.length && tail(keep)[0]?.role !== 'user') keep += 1;
  const block = eligible.slice(0, eligible.length - keep);
  if (block.length < MIN_BLOCK_MESSAGES) return null;
  const first = block[0] as AgentMessage;
  const last = block[block.length - 1] as AgentMessage;
  const pinned = extractPinnedConstraints(block);
  return {
    fromSeq: first.seq,
    toSeq: last.seq,
    messages: block,
    ...(pinned.length > 0 ? { pinnedConstraints: pinned } : {}),
  };
}

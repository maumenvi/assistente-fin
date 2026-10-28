import { type SummaryContent } from '../../../../src/domain/agent/summary/summary.content.ts';
import { type LlmPort } from '../../../../src/app/agent/ports/llm/llm.port.ts';
import { TOOLS_CAPABILITIES } from '../../nodes/support/node.harness.ts';
import { type CompactionScenario } from './compaction.scenario.ts';

const norm = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Resumidor gravado do conjunto offline: faz o que um bom modelo faria com o pedido da compactacao -
 * devolve em JSON os fatos plantados que aparecem no resumo anterior ou nas mensagens novas, sem
 * nenhum valor em reais e com entidades pelos ids do catalogo. `forget` simula um resumidor ruim
 * (usado para provar que a avaliacao detecta regressao).
 */
export function oracleSummarizer(scenario: CompactionScenario, options: { readonly forget?: ReadonlySet<string> } = {}): LlmPort {
  return {
    capabilities: TOOLS_CAPABILITIES,
    stream(request) {
      const text = norm(JSON.stringify(request.messages));
      const seen = scenario.facts.filter((f) => text.includes(norm(f.probes[0] as string)) && options.forget?.has(f.kind) !== true);
      const catalogIds = [...JSON.stringify(request.messages).matchAll(/(conta|categoria) ([^→\\]+) → id ([A-Za-z0-9_-]+)/g)];
      const entities = catalogIds
        .filter((m) => seen.some((f) => norm(f.probes[0] as string) === norm((m[2] as string).trim())))
        .map((m) => ({ kind: m[1] === 'conta' ? ('account' as const) : ('category' as const), id: m[3] as string, label: (m[2] as string).trim() }));
      const content: SummaryContent = {
        goal: 'Analisar os gastos de setembro.',
        decisions: seen.filter((f) => f.kind === 'decision').map((f) => f.probes[0] as string),
        entities: [...new Map(entities.map((e) => [e.id, e])).values()],
        pending: seen.filter((f) => f.kind === 'pending').map((f) => f.probes[0] as string),
        openPlans: [],
      };
      return (async function* () {
        yield { type: 'text_delta' as const, text: JSON.stringify(content) };
        yield { type: 'finish' as const, reason: 'stop' as const };
      })();
    },
  };
}

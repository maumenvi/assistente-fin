import { type CompactionScenario, type PlantedFact } from './compaction.scenario.ts';

const ACCOUNTS = ['Nubank', 'Itaú', 'Inter', 'Bradesco'];
const CATEGORIES = ['Mercado', 'Lazer', 'Transporte', 'Saúde e bem-estar'];
const DECISIONS = ['comparar sempre com o mês anterior', 'ignorar as transferências entre contas', 'agrupar os gastos por semana'];
const PENDING = ['conferir a fatura de outubro', 'rever o limite do cartão', 'separar os gastos do aluguel'];

function facts(n: number): PlantedFact[] {
  const account = ACCOUNTS[n % ACCOUNTS.length] as string;
  const category = CATEGORIES[n % CATEGORIES.length] as string;
  const decision = DECISIONS[n % DECISIONS.length] as string;
  const pending = PENDING[n % PENDING.length] as string;
  return [
    { id: `acc${String(n)}`, kind: 'account', said: `Vamos olhar a conta ${account}.`, probes: [account], question: 'Qual conta estávamos olhando?' },
    { id: `cat${String(n)}`, kind: 'category', said: `Foco na categoria ${category}.`, probes: [category], question: 'Qual categoria era o foco?' },
    { id: `dec${String(n)}`, kind: 'decision', said: `Combinado: ${decision}.`, probes: [decision], question: 'O que combinamos sobre a análise?' },
    { id: `pen${String(n)}`, kind: 'pending', said: `Ficou pendente: ${pending}.`, probes: [pending], question: 'O que ficou pendente?' },
  ];
}

/** Tokens aproximados de um bloco de 20 mensagens de enchimento (ver `run.compaction.scenario.ts`). */
const BATCH_TOKENS = 1_700;

/** 12 cenarios sinteticos: janelas de 4 a 8 mil tokens e de 3 a 5 vezes a janela em conversa. */
export const COMPACTION_SCENARIOS: readonly CompactionScenario[] = Array.from({ length: 12 }, (_, n) => {
  const contextWindow = 4_000 + (n % 3) * 2_000;
  const times = 3 + (n % 3);
  return {
    id: `compaction.${String(n + 1).padStart(2, '0')}`,
    facts: facts(n),
    planted: { said: `Você gastou R$ ${String(1_284 + n)},60 com ${CATEGORIES[n % CATEGORIES.length] as string} em setembro.`, figure: `R$ ${String(1_284 + n)},60` },
    fillerBatches: Math.ceil((times * contextWindow) / BATCH_TOKENS),
    contextWindow,
  };
});

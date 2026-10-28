import { type Fact } from '../../../domain/agent/fact.ts';
import { extractFigures } from './extract.figures.ts';
import { type Figure } from './figure.ts';

/** Chave canonica de um fato para comparacao. */
function keysOf(fact: Fact): string[] {
  if (fact.kind === 'date' && typeof fact.value === 'string') {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fact.value);
    return iso ? [`date:${fact.value}`, `date:${iso[2]}-${iso[3]}`] : [`date:${fact.value}`];
  }
  if (fact.kind === 'money' && typeof fact.value === 'number') {
    // o sinal vem escrito de varios jeitos no texto ("-R$", "−R$", "– R$", "negativo"): o valor confere pelo modulo
    return [`money:${String(fact.value)}`, `money:${String(Math.abs(fact.value))}`];
  }
  if (fact.kind === 'percent' && typeof fact.value === 'number') {
    const n = Number(fact.value);
    return [`percent:${String(n)}`, `percent:${String(Math.abs(n))}`, `percent:${String(Math.round(Math.abs(n)))}`];
  }
  if (fact.kind === 'count') {
    return [`${fact.kind}:${String(typeof fact.value === 'number' ? Number(fact.value) : fact.value)}`];
  }
  return [`${fact.kind}:${String(fact.value)}`];
}

/**
 * Livro-razao dos fatos citaveis de uma execucao (spec 031, D10): o que as ferramentas devolveram
 * mais as figuras que o proprio usuario escreveu na pergunta. Uma figura da resposta so e
 * "confirmada" se estiver aqui. Dinheiro em centavos inteiros; datas aceitam a forma curta.
 */
export class FactLedger {
  private facts: Fact[];
  private keys: Set<string>;

  public constructor(initial: readonly Fact[] = []) {
    this.facts = [];
    this.keys = new Set();
    this.add(initial);
  }

  /** Acrescenta fatos (de ferramentas). */
  public add(facts: readonly Fact[]): void {
    for (const fact of facts) {
      this.facts.push(fact);
      for (const key of keysOf(fact)) this.keys.add(key);
    }
  }

  /** Registra as figuras escritas pelo usuario: elas podem ser repetidas na resposta. */
  public addUserText(text: string): void {
    extractFigures(text).forEach((figure, index) => this.add([factOfUserFigure(figure, index)]));
  }

  /** A figura (tipo + forma canonica) esta confirmada? */
  public has(kind: Figure['kind'], normalized: string): boolean {
    return this.keys.has(`${kind}:${normalized}`);
  }

  /** Copia serializavel (vai para o checkpoint em `AgentState.ledger`). */
  public snapshot(): Fact[] {
    return [...this.facts];
  }
}

function factOfUserFigure(figure: Figure, index: number): Fact {
  const numeric = figure.kind === 'date' ? figure.normalized : Number(figure.normalized);
  return {
    id: `user-${figure.start}-${index}`,
    kind: figure.kind,
    value: numeric,
    display: figure.raw,
    label: 'informado pelo usuario',
    sourceCallId: 'user',
  };
}

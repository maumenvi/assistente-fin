import { type Consumed } from '../../../domain/agent/consumed.ts';
import { type RunStatus } from '../../../domain/agent/run.status.ts';
import { type RunPlanRef } from '../use-cases/get.run.detail.use.case.ts';
import { type ViewStep } from './view.step.ts';

/** No do grafo na tela de execucao. `unvisited` vem da definicao do grafo, nao de lista fixa. */
export interface GraphNodeView {
  readonly id: string;
  readonly label: string;
  readonly isStart: boolean;
  /** Quantas vezes o no executou nesta execucao. */
  readonly visits: number;
  readonly current: boolean;
}

/** Aresta do grafo e quantas vezes foi percorrida. */
export interface GraphEdgeView {
  readonly from: string;
  readonly to: string;
  readonly taken: number;
}

/** Estado da tela "Execucao do agente" (contracts/agent.events.md). */
export interface RunViewState {
  readonly runId: string | null;
  readonly status: RunStatus;
  readonly nodes: readonly GraphNodeView[];
  readonly edges: readonly GraphEdgeView[];
  readonly steps: readonly ViewStep[];
  /** Planos criados pela execucao (o ponto de aprovacao; spec 033). */
  readonly plans: readonly RunPlanRef[];
  readonly currentNode: string | null;
  readonly consumed: Consumed;
  readonly errorCode: string | null;
  /** Ultimo `seq` de evento aplicado (descarta repeticao e atraso). */
  readonly lastEventSeq: number;
}

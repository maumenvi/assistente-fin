import { type CorrectionEvidence } from '../../../../domain/plan/rule/correction.evidence.ts';

/** Correcoes de categoria aprovadas (local). Janela de 90 dias e teto de 500 por usuario. */
export interface EvidenceStorePort {
  append(evidence: CorrectionEvidence): Promise<void>;
  /** Correcoes do comerciante desde `since`, mais recentes primeiro. */
  listByMerchant(userId: string, merchant: string, since: string): Promise<CorrectionEvidence[]>;
  /** Remove o que e anterior a `before` e o que passa de `max` (mantem as mais recentes). */
  prune(userId: string, before: string, max: number): Promise<void>;
  deleteAll(userId: string): Promise<void>;
}

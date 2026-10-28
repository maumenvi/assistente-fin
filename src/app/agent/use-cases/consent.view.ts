import { type ConsentRecord } from '../../../domain/agent/consent.record.ts';

/** Situacao do consentimento de nuvem, como a tela a mostra. */
export interface ConsentView {
  /** O modelo principal ativo e de nuvem e ainda nao ha consentimento vigente para o texto atual. */
  readonly needed: boolean;
  readonly record: ConsentRecord | null;
  /** Versao do texto vigente (`agent-cloud-v1`). */
  readonly textVersion: string;
  /** O que este consentimento cobre. */
  readonly kind: 'cloud' | 'attachments';
}

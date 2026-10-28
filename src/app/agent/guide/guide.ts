import { type ProviderId } from '../../../domain/agent/provider/provider.id.ts';
import { type GuideStep } from './guide.step.ts';

/** Guia de um provedor, empacotado no app (funciona sem internet). */
export interface Guide {
  readonly id: ProviderId;
  readonly title: string;
  /** Markdown. */
  readonly intro: string;
  readonly steps: readonly GuideStep[];
  /** Markdown, opcional. */
  readonly closing?: string;
}

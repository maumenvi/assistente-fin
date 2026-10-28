import { type GuideFigure } from './guide.figure.ts';

/** Um passo do guia: titulo, texto em Markdown (o mesmo do chat) e a figura. */
export interface GuideStep {
  readonly id: string;
  readonly title: string;
  readonly markdown: string;
  readonly figure: GuideFigure;
}

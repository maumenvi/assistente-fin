import { type GuideRect } from './guide.rect.ts';

/** Marca numerada sobre a figura ("A", "B", "C"...): onde clicar, o que copiar, onde colar. */
export interface GuideHighlight {
  readonly label: string;
  readonly rect: GuideRect;
}

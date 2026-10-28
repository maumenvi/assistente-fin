import { type GuideHighlight } from './guide.highlight.ts';
import { type GuideImageId } from './guide.image.id.ts';
import { type GuideRect } from './guide.rect.ts';

/**
 * Figura de um passo (FR-006a): a imagem, a legenda (e o texto alternativo, montado com os rotulos) e as marcas.
 * A imagem original nunca e alterada: recorte (`cropBottomPct`) e cobertura (`covers`) sao dados desenhados por cima.
 */
export interface GuideFigure {
  readonly image: GuideImageId;
  /** Largura x altura da imagem, para reservar o espaco. */
  readonly aspect: readonly [number, number];
  readonly caption: string;
  /** `true` para ilustracao feita para o guia (nao e captura de tela de terceiros). */
  readonly illustration?: boolean;
  readonly highlights: readonly GuideHighlight[];
  /** Retangulos borrados sobre a imagem (dados sensiveis). */
  readonly covers?: readonly GuideRect[];
  /** Mostrar so o topo da imagem: porcentagem de baixo a cortar. */
  readonly cropBottomPct?: number;
}

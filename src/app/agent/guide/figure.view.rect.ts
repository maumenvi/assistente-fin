import { type GuideRect } from './guide.rect.ts';

/**
 * Retangulo (em % da imagem ORIGINAL) -> retangulo em % da imagem como e mostrada. Com `cropBottomPct` so o topo aparece,
 * entao as medidas verticais crescem (a imagem exibida e mais baixa). Usado igualmente pelo desktop e pelo Android.
 */
export function figureViewRect(rect: GuideRect, cropBottomPct = 0): GuideRect {
  const visible = 100 - cropBottomPct;
  if (visible <= 0) return rect;
  const scale = 100 / visible;
  return { x: rect.x, y: rect.y * scale, w: rect.w, h: rect.h * scale };
}

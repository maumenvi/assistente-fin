import { type SefazPageData } from './sefaz.page.data.ts';
import { parsePortalNfceLayout } from './parse.portal.nfce.layout.ts';

/**
 * Parser por UF da pagina de consulta da NFC-e (spec 022, T089; research R6). Os estados abaixo
 * usam o layout "Portal da NFC-e"; uma UF que mudar de layout ganha um parser proprio aqui. UF
 * sem parser -> `undefined` (pre-registro com o que o QR trouxe + "conferir").
 */
const PARSERS: Readonly<Record<string, (html: string) => SefazPageData | undefined>> = {
  SP: parsePortalNfceLayout,
  MG: parsePortalNfceLayout,
  RJ: parsePortalNfceLayout,
  PR: parsePortalNfceLayout,
  RS: parsePortalNfceLayout,
  SC: parsePortalNfceLayout,
  BA: parsePortalNfceLayout,
  GO: parsePortalNfceLayout,
  DF: parsePortalNfceLayout,
};

/** Extrai total, data e razao social da pagina da SEFAZ da UF; `undefined` se nao souber. */
export function parseSefazPage(uf: string, html: string): SefazPageData | undefined {
  return PARSERS[uf]?.(html);
}

import { type SefazPageData } from './sefaz.page.data.ts';

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Parser do layout "Portal da NFC-e" - o modelo de pagina de consulta publica por QR code
 * adotado pela maioria das SEFAZ (spec 022, T089). Procura "Valor a pagar R$", "Emissao" e a
 * razao social no topo (`#u20 .txtTopo`). `undefined` se algum dos tres nao aparecer - a tela
 * trata como "conferir dados" (FR-034).
 */
export function parsePortalNfceLayout(html: string): SefazPageData | undefined {
  const text = stripTags(html);
  const total = /Valor a pagar R\$:?\s*([\d.]+,\d{2})/i.exec(text) ?? /Valor total R\$:?\s*([\d.]+,\d{2})/i.exec(text);
  const emission = /Emiss[aã]o:?\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(text);
  const merchantMatch = /class="txtTopo"[^>]*>([^<]+)</i.exec(html) ?? /id="u20"[^>]*>([^<]+)</i.exec(html);
  if (!total?.[1] || !emission || !merchantMatch?.[1]) return undefined;
  const [, day, month, year] = emission;
  return {
    amountCents: Math.round(Number(total[1].replace(/\./g, '').replace(',', '.')) * 100),
    date: `${year}-${month}-${day}`,
    merchant: merchantMatch[1].trim(),
  };
}

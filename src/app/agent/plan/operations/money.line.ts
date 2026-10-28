import { formatBrl } from '../../verify/format.brl.ts';

/** Linha "rotulo: valor" do antes/depois de um item. */
export function moneyLine(label: string, cents: number): string {
  return `${label}: ${formatBrl(cents)}`;
}

/** Data AAAA-MM-DD (ou ISO) como dd/mm/aaaa. */
export function dateLine(label: string, date: string): string {
  const [y, m, d] = date.slice(0, 10).split('-');
  return `${label}: ${d}/${m}/${y}`;
}

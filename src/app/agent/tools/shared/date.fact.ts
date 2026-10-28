import { type Fact } from '../../../../domain/agent/fact.ts';

/** Fato de data: `isoDate` "AAAA-MM-DD"; o texto exibido e "DD/MM/AAAA". */
export function dateFact(id: string, label: string, isoDate: string): Fact {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return { id, kind: 'date', value: isoDate.slice(0, 10), display: `${day}/${month}/${year}`, label, sourceCallId: '' };
}

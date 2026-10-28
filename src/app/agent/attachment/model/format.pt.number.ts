/** Numero em formato brasileiro com duas casas (`2644.95` -> `2.644,95`). */
export function formatPtNumber(value: number): string {
  const [int, dec] = Math.abs(value).toFixed(2).split('.') as [string, string];
  return `${value < 0 ? '-' : ''}${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

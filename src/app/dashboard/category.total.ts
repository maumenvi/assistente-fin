/** Total de um mes agrupado por categoria (Dashboard, spec 018/019). */
export interface CategoryTotal {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly totalCents: number;
}

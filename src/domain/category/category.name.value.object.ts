import { InvalidCategoryError } from './invalid.category.error.ts';

/** Limite de tamanho do nome ja normalizado (spec 003, RF-9). */
export const CATEGORY_NAME_MAX_LENGTH = 50;

/** Qualquer sequencia de espacos/tabs/quebras vira um unico espaco. */
const WHITESPACE_RUN = /\s+/gu;

/**
 * Nome de categoria validado e normalizado (spec 003, RF-9, CA-1).
 *
 * A normalizacao e a propria regra de identidade da categoria: `trim`, espacos internos
 * colapsados e MAIUSCULAS. Assim "  mercado  livre " e "MERCADO LIVRE" sao a mesma categoria,
 * e o valor guardado no banco ja e a chave de unicidade por usuario - nao existe "forma de
 * exibicao" separada.
 */
export class CategoryName {
  /** Nome normalizado (MAIUSCULAS, sem espacos duplicados nem nas pontas). */
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Normaliza e valida uma string qualquer. Lanca `InvalidCategoryError` quando sobra vazio
   * ou quando o resultado passa de `CATEGORY_NAME_MAX_LENGTH` (CA-29).
   */
  public static create(raw: string): CategoryName {
    const normalized = CategoryName.normalize(raw);
    if (normalized === '') {
      throw new InvalidCategoryError('nome vazio');
    }
    if (normalized.length > CATEGORY_NAME_MAX_LENGTH) {
      throw new InvalidCategoryError(`nome com mais de ${CATEGORY_NAME_MAX_LENGTH} caracteres`);
    }
    return new CategoryName(normalized);
  }

  /**
   * Forma normalizada de uma string, sem validar. Serve para montar a chave de busca de
   * `findByName` sem precisar construir o value object (spec 003, CA-10).
   */
  public static normalize(raw: string): string {
    return raw.trim().replace(WHITESPACE_RUN, ' ').toUpperCase();
  }

  public equals(other: CategoryName): boolean {
    return this.value === other.value;
  }
}

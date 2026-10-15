import { isValidOptionalDate } from '../shared/is.valid.optional.date.ts';
import { CategoryName } from './category.name.value.object.ts';
import { InvalidCategoryError } from './invalid.category.error.ts';

/** Dados necessarios para criar uma categoria. */
export interface CreateCategoryProps {
  readonly id: string;
  readonly userId: string;
  readonly name: CategoryName;
  /**
   * `true` so na categoria padrao do usuario (spec 003, RF-8). A flag nasce na criacao e
   * nunca muda: `rename` a preserva, e nao ha metodo que promova/rebaixe uma categoria.
   */
  readonly isDefault?: boolean;
  /**
   * `true` so na categoria de sistema "SALDO" (spec 011, RF-16). Identifica a categoria de
   * forma estavel mesmo apos renomeada (decisao 4.8), analogo a `isDefault`. Nasce na criacao
   * e nunca muda.
   */
  readonly isSystemBalance?: boolean;
  /**
   * `true` so na categoria de sistema "SALDO INICIAL" (spec 015): recebe o lancamento gerado
   * automaticamente ao criar uma conta com "gasto/saldo inicial" > 0. Mesma estabilidade de
   * `isSystemBalance` - identifica por flag, nao por nome.
   */
  readonly isSystemOpeningBalance?: boolean;
  /**
   * `true` so na categoria de sistema "AJUSTE" (spec 015): recebe o lancamento de correcao
   * gerado ao editar o "gasto/saldo inicial" de uma conta que ja tem lancamentos. Mesma
   * estabilidade de `isSystemBalance` - identifica por flag, nao por nome.
   */
  readonly isSystemAdjustment?: boolean;
  /**
   * `true` so na categoria de sistema de transferencia entre contas (spec 016, RF-1): recebe
   * as duas pontas de toda transferencia criada pela operacao nativa. Mesma estabilidade de
   * `isSystemBalance` - identifica por flag, nao por nome (o usuario pode renomear a
   * categoria "TRANSFERENCIAS" livremente sem perder a exclusao dos totais do Dashboard).
   */
  readonly isSystemTransfer?: boolean;
  /**
   * `true` so na categoria de sistema de pagamento de fatura de cartao de credito (spec 016,
   * RF-2): recebe as duas pontas de todo pagamento de fatura criado pela operacao nativa.
   * Nunca e a mesma categoria de `isSystemTransfer` - cartao de credito nao e conta de saldo
   * (decisao de modelo da spec 016), pagar fatura e uma operacao propria, distinta de
   * transferir entre contas.
   */
  readonly isSystemCardPayment?: boolean;
}

/** Dados de uma categoria ja persistida, incluindo campos que `create` nao aceita direto. */
export interface CategoryPersistenceProps extends CreateCategoryProps {
  /** Versao para trava otimista (spec 002, RF-31). `null`/ausente = nunca persistida. */
  readonly updatedAt?: Date | null;
}

/**
 * Categoria de lancamentos de um usuario (spec 003, RF-6).
 *
 * Imutavel: `rename` devolve uma nova instancia. **Nao ha exclusao** nesta entrega (RF-7,
 * CA-4) - por isso a classe nao tem `delete`/`archive`: um lancamento nunca fica apontando
 * para uma categoria que sumiu.
 *
 * O nome vive num `CategoryName` (ja normalizado em MAIUSCULAS), entao renomear troca so o
 * texto: o `id` continua o mesmo e todos os lancamentos vinculados passam a exibir o nome
 * novo sem tocar em linha nenhuma (CA-3).
 */
export class Category {
  public readonly id: string;
  public readonly userId: string;
  public readonly name: CategoryName;
  /** `true` na categoria padrao do usuario - a que recebe lancamentos sem categoria (RF-8). */
  public readonly isDefault: boolean;
  /** `true` na categoria de sistema "SALDO" (spec 011, RF-16). */
  public readonly isSystemBalance: boolean;
  /** `true` na categoria de sistema "SALDO INICIAL" (spec 015). */
  public readonly isSystemOpeningBalance: boolean;
  /** `true` na categoria de sistema "AJUSTE" (spec 015). */
  public readonly isSystemAdjustment: boolean;
  /** `true` na categoria de sistema de transferencia entre contas (spec 016, RF-1). */
  public readonly isSystemTransfer: boolean;
  /** `true` na categoria de sistema de pagamento de fatura de cartao (spec 016, RF-2). */
  public readonly isSystemCardPayment: boolean;
  /** Versao lida do banco (trava otimista, RF-31); `null` enquanto nao foi persistida. */
  public readonly updatedAt: Date | null;

  private constructor(props: CategoryPersistenceProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.name = props.name;
    this.isDefault = props.isDefault ?? false;
    this.isSystemBalance = props.isSystemBalance ?? false;
    this.isSystemOpeningBalance = props.isSystemOpeningBalance ?? false;
    this.isSystemAdjustment = props.isSystemAdjustment ?? false;
    this.isSystemTransfer = props.isSystemTransfer ?? false;
    this.isSystemCardPayment = props.isSystemCardPayment ?? false;
    this.updatedAt = props.updatedAt ?? null;
  }

  /** Cria uma categoria nova: comum por padrao, `isDefault: true` so na "SEM CATEGORIA". */
  public static create(props: CreateCategoryProps): Category {
    return Category.build(props);
  }

  /**
   * Reconstroi uma categoria ja persistida (adaptadores de `database/`). Reaplica as mesmas
   * invariantes de `create`: um adaptador nunca pode produzir uma `Category` que a fabrica
   * normal rejeitaria.
   */
  public static fromPersistence(props: CategoryPersistenceProps): Category {
    return Category.build(props);
  }

  /** Devolve a mesma categoria com outro `updatedAt` - usado pelos adaptadores ao (re)carimbar. */
  public withUpdatedAt(updatedAt: Date | null): Category {
    return new Category({ ...this.props(), updatedAt });
  }

  /**
   * Troca o nome mantendo `id` e `isDefault` (CA-6): a categoria padrao pode ser renomeada e
   * continua sendo a padrao. Como os lancamentos guardam o `id`, a mudanca propaga sozinha.
   */
  public rename(name: CategoryName): Category {
    if (!(name instanceof CategoryName)) {
      throw new InvalidCategoryError('nome deve ser CategoryName');
    }
    return new Category({ ...this.props(), name });
  }

  /**
   * Promove esta categoria a categoria de sistema de transferencia (`isSystemTransfer: true`),
   * preservando `id` e todo o resto (spec 016, RF-10) - usado tanto por
   * `MigrateTransferCategoryUseCase` (migracao manual, ambiguidade resolvida por quem chama)
   * quanto por `ensureTransferCategory` (promocao automatica sob demanda, quando ha
   * exatamente uma categoria homonima).
   */
  public withSystemTransfer(): Category {
    return new Category({ ...this.props(), isSystemTransfer: true });
  }

  private static build(props: CategoryPersistenceProps): Category {
    const id = props.id.trim();
    const userId = props.userId.trim();

    if (id === '') throw new InvalidCategoryError('id obrigatorio');
    if (userId === '') throw new InvalidCategoryError('userId obrigatorio');
    if (!(props.name instanceof CategoryName)) {
      throw new InvalidCategoryError('nome deve ser CategoryName');
    }
    if (!isValidOptionalDate(props.updatedAt)) {
      throw new InvalidCategoryError('updatedAt deve ser null ou uma data valida');
    }

    return new Category({
      id,
      userId,
      name: props.name,
      isDefault: props.isDefault ?? false,
      isSystemBalance: props.isSystemBalance ?? false,
      isSystemOpeningBalance: props.isSystemOpeningBalance ?? false,
      isSystemAdjustment: props.isSystemAdjustment ?? false,
      isSystemTransfer: props.isSystemTransfer ?? false,
      isSystemCardPayment: props.isSystemCardPayment ?? false,
      updatedAt: props.updatedAt ?? null,
    });
  }

  private props(): CategoryPersistenceProps {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      isDefault: this.isDefault,
      isSystemBalance: this.isSystemBalance,
      isSystemOpeningBalance: this.isSystemOpeningBalance,
      isSystemAdjustment: this.isSystemAdjustment,
      isSystemTransfer: this.isSystemTransfer,
      isSystemCardPayment: this.isSystemCardPayment,
      updatedAt: this.updatedAt,
    };
  }
}

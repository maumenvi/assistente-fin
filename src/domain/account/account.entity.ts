import { Money } from '../shared/money.value.object.ts';
import { isValidOptionalDate } from '../shared/is.valid.optional.date.ts';
import { type AccountKind, ACCOUNT_KINDS } from './account.kind.ts';
import { InvalidAccountError } from './invalid.account.error.ts';

/** Comprimento maximo do nome de uma conta. */
const MAX_NAME_LENGTH = 120;

/** Dados necessarios para criar uma conta. */
export interface CreateAccountProps {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly kind: AccountKind;
  readonly openingBalance: Money;
  /**
   * Data em que `openingBalance` foi observado/apurado - ex.: "saldo bancario em 17/09".
   * `null` so em contas legadas criadas antes deste campo existir (nunca em conta nova com
   * `openingBalance !== 0`, exigido na borda). Usada como piso: lancamentos anteriores a ela
   * ja estao embutidos no valor do saldo, entao nao devem ser somados de novo no calculo de
   * saldo da conta (evita a dupla contagem do bug de saldo inicial vs. saldo atual).
   */
  readonly openingBalanceDate?: Date | null;
  /** Limite de credito (spec 008, RF-1). So se aplica a `kind: 'credit-card'`. */
  readonly creditLimit?: Money | null;
  /**
   * Dia do mes de fechamento da fatura (spec 008 revisao, RF-2), independente do dia de
   * vencimento. So se aplica a `kind: 'credit-card'`.
   */
  readonly closingDay?: number | null;
  /** Dia do mes de vencimento da fatura (spec 008, RF-2). So se aplica a `kind: 'credit-card'`. */
  readonly dueDay?: number | null;
  /**
   * Marca a conta como "beneficio" (spec 011, RF-9): ganhos/gastos dela nao entram nos
   * totais gerais, exibidos separadamente. Por conta, independente de `kind`. Default `false`.
   */
  readonly isBenefit?: boolean;
}

/** Dados de uma conta ja persistida, incluindo campos que `create` nao aceita direto. */
export interface AccountPersistenceProps extends CreateAccountProps {
  readonly archived: boolean;
  /** Versao para trava otimista (spec 002, RF-31). `null`/ausente = nunca persistida. */
  readonly updatedAt?: Date | null;
}

/**
 * Conta financeira de um usuario (spec 001, RF-1).
 *
 * Imutavel: `rename`, `archive`, `unarchive` e `changeOpeningBalance` devolvem uma nova
 * instancia. As invariantes sao verificadas na construcao (defesa em profundidade; a
 * validacao de entrada externa acontece antes, na borda, com zod - rule 11).
 */
export class Account {
  public readonly id: string;
  public readonly userId: string;
  public readonly name: string;
  public readonly kind: AccountKind;
  public readonly openingBalance: Money;
  /** `null` so em contas legadas - ver `CreateAccountProps.openingBalanceDate`. */
  public readonly openingBalanceDate: Date | null;
  public readonly archived: boolean;
  /** Versao lida do banco (trava otimista, RF-31); `null` enquanto nao foi persistida. */
  public readonly updatedAt: Date | null;
  /** `null` fora de `kind: 'credit-card'`, ou quando ainda nao configurado (spec 008, RF-1). */
  public readonly creditLimit: Money | null;
  /**
   * `null` fora de `kind: 'credit-card'`, ou quando ainda nao configurado (spec 008 revisao,
   * RF-2). Independente de `dueDay` - lancamentos no dia do fechamento (ou depois) entram na
   * fatura seguinte (RF-5a).
   */
  public readonly closingDay: number | null;
  /** `null` fora de `kind: 'credit-card'`, ou quando ainda nao configurado (spec 008, RF-2). */
  public readonly dueDay: number | null;
  /** Conta-beneficio (spec 011, RF-9): `true` exclui a conta dos totais gerais. */
  public readonly isBenefit: boolean;

  private constructor(props: AccountPersistenceProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.name = props.name;
    this.kind = props.kind;
    this.openingBalance = props.openingBalance;
    this.openingBalanceDate = props.openingBalanceDate ?? null;
    this.archived = props.archived;
    this.updatedAt = props.updatedAt ?? null;
    this.creditLimit = props.creditLimit ?? null;
    this.closingDay = props.closingDay ?? null;
    this.dueDay = props.dueDay ?? null;
    this.isBenefit = props.isBenefit ?? false;
  }

  /**
   * Cria uma conta nova: nasce sempre nao arquivada (CA-1). Com saldo inicial diferente de
   * zero, exige `openingBalanceDate` - so uma conta legada (`fromPersistence`) pode ter saldo
   * sem data de referencia.
   */
  public static create(props: CreateAccountProps): Account {
    if (props.openingBalance.cents !== 0 && props.openingBalanceDate == null) {
      throw new InvalidAccountError('data do saldo inicial obrigatoria quando o saldo e diferente de zero');
    }
    return Account.build({ ...props, archived: false });
  }

  /**
   * Reconstroi uma conta ja persistida (adaptadores de `database/`, ex.: mapper Prisma).
   * Reaplica as mesmas invariantes de `create` por defesa em profundidade (CA-19, CA-20):
   * um adaptador nunca pode produzir uma `Account` que a fabrica normal rejeitaria.
   */
  public static fromPersistence(props: AccountPersistenceProps): Account {
    return Account.build(props);
  }

  /** Devolve a mesma conta com outro `updatedAt` - usado pelos adaptadores ao (re)carimbar. */
  public withUpdatedAt(updatedAt: Date | null): Account {
    return new Account({ ...this.props(), updatedAt });
  }

  private static build(props: AccountPersistenceProps): Account {
    const id = props.id.trim();
    const userId = props.userId.trim();
    const name = props.name.trim();

    if (id === '') throw new InvalidAccountError('id obrigatorio');
    if (userId === '') throw new InvalidAccountError('userId obrigatorio');
    if (name === '') throw new InvalidAccountError('nome obrigatorio');
    if (name.length > MAX_NAME_LENGTH) {
      throw new InvalidAccountError(`nome acima de ${MAX_NAME_LENGTH} caracteres`);
    }
    if (!ACCOUNT_KINDS.includes(props.kind)) {
      throw new InvalidAccountError(`tipo desconhecido: ${String(props.kind)}`);
    }
    if (!(props.openingBalance instanceof Money)) {
      throw new InvalidAccountError('saldo inicial deve ser Money');
    }
    if (!isValidOptionalDate(props.openingBalanceDate)) {
      throw new InvalidAccountError('data do saldo inicial deve ser null ou uma data valida');
    }
    if (!isValidOptionalDate(props.updatedAt)) {
      throw new InvalidAccountError('updatedAt deve ser null ou uma data valida');
    }

    const creditLimit = props.creditLimit ?? null;
    const closingDay = props.closingDay ?? null;
    const dueDay = props.dueDay ?? null;
    if (props.kind === 'credit-card') {
      // RF-1/RF-2 nao exigem os campos no cadastro (contas existentes podem completar
      // depois via `changeCreditCardTerms` - decisao 4.4 do plano); so valida o formato
      // quando presentes.
      if (creditLimit !== null && !(creditLimit instanceof Money)) {
        throw new InvalidAccountError('limite de credito deve ser Money');
      }
      if (closingDay !== null && (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31)) {
        throw new InvalidAccountError('closingDay deve ser inteiro entre 1 e 31');
      }
      if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
        throw new InvalidAccountError('dueDay deve ser inteiro entre 1 e 31');
      }
      // Fechamento e vencimento sao datas independentes (spec 008 revisao, decisao 4.1); se
      // fossem iguais, um lancamento no fechamento (que ja pertence a fatura seguinte, RF-5a)
      // e o proprio vencimento colidiriam no mesmo dia - regra de negocio nova desta revisao.
      if (closingDay !== null && dueDay !== null && closingDay === dueDay) {
        throw new InvalidAccountError('dia de fechamento e de vencimento devem ser diferentes');
      }
    } else if (creditLimit !== null || closingDay !== null || dueDay !== null) {
      throw new InvalidAccountError(
        'limite de credito, fechamento e vencimento so se aplicam a contas do tipo credit-card',
      );
    }

    return new Account({
      id,
      userId,
      name,
      kind: props.kind,
      openingBalance: props.openingBalance,
      openingBalanceDate: props.openingBalanceDate ?? null,
      archived: props.archived,
      updatedAt: props.updatedAt ?? null,
      creditLimit,
      closingDay,
      dueDay,
      isBenefit: props.isBenefit ?? false,
    });
  }

  public rename(name: string): Account {
    const trimmed = name.trim();
    if (trimmed === '') throw new InvalidAccountError('nome obrigatorio');
    if (trimmed.length > MAX_NAME_LENGTH) {
      throw new InvalidAccountError(`nome acima de ${MAX_NAME_LENGTH} caracteres`);
    }
    return new Account({ ...this.props(), name: trimmed });
  }

  /**
   * Corrige o saldo inicial cru e sua data de referencia juntos (nunca um sem o outro) - uso
   * pretendido e so a correcao de um erro de digitacao logo apos criar a conta, antes de ela
   * ter Transactions reais (`UpdateAccountUseCase` e quem decide se e permitido nesse
   * momento). Depois que a conta ja tem movimentacao real, a forma correta de corrigir o
   * saldo e reconciliar (`ReconcileAccountBalanceUseCase`), nao editar este campo.
   */
  public changeOpeningBalance(openingBalance: Money, openingBalanceDate: Date | null): Account {
    if (!(openingBalance instanceof Money)) {
      throw new InvalidAccountError('saldo inicial deve ser Money');
    }
    if (openingBalance.cents !== 0 && openingBalanceDate == null) {
      throw new InvalidAccountError('data do saldo inicial obrigatoria quando o saldo e diferente de zero');
    }
    return new Account({ ...this.props(), openingBalance, openingBalanceDate });
  }

  /**
   * Troca o tipo da conta entre os tipos "comuns" (`checking`, `savings`, `wallet`,
   * `meal-voucher`, `other`). Trocar de/para `credit-card` fica fora de escopo -
   * `InvalidAccountError` em ambas as direcoes: a conta credit-card tem campos proprios
   * (`creditLimit`/`closingDay`/`dueDay`) e uma tela separada (Cartao de credito), entao
   * migrar de/para ela exigiria uma decisao de produto sobre o que fazer com esses campos e
   * pra qual tela a conta passa a pertencer - decisao explicita de manter fora por ora.
   */
  public changeKind(kind: AccountKind): Account {
    if (this.kind === 'credit-card' || kind === 'credit-card') {
      throw new InvalidAccountError(
        'troca de tipo de/para credit-card nao e suportada - use a tela de Cartao de credito',
      );
    }
    return Account.build({ ...this.props(), kind });
  }

  /**
   * Define/atualiza limite de credito, dia de fechamento e dia de vencimento (spec 008
   * revisao, RF-1, RF-2). So permitido em contas `kind: 'credit-card'` (RF-3) -
   * `InvalidAccountError` senao. Reaplica `build()` para garantir `closingDay !== dueDay`.
   */
  public changeCreditCardTerms(creditLimit: Money, closingDay: number, dueDay: number): Account {
    if (this.kind !== 'credit-card') {
      throw new InvalidAccountError(
        'limite de credito, fechamento e vencimento so se aplicam a contas do tipo credit-card',
      );
    }
    return Account.build({ ...this.props(), creditLimit, closingDay, dueDay });
  }

  /** Marca/desmarca a conta como beneficio (spec 011, RF-9). Disponivel para qualquer `kind`. */
  public changeBenefitFlag(isBenefit: boolean): Account {
    return new Account({ ...this.props(), isBenefit });
  }

  public archive(): Account {
    return this.archived ? this : new Account({ ...this.props(), archived: true });
  }

  public unarchive(): Account {
    return this.archived ? new Account({ ...this.props(), archived: false }) : this;
  }

  private props(): AccountPersistenceProps {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      kind: this.kind,
      openingBalance: this.openingBalance,
      openingBalanceDate: this.openingBalanceDate,
      archived: this.archived,
      updatedAt: this.updatedAt,
      creditLimit: this.creditLimit,
      closingDay: this.closingDay,
      dueDay: this.dueDay,
      isBenefit: this.isBenefit,
    };
  }
}

import { type AccountKind } from '../../domain/account/account.kind.ts';

/** Forma minima de uma conta para os totais do Dashboard (ver `DashboardTransaction`). */
export interface DashboardAccount {
  readonly id: string;
  readonly kind: AccountKind;
  readonly isBenefit: boolean;
  readonly openingBalanceDate?: string | null | undefined;
}

/** Como uma categoria aparece junto de um lancamento nas telas (desktop e celular). */
export interface DescribedCategory {
  readonly categoryName: string;
  readonly pendingClassification: boolean;
  readonly isSystemCategory: boolean;
  readonly isSystemTransfer: boolean;
  readonly isSystemCardPayment: boolean;
}

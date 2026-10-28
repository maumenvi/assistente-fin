export const PERMISSIONS = ['network', 'sends_user_text', 'sends_financial_values', 'needs_credential'] as const;

/** O que a capacidade pede, em linguagem do cartao de aprovacao. */
export type Permission = (typeof PERMISSIONS)[number];

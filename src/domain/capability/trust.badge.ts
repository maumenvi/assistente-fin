export const TRUST_BADGES = ['curated', 'official_registry', 'unverified'] as const;

/** Selo de confianca mostrado no cartao de aprovacao. */
export type TrustBadge = (typeof TRUST_BADGES)[number];

export const TRUST_BADGE_TEXT: Readonly<Record<TrustBadge, string>> = {
  curated: 'Curado pelo app',
  official_registry: 'Registro oficial',
  unverified: 'Não verificado',
};

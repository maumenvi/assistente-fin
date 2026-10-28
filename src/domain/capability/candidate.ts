import { type CapabilityKind } from './capability.kind.ts';
import { type Permission } from './permission.ts';
import { type TrustBadge } from './trust.badge.ts';

export type CapabilitySource = 'curated' | 'official_registry' | 'skills_sh' | 'github' | 'custom';

export interface CapabilityOrigin {
  readonly source: CapabilitySource;
  readonly ref: string;
  readonly url?: string | undefined;
  readonly commit?: string | undefined;
}

/** Credencial que o servidor pede; o formulario e do app (nunca o chat). */
export interface CredentialSpec {
  readonly name: string;
  readonly label: string;
  readonly secret: boolean;
  /** Cabecalho HTTP em que o valor vai (ex.: `Authorization`). */
  readonly header?: string | undefined;
  /** Pode ficar em branco (ex.: servidor informado pelo usuario que talvez nao peca chave). */
  readonly optional?: boolean | undefined;
}

/** Candidato do catalogo: tudo vem da FONTE, nunca do texto do modelo (research C8). */
export interface Candidate {
  readonly kind: CapabilityKind;
  readonly slug: string;
  readonly name: string;
  readonly publisher: string;
  readonly description: string;
  readonly origin: CapabilityOrigin;
  readonly badge: TrustBadge;
  readonly endpointUrl?: string | undefined;
  readonly transport: 'streamable-http' | 'sse' | 'skill';
  readonly declaredEgress: readonly string[];
  readonly permissions: readonly Permission[];
  readonly credentialSpec: readonly CredentialSpec[];
  readonly platforms: readonly ('desktop' | 'android')[];
  readonly skillPreview?: { readonly files: number; readonly bytes: number; readonly excerpt: string } | undefined;
}

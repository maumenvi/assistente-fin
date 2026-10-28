import { type Candidate } from '../../../../domain/capability/candidate.ts';
import { type CapabilityKind } from '../../../../domain/capability/capability.kind.ts';

export type CatalogPlatform = 'desktop' | 'android';

export interface CatalogQuery {
  readonly query: string;
  readonly platform: CatalogPlatform;
  readonly kinds?: readonly CapabilityKind[] | undefined;
}

export interface CatalogFailure {
  readonly source: string;
  readonly reason: string;
}

export interface CatalogResult {
  readonly candidates: readonly Candidate[];
  readonly failures: readonly CatalogFailure[];
}

/** Catalogo de capacidades (spec 034, contracts/catalog.md): junta fontes e devolve no maximo 3 candidatos. */
export interface CatalogPort {
  search(query: CatalogQuery): Promise<CatalogResult>;
}

/** Uma fonte do catalogo (curado, registro oficial, skills.sh, GitHub). Pode lancar: o `SearchCatalog` converte em `failures`. */
export interface CatalogProvider {
  /** Nome curto da fonte, usado em `failures`. */
  readonly source: string;
  search(query: CatalogQuery, signal?: AbortSignal): Promise<readonly Candidate[]>;
}

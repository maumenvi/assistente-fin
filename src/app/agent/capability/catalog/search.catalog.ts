import { type Candidate } from '../../../../domain/capability/candidate.ts';
import { type TrustBadge } from '../../../../domain/capability/trust.badge.ts';
import { type CatalogFailure, type CatalogPort, type CatalogProvider, type CatalogQuery, type CatalogResult } from '../ports/catalog.port.ts';
import { relevance } from './relevance.ts';

/** No maximo 3 candidatos chegam ao usuario (contracts/catalog.md). */
export const MAX_CANDIDATES = 3;

const BADGE_ORDER: Readonly<Record<TrustBadge, number>> = { curated: 0, official_registry: 1, unverified: 2 };

/** Codigo local nao roda no celular: so servidor remoto e skill de instrucoes. */
function fitsPlatform(candidate: Candidate, query: CatalogQuery): boolean {
  if (!candidate.platforms.includes(query.platform)) return false;
  if (query.kinds !== undefined && !query.kinds.includes(candidate.kind)) return false;
  if (query.platform === 'android' && candidate.kind === 'mcp' && candidate.transport !== 'streamable-http' && candidate.transport !== 'sse') return false;
  return true;
}

/**
 * Junta as fontes (spec 034, contracts/catalog.md): ordena curado > registro > demais e, dentro do mesmo selo,
 * por relevancia; tira repetidos (mesma origem), filtra pela plataforma e corta em 3. Fonte que falha
 * vira `failures` e nao derruba as outras (sem rede, sobra o curado).
 */
export class SearchCatalog implements CatalogPort {
  private readonly providers: readonly CatalogProvider[];

  public constructor(providers: readonly CatalogProvider[]) {
    this.providers = providers;
  }

  public async search(query: CatalogQuery): Promise<CatalogResult> {
    const failures: CatalogFailure[] = [];
    const settled = await Promise.all(
      this.providers.map(async (provider) => {
        try {
          return await provider.search(query);
        } catch (error) {
          failures.push({ source: provider.source, reason: error instanceof Error ? error.message.slice(0, 160) : 'falhou' });
          return [] as readonly Candidate[];
        }
      }),
    );
    const seen = new Set<string>();
    const all: { candidate: Candidate; order: number; score: number }[] = [];
    for (const [order, list] of settled.entries()) {
      for (const candidate of list) {
        const key = `${candidate.kind}:${candidate.origin.source}:${candidate.origin.ref}`;
        if (seen.has(key) || !fitsPlatform(candidate, query)) continue;
        seen.add(key);
        all.push({ candidate, order, score: relevance(query.query, [candidate.name, candidate.slug, candidate.description]) });
      }
    }
    all.sort((a, b) => BADGE_ORDER[a.candidate.badge] - BADGE_ORDER[b.candidate.badge] || b.score - a.score || a.order - b.order);
    return { candidates: all.slice(0, MAX_CANDIDATES).map((x) => x.candidate), failures };
  }
}

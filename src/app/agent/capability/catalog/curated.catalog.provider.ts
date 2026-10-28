import { type Candidate } from '../../../../domain/capability/candidate.ts';
import { type CatalogProvider, type CatalogQuery } from '../ports/catalog.port.ts';
import { CURATED_ENTRIES, type CuratedEntry } from './curated.catalog.ts';
import { relevance } from './relevance.ts';

/** Fonte curada: lista versionada, sem rede. Aceita outra lista (testes e a variavel de teste do e2e). */
export class CuratedCatalogProvider implements CatalogProvider {
  public readonly source = 'curado';
  private readonly entries: readonly CuratedEntry[];

  public constructor(entries: readonly CuratedEntry[] = CURATED_ENTRIES) {
    this.entries = entries;
  }

  public search(query: CatalogQuery): Promise<readonly Candidate[]> {
    const scored = this.entries
      .map((e) => ({ e, score: relevance(query.query, [e.candidate.name, e.candidate.slug, e.candidate.description, ...e.keywords]) }))
      .filter((s) => s.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return Promise.resolve(scored.map((s) => s.e.candidate));
  }
}

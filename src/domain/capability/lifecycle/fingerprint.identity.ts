import { compareCodeUnits } from './compare.code.units.ts';
import { type PinnedIdentity, type PinnedTool } from '../pinned.identity.ts';
import { canonicalJson } from './canonical.json.ts';

/** Ferramenta como o servidor a anuncia. */
export interface AnnouncedTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: unknown;
}

export type Sha256 = (text: string) => string;

/**
 * Identidade fixada de um servidor MCP (research C5): hash canonico do nome do servidor e das
 * ferramentas (nome, descricao, schema) ordenadas por nome. A VERSAO do servidor fica fora do hash
 * (muda a cada deploy sem mudar a capacidade).
 */
export function fingerprintIdentity(serverName: string | undefined, serverVersion: string | undefined, tools: readonly AnnouncedTool[], sha256: Sha256, now: Date): PinnedIdentity {
  const pinned: PinnedTool[] = [...tools]
    .sort((a, b) => compareCodeUnits(a.name, b.name))
    .map((t) => ({ name: t.name, descriptionHash: sha256(t.description), schemaHash: sha256(canonicalJson(t.inputSchema ?? null)) }));
  return { hash: sha256(canonicalJson({ serverName: serverName ?? null, tools: pinned })), tools: pinned, files: [], serverName, serverVersion, pinnedAt: now.toISOString() };
}

/** Identidade de uma skill: hash do conjunto de `path:sha256` ordenado. */
export function fingerprintSkill(files: readonly { path: string; sha256: string; bytes: number }[], sha256: Sha256, now: Date): PinnedIdentity {
  const sorted = [...files].sort((a, b) => compareCodeUnits(a.path, b.path));
  return { hash: sha256(canonicalJson(sorted.map((f) => [f.path, f.sha256]))), tools: [], files: sorted, pinnedAt: now.toISOString() };
}

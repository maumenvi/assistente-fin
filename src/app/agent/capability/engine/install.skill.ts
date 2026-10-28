import { type Candidate } from '../../../../domain/capability/candidate.ts';
import { type Capability } from '../../../../domain/capability/capability.ts';
import { fingerprintSkill } from '../../../../domain/capability/lifecycle/fingerprint.identity.ts';
import { newActiveCapability, reapproveCapability } from '../../../../domain/capability/lifecycle/approve.capability.ts';
import { hashSkillFiles } from '../../../../domain/capability/skill/hash.skill.files.ts';
import { validateSkillFolder } from '../../../../domain/capability/skill/validate.skill.folder.ts';
import { describeError } from './describe.error.ts';
import { type CapabilityEngineDeps } from './engine.deps.ts';

export type InstallOutcome = { readonly status: 'active'; readonly capability: Capability } | { readonly status: 'failed'; readonly reason: string };

/**
 * Instala uma skill de instrucoes (spec 034, FR-016): baixa a pasta, valida (limites, caminhos, link simbolico,
 * script, binario), calcula o hash por arquivo, grava os arquivos no banco do aparelho e fixa a identidade.
 * Skill nao executa nada: o conteudo so e lido pelo agente como texto. Recusa devolve o motivo legivel.
 */
export async function installSkill(deps: CapabilityEngineDeps, input: { readonly userId: string; readonly capabilityId: string; readonly candidate: Candidate; readonly existing: Capability | null }): Promise<InstallOutcome> {
  if (deps.skills === undefined) return { status: 'failed', reason: 'skills nao sao suportadas neste aparelho' };
  let files;
  try {
    files = await deps.skills.download(input.candidate);
  } catch (error) {
    return { status: 'failed', reason: `nao consegui baixar a skill: ${describeError(error)}` };
  }
  const verdict = validateSkillFolder(files);
  if (!verdict.ok) return { status: 'failed', reason: verdict.reason };
  const hashed = hashSkillFiles(files, deps.sha256);
  const now = deps.clock.now();
  const identity = fingerprintSkill(hashed, deps.sha256, now);
  const hashOf = new Map(hashed.map((h) => [h.path, h.sha256]));
  await deps.stores.skillFiles.replaceAll(input.userId, input.capabilityId, files.map((f) => ({ path: f.path, sha256: hashOf.get(f.path) ?? '', bytes: f.bytes, content: f.content })));
  const capability = input.existing === null ? newActiveCapability({ id: input.capabilityId, userId: input.userId, candidate: input.candidate, identity, credentialRefs: [], now }) : reapproveCapability(input.existing, identity, now);
  return { status: 'active', capability };
}

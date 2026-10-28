import { type Candidate } from '../../../../domain/capability/candidate.ts';
import { type Capability } from '../../../../domain/capability/capability.ts';
import { type RequestDiff } from '../../../../domain/capability/capability.request.ts';
import { fingerprintIdentity } from '../../../../domain/capability/lifecycle/fingerprint.identity.ts';
import { newActiveCapability, reapproveCapability } from '../../../../domain/capability/lifecycle/approve.capability.ts';
import { buildAuth } from './credential.auth.ts';
import { describeError } from './describe.error.ts';
import { type CapabilityEngineDeps } from './engine.deps.ts';
import { extraInputs } from './egress.extras.ts';

export interface ConnectAndPinInput {
  readonly userId: string;
  readonly capabilityId: string;
  readonly candidate: Candidate;
  /** Valores digitados no formulario do app, por nome de credencial (nunca vem do chat). */
  readonly credentials: Readonly<Record<string, string>>;
  /** O usuario ja viu os campos extras (reaprovacao): nao os recusa de novo. */
  readonly acknowledgeExtra: boolean;
  /** Capacidade que esta sendo reaprovada (mudou); mantem id e credenciais ja no cofre. */
  readonly existing: Capability | null;
}

export type PinOutcome =
  | { readonly status: 'active'; readonly capability: Capability }
  | { readonly status: 'needs_confirmation'; readonly diff: RequestDiff }
  | { readonly status: 'failed'; readonly reason: string };

/**
 * Conecta, testa e fixa (spec 034, contracts/capability.lifecycle.md, passos 4-7): grava as credenciais no
 * cofre, conecta, lista as ferramentas (precisa de ao menos uma), compara com o que o catalogo declarou e
 * so entao fixa a identidade e devolve a capacidade `active`. Qualquer falha apaga as credenciais gravadas
 * agora e devolve o motivo; nada fica ativo.
 */
export async function connectAndPin(deps: CapabilityEngineDeps, input: ConnectAndPinInput): Promise<PinOutcome> {
  const { candidate } = input;
  if (candidate.endpointUrl === undefined) return { status: 'failed', reason: 'o catalogo nao informou o endereco do servidor' };
  const missing = candidate.credentialSpec.filter((s) => input.existing === null && s.optional !== true && (input.credentials[s.name] ?? '').trim() === '');
  if (missing.length > 0) return { status: 'failed', reason: `falta preencher: ${missing.map((m) => m.label).join(', ')}` };

  const provided = Object.fromEntries(Object.entries(input.credentials).filter(([name, value]) => value.trim() !== '' && candidate.credentialSpec.some((s) => s.name === name)));
  let savedRefs: string[] = [];
  try {
    savedRefs = Object.keys(provided).length > 0 ? await deps.vault.save(input.capabilityId, provided) : [];
  } catch (error) {
    return { status: 'failed', reason: `nao consegui guardar a credencial: ${describeError(error)}` };
  }
  const refs = savedRefs.length > 0 || input.existing === null ? savedRefs : [...input.existing.credentialRefs];
  const secrets = Object.values(provided);
  const rollback = async (reason: string): Promise<PinOutcome> => {
    await deps.vault.deleteAll(savedRefs);
    return { status: 'failed', reason };
  };

  const auth = await buildAuth(deps.vault, refs);
  let connection;
  try {
    connection = await deps.mcp.connect({ url: candidate.endpointUrl, allowInsecureLocal: deps.allowInsecureLocal() }, auth);
  } catch (error) {
    return await rollback(`nao consegui conectar: ${describeError(error, secrets)}`);
  }
  try {
    const tools = await deps.mcp.listTools(connection);
    if (tools.length === 0) return await rollback('o servidor conectou, mas nao oferece nenhuma ferramenta');
    const extras = input.acknowledgeExtra ? [] : extraInputs(candidate.declaredEgress, tools);
    if (extras.length > 0) {
      await deps.vault.deleteAll(savedRefs);
      return { status: 'needs_confirmation', diff: { added: [], removed: [], changed: [], extraInputs: extras } };
    }
    const now = deps.clock.now();
    const identity = fingerprintIdentity(connection.serverInfo.name, connection.serverInfo.version, tools, deps.sha256, now);
    const capability =
      input.existing === null
        ? newActiveCapability({ id: input.capabilityId, userId: input.userId, candidate, identity, credentialRefs: refs, now })
        : { ...reapproveCapability(input.existing, identity, now), credentialRefs: refs };
    return { status: 'active', capability };
  } catch (error) {
    return await rollback(`o teste da conexao falhou: ${describeError(error, secrets)}`);
  } finally {
    await deps.mcp.close(connection).catch(() => undefined);
  }
}

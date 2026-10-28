import { type Clock } from '../../../shared/clock.port.ts';
import { type IdGenerator } from '../../../shared/id.generator.port.ts';
import { type Sha256 } from '../../../../domain/capability/lifecycle/fingerprint.identity.ts';
import { type CatalogPlatform, type CatalogPort } from '../ports/catalog.port.ts';
import { type CapabilityStoresPort } from '../ports/capability.stores.port.ts';
import { type CredentialVault } from '../ports/credential.vault.ts';
import { type McpClientPort } from '../ports/mcp.client.port.ts';
import { type SkillSourcePort } from '../ports/skill.source.port.ts';

/** O que o motor de capacidades precisa (spec 034): armazenamento, catalogo, cliente MCP, cofre e relogio. */
export interface CapabilityEngineDeps {
  readonly stores: CapabilityStoresPort;
  readonly catalog: CatalogPort;
  readonly mcp: McpClientPort;
  readonly vault: CredentialVault;
  /** Fonte das skills; ausente = skills nao suportadas neste aparelho. */
  readonly skills?: SkillSourcePort | undefined;
  readonly platform: CatalogPlatform;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly sha256: Sha256;
  /** Servidor local de desenvolvimento (`http` em 127.0.0.1) liberado neste aparelho? */
  readonly allowInsecureLocal: () => boolean;
}

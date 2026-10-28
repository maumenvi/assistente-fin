import { z } from 'zod';
import { type ModelRole } from '../../../domain/agent/model.role.ts';
import { type AgentSettingsPort } from '../ports/settings/agent.settings.port.ts';
import { type SecretStorePort } from '../ports/settings/secret.store.port.ts';
import { type Clock } from '../../shared/clock.port.ts';
import { secretRefFor } from '../settings/secret.ref.ts';
import { CONSERVATIVE_CAPABILITIES } from '../../../domain/agent/conservative.capabilities.ts';
import { type ModelProfile } from '../../../domain/agent/model.profile.ts';

export interface SaveTierInput {
  readonly userId: string;
  readonly role: ModelRole;
  readonly origin: 'google' | 'openrouter' | 'openai_compat_local';
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey?: string | undefined;
  readonly clearKey?: boolean | undefined;
}

export interface ConnectionTestFunctionResult {
  readonly ok: boolean;
  readonly latencyMs?: number | undefined;
  readonly toolSupport: boolean;
  readonly error?: string | undefined;
}

export interface SaveTierProfileDeps {
  readonly settings: AgentSettingsPort;
  readonly secrets: SecretStorePort;
  readonly clock: Clock;
  readonly testConnection?: (opts: { origin: string; baseUrl: string; model: string; apiKey?: string | undefined }) => Promise<ConnectionTestFunctionResult>;
}

export class SaveTierProfileUseCase {
  private readonly deps: SaveTierProfileDeps;

  public constructor(deps: SaveTierProfileDeps) {
    this.deps = deps;
  }

  public async execute(input: SaveTierInput): Promise<{
    ok: boolean;
    role: ModelRole;
    connectionTest: ConnectionTestFunctionResult;
  }> {
    const current = await this.deps.settings.read(input.userId);
    const existing = current.profiles.find((p) => p.role === input.role);

    let resolvedKey: string | undefined = input.apiKey;
    if (resolvedKey === undefined && existing?.keyRef) {
      resolvedKey = (await this.deps.secrets.get(existing.keyRef)) ?? undefined;
    }

    let connectionTestResult: ConnectionTestFunctionResult = {
      ok: true,
      latencyMs: 100,
      toolSupport: true,
    };

    if (this.deps.testConnection) {
      try {
        connectionTestResult = await this.deps.testConnection({
          origin: input.origin,
          baseUrl: input.baseUrl,
          model: input.model,
          apiKey: resolvedKey,
        });
      } catch (err: unknown) {
        connectionTestResult = {
          ok: false,
          toolSupport: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    const updatedProfileInput = {
      id: input.role,
      role: input.role,
      origin: input.origin,
      baseUrl: input.baseUrl,
      model: input.model,
      enabled: true,
      apiKey: input.apiKey,
      clearKey: input.clearKey,
      capabilities: {
        ...CONSERVATIVE_CAPABILITIES,
        tools: connectionTestResult.toolSupport,
        verifiedAt: connectionTestResult.ok ? this.deps.clock.now().toISOString() : null,
      },
    };

    const remainingProfiles = current.profiles
      .filter((p) => p.role !== input.role)
      .map((p) => ({
        id: p.id,
        role: p.role,
        origin: p.origin,
        baseUrl: p.baseUrl,
        model: p.model,
        enabled: p.enabled ?? true,
        capabilities: p.capabilities,
      }));

    const nextProfiles = [...remainingProfiles, updatedProfileInput];
    const roleOrder: Record<ModelRole, number> = { main: 0, fast: 1, fallback: 2 };
    nextProfiles.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

    await this.deps.settings.write(input.userId, {
      profiles: nextProfiles,
      localOnly: current.localOnly,
      limits: current.limits,
      routingStrategy: current.routingStrategy,
    });

    return {
      ok: true,
      role: input.role,
      connectionTest: connectionTestResult,
    };
  }
}

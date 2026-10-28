import { type PreferenceStoresPort } from '../../app/agent/ports/preference/preference.stores.port.ts';
import { type PreferenceOverwriteStorePort } from '../../app/agent/ports/preference/preference.overwrite.store.port.ts';
import { type PreferenceStorePort } from '../../app/agent/ports/preference/preference.store.port.ts';
import { type SignalStorePort } from '../../app/agent/ports/preference/signal.store.port.ts';
import { type SuppressionStorePort } from '../../app/agent/ports/preference/suppression.store.port.ts';
import { type LearningSignal } from '../../domain/preference/learning.signal.ts';
import { type Preference } from '../../domain/preference/preference.ts';
import { type PreferenceOverwrite } from '../../domain/preference/preference.overwrite.ts';
import { type Suppression } from '../../domain/preference/suppression.ts';

function byCreation(a: Preference, b: Preference): number {
  return a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt);
}

class FakePreferenceStore implements PreferenceStorePort {
  public readonly rows = new Map<string, Preference>();

  public save(preference: Preference): Promise<void> {
    this.rows.set(preference.id, structuredClone(preference));
    return Promise.resolve();
  }

  public get(userId: string, id: string): Promise<Preference | null> {
    const found = this.rows.get(id);
    return Promise.resolve(found && found.userId === userId ? structuredClone(found) : null);
  }

  public list(userId: string, filter?: { readonly status?: readonly Preference['status'][] }): Promise<Preference[]> {
    const rows = [...this.rows.values()]
      .filter((p) => p.userId === userId && (filter?.status === undefined || filter.status.includes(p.status)))
      .sort(byCreation);
    return Promise.resolve(structuredClone(rows));
  }

  public supersede(userId: string, loserId: string, winnerId: string, at: string): Promise<void> {
    const loser = this.rows.get(loserId);
    const winner = this.rows.get(winnerId);
    if (loser && winner && loser.userId === userId && winner.userId === userId) {
      this.rows.set(loserId, { ...loser, status: 'disabled', supersededBy: winnerId, updatedAt: at });
    }
    return Promise.resolve();
  }

  public markUsed(userId: string, ids: readonly string[], at: string): Promise<void> {
    for (const id of ids) {
      const found = this.rows.get(id);
      if (found && found.userId === userId) this.rows.set(id, { ...found, lastUsedAt: at });
    }
    return Promise.resolve();
  }

  public markSourceRemoved(userId: string, conversationId: string): Promise<void> {
    for (const [id, p] of this.rows) {
      if (p.userId === userId && p.sourceConversationId === conversationId) this.rows.set(id, { ...p, sourceMessageRemoved: true });
    }
    return Promise.resolve();
  }

  public delete(userId: string, id: string): Promise<void> {
    const found = this.rows.get(id);
    if (found && found.userId === userId) this.rows.delete(id);
    return Promise.resolve();
  }

  public deleteAll(userId: string): Promise<void> {
    for (const [id, p] of [...this.rows]) if (p.userId === userId) this.rows.delete(id);
    return Promise.resolve();
  }
}

class FakeSignalStore implements SignalStorePort {
  public readonly rows: LearningSignal[] = [];

  public append(signal: LearningSignal): Promise<void> {
    if (!this.rows.some((r) => r.userId === signal.userId && r.messageId === signal.messageId && r.key === signal.key)) this.rows.push({ ...signal });
    return Promise.resolve();
  }

  public listByKey(userId: string, key: string, since: string): Promise<LearningSignal[]> {
    const rows = this.rows.filter((r) => r.userId === userId && r.key === key && r.at >= since).sort((a, b) => b.at.localeCompare(a.at));
    return Promise.resolve(structuredClone(rows));
  }

  public async countByKey(userId: string, key: string, since: string): Promise<number> {
    return (await this.listByKey(userId, key, since)).length;
  }

  public prune(userId: string, before: string, keepMax: number): Promise<void> {
    const mine = this.rows.filter((r) => r.userId === userId && r.at >= before).sort((a, b) => b.at.localeCompare(a.at));
    const keep = new Set(mine.slice(0, keepMax));
    for (let i = this.rows.length - 1; i >= 0; i -= 1) {
      const row = this.rows[i] as LearningSignal;
      if (row.userId === userId && !keep.has(row)) this.rows.splice(i, 1);
    }
    return Promise.resolve();
  }

  public deleteAll(userId: string): Promise<void> {
    for (let i = this.rows.length - 1; i >= 0; i -= 1) if ((this.rows[i] as LearningSignal).userId === userId) this.rows.splice(i, 1);
    return Promise.resolve();
  }
}

class FakeSuppressionStore implements SuppressionStorePort {
  public readonly rows = new Map<string, Suppression>();

  public put(suppression: Suppression): Promise<void> {
    this.rows.set(`${suppression.userId}|${suppression.key}`, { ...suppression });
    return Promise.resolve();
  }

  public isSuppressed(userId: string, key: string, now: string, evidence: number): Promise<boolean> {
    const found = this.rows.get(`${userId}|${key}`);
    return Promise.resolve(found !== undefined && found.until > now && evidence < found.strongEvidenceNeeded);
  }

  public deleteAll(userId: string): Promise<void> {
    for (const k of [...this.rows.keys()]) if (k.startsWith(`${userId}|`)) this.rows.delete(k);
    return Promise.resolve();
  }
}

class FakeOverwriteStore implements PreferenceOverwriteStorePort {
  public readonly rows = new Map<string, PreferenceOverwrite>();

  public record(overwrite: PreferenceOverwrite): Promise<void> {
    this.rows.set(overwrite.id, { ...overwrite });
    return Promise.resolve();
  }

  public get(userId: string, id: string): Promise<PreferenceOverwrite | null> {
    const found = this.rows.get(id);
    return Promise.resolve(found && found.userId === userId ? { ...found } : null);
  }

  public listUnseen(userId: string): Promise<PreferenceOverwrite[]> {
    return Promise.resolve([...this.rows.values()].filter((o) => o.userId === userId && o.seenAt === null).sort((a, b) => a.lostAt.localeCompare(b.lostAt)).map((o) => ({ ...o })));
  }

  public markSeen(userId: string, ids: readonly string[], at: string): Promise<void> {
    for (const id of ids) {
      const found = this.rows.get(id);
      if (found && found.userId === userId) this.rows.set(id, { ...found, seenAt: at });
    }
    return Promise.resolve();
  }

  public deleteAll(userId: string): Promise<void> {
    for (const [id, o] of [...this.rows]) if (o.userId === userId) this.rows.delete(id);
    return Promise.resolve();
  }
}

/** Preferencias, sinais, supressoes e sobrescritas em memoria (testes, avaliacoes, desenvolvimento). */
export class FakePreferenceStores implements PreferenceStoresPort {
  public readonly preferences: PreferenceStorePort = new FakePreferenceStore();
  public readonly signals: SignalStorePort = new FakeSignalStore();
  public readonly suppressions: SuppressionStorePort = new FakeSuppressionStore();
  public readonly overwrites: PreferenceOverwriteStorePort = new FakeOverwriteStore();

  public async deleteAll(userId: string): Promise<void> {
    await this.preferences.deleteAll(userId);
    await this.signals.deleteAll(userId);
    await this.suppressions.deleteAll(userId);
    await this.overwrites.deleteAll(userId);
  }
}

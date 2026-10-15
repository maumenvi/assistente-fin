import { type LimitsWidgetData } from './limits.widget.data.ts';
import { freshSnapshot, type LimitsWidgetSnapshot } from './limits.widget.snapshot.ts';

/** O que o widget precisa para se desenhar. */
export interface LimitsWidgetFrame {
  readonly snapshot: LimitsWidgetSnapshot | null;
  /** Recalculo em andamento. */
  readonly refreshing: boolean;
  /** `false` = primeiro uso nao concluido no app. */
  readonly hasUser: boolean;
}

/** Entradas e saidas da atualizacao (reais no app; simuladas nos testes). */
export interface LimitsWidgetRefreshPorts {
  readSnapshot(): Promise<LimitsWidgetSnapshot | null>;
  writeSnapshot(snapshot: LimitsWidgetSnapshot): Promise<void>;
  /** Dados atuais; `null` = sem usuario no aparelho. */
  compute(): Promise<LimitsWidgetData | null>;
  draw(frame: LimitsWidgetFrame): Promise<void>;
  now(): Date;
}

/**
 * Atualiza o widget de limites em dois tempos (spec 023, T011; FR-006..FR-008):
 *
 * 1. desenha o resumo guardado na hora (sem abrir o banco) - ou "carregando", sem resumo;
 * 2. recalcula, guarda o resumo novo e redesenha.
 *
 * Se o recalculo falhar, mantem os dados do resumo, marca a falha (o widget mostra "atualizado ha
 * X") e redesenha - nunca fica em branco.
 */
export async function refreshLimitsWidget(ports: LimitsWidgetRefreshPorts): Promise<void> {
  const cached = await ports.readSnapshot().catch(() => null);
  await ports.draw({ snapshot: cached, refreshing: true, hasUser: true });
  let data: LimitsWidgetData | null;
  try {
    data = await ports.compute();
  } catch {
    const failed = cached === null ? null : { ...cached, lastAttemptFailedAt: ports.now().toISOString() };
    if (failed !== null) await ports.writeSnapshot(failed).catch(() => undefined);
    await ports.draw({ snapshot: failed, refreshing: false, hasUser: true });
    return;
  }
  if (data === null) {
    await ports.draw({ snapshot: null, refreshing: false, hasUser: false });
    return;
  }
  const snapshot = freshSnapshot(data, ports.now());
  await ports.writeSnapshot(snapshot).catch(() => undefined);
  await ports.draw({ snapshot, refreshing: false, hasUser: true });
}

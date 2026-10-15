import { type CaptureDiagnostic } from '../../app/capture/capture.diagnostic.ts';
import { CAPTURE_DIAGNOSTICS_LIMIT, type CaptureDiagnosticsStore } from '../../app/capture/capture.diagnostics.store.port.ts';

/** TEMPORARIO (spec 027, FR-012) - remover em spec futura. Log de diagnostico em memoria. */
export class FakeCaptureDiagnosticsStore implements CaptureDiagnosticsStore {
  private entries: CaptureDiagnostic[] = [];

  public async append(entry: CaptureDiagnostic): Promise<void> {
    this.entries = [entry, ...this.entries].slice(0, CAPTURE_DIAGNOSTICS_LIMIT);
  }

  public async list(): Promise<CaptureDiagnostic[]> {
    return [...this.entries];
  }
}

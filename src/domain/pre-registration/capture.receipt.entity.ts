import { InvalidPreRegistrationError } from './invalid.pre.registration.error.ts';
import { CAPTURE_RECEIPT_RESOLUTIONS, type CaptureReceiptResolution } from './capture.receipt.resolution.ts';

/** Dados de um recibo ja persistido. */
export interface CaptureReceiptPersistenceProps {
  readonly userId: string;
  readonly captureKey: string;
  readonly preRegistrationId: string;
  readonly resolution: CaptureReceiptResolution;
  /** `updatedAt` (ISO) do pre-registro logo depois da captura; outro valor = o usuario editou. */
  readonly captureVersion: string | null;
  readonly createdAt: Date;
  readonly resolvedAt: Date | null;
}

/**
 * Recibo de captura (spec 027, research R2/R4): uma compra capturada da carteira, identificada
 * pela `captureKey`. Nasce `pending`; vira `approved`/`discarded` junto com o pre-registro e
 * fica um tempo para barrar reentregas da mesma notificacao (FR-004). Imutavel.
 */
export class CaptureReceipt {
  public readonly userId: string;
  public readonly captureKey: string;
  public readonly preRegistrationId: string;
  public readonly resolution: CaptureReceiptResolution;
  public readonly captureVersion: string | null;
  public readonly createdAt: Date;
  public readonly resolvedAt: Date | null;

  private constructor(props: CaptureReceiptPersistenceProps) {
    this.userId = props.userId;
    this.captureKey = props.captureKey;
    this.preRegistrationId = props.preRegistrationId;
    this.resolution = props.resolution;
    this.captureVersion = props.captureVersion;
    this.createdAt = props.createdAt;
    this.resolvedAt = props.resolvedAt;
  }

  /** Recibo novo, pendente. */
  public static create(props: { userId: string; captureKey: string; preRegistrationId: string; createdAt: Date }): CaptureReceipt {
    return CaptureReceipt.fromPersistence({ ...props, resolution: 'pending', captureVersion: null, resolvedAt: null });
  }

  /** Remonta um recibo persistido, revalidando a situacao. */
  public static fromPersistence(props: CaptureReceiptPersistenceProps): CaptureReceipt {
    if (!(CAPTURE_RECEIPT_RESOLUTIONS as readonly string[]).includes(props.resolution)) {
      throw new InvalidPreRegistrationError(`situacao de recibo desconhecida: ${props.resolution}`);
    }
    if (props.captureKey.trim() === '') throw new InvalidPreRegistrationError('recibo sem chave de captura');
    return new CaptureReceipt(props);
  }

  /** `true` enquanto o pre-registro da captura esta pendente. */
  public get isPending(): boolean {
    return this.resolution === 'pending';
  }

  /** Resolve o recibo; idempotente para a mesma resolucao, nunca troca uma ja dada. */
  public resolve(resolution: Exclude<CaptureReceiptResolution, 'pending'>, at: Date): CaptureReceipt {
    if (this.resolution === resolution) return this;
    if (!this.isPending) throw new InvalidPreRegistrationError(`recibo ja resolvido como ${this.resolution}`);
    return new CaptureReceipt({ ...this.props(), resolution, resolvedAt: at });
  }

  /** Mesmo recibo apontando para outro pre-registro (spec 028: "juntar" repontua os recibos do descartado). */
  public withPreRegistrationId(preRegistrationId: string): CaptureReceipt {
    if (preRegistrationId.trim() === '') throw new InvalidPreRegistrationError('recibo sem pre-registro');
    return new CaptureReceipt({ ...this.props(), preRegistrationId });
  }

  /** Guarda a versao do pre-registro escrita pela captura (para saber se o usuario editou). */
  public withCaptureVersion(captureVersion: string | null): CaptureReceipt {
    return new CaptureReceipt({ ...this.props(), captureVersion });
  }

  private props(): CaptureReceiptPersistenceProps {
    return {
      userId: this.userId,
      captureKey: this.captureKey,
      preRegistrationId: this.preRegistrationId,
      resolution: this.resolution,
      captureVersion: this.captureVersion,
      createdAt: this.createdAt,
      resolvedAt: this.resolvedAt,
    };
  }
}

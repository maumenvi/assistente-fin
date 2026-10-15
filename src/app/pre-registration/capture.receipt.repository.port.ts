import { type CaptureReceipt } from '../../domain/pre-registration/capture.receipt.entity.ts';

/** Porta dos recibos de captura (spec 027, R2/R4). Escopo sempre por usuario. */
export interface CaptureReceiptRepository {
  /**
   * Grava o recibo se a `(userId, captureKey)` ainda nao existe. `true` = gravou; `false` = ja
   * havia. ATOMICO pela chave unica do banco - vale entre conexoes diferentes.
   */
  insertIfAbsent(receipt: CaptureReceipt): Promise<boolean>;
  findByKey(userId: string, captureKey: string): Promise<CaptureReceipt | null>;
  findByPreRegistration(userId: string, preRegistrationId: string): Promise<CaptureReceipt | null>;
  /**
   * Todos os recibos de um pre-registro, do mais antigo (o da criacao) ao mais novo (spec 028, R2):
   * varias chaves de notificacao podem apontar para o mesmo pre-registro.
   */
  listByPreRegistration(userId: string, preRegistrationId: string): Promise<CaptureReceipt[]>;
  /** Atualiza resolucao/versao de um recibo existente. */
  save(receipt: CaptureReceipt): Promise<void>;
  /** Apaga recibos RESOLVIDOS antes de `before` (pendentes nunca); devolve quantos. */
  purgeResolvedBefore(userId: string, before: Date): Promise<number>;
}

import { type PairedDevice } from './paired.device.ts';

/** Porta dos aparelhos pareados (tabela `paired_devices`, spec 022, T109). */
export interface PairedDeviceRepository {
  save(device: PairedDevice): Promise<void>;
  findById(id: string): Promise<PairedDevice | null>;
  listByUser(userId: string): Promise<PairedDevice[]>;
  /** Ha algum aparelho pareado e nao revogado? (spec 024: o hub escuta sozinho, FR-024) */
  hasActive(): Promise<boolean>;
}

import { type Cipher } from '../shared/cipher.port.ts';
import { type Clock } from '../shared/clock.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type SecretGenerator } from '../shared/secret.generator.port.ts';
import { type PairedDeviceRepository } from './paired.device.repository.port.ts';
import { type PairedDevice } from './paired.device.ts';
import { PairingError } from './pairing.error.ts';
import { type PairingRegistry } from './pairing.registry.ts';
import { encodePairingQr, type PairingQrPayload } from './pairing.qr.payload.ts';

/** O que o celular recebe ao concluir o pareamento. */
export interface DeviceCredentials {
  readonly deviceId: string;
  readonly token: string;
  readonly deviceKey: string;
  readonly userId: string;
}

/**
 * Pareamento do celular com o hub (spec 022, T114; contracts/pairing-qr.md): gera o QR v2
 * (enderecos + segredo de uso unico) e, quando o celular apresenta o segredo, cria o aparelho
 * com token e chave proprios. Revogar corta o acesso (FR-014). Autenticar confere token e
 * revogacao a cada chamada.
 */
export class PairDeviceUseCase {
  private readonly devices: PairedDeviceRepository;
  private readonly registry: PairingRegistry;
  private readonly secrets: SecretGenerator;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;
  private readonly localCipher: Cipher;

  public constructor(
    devices: PairedDeviceRepository,
    registry: PairingRegistry,
    secrets: SecretGenerator,
    ids: IdGenerator,
    clock: Clock,
    localCipher: Cipher,
  ) {
    this.devices = devices;
    this.registry = registry;
    this.secrets = secrets;
    this.ids = ids;
    this.clock = clock;
    this.localCipher = localCipher;
  }

  /** Abre um QR novo (invalida o anterior). */
  public openQr(userId: string, hub: { hubId: string; hosts: readonly string[]; port: number }): { payload: PairingQrPayload; text: string } {
    const pairing = this.registry.open({ pairingId: this.ids.next(), userId, secret: this.secrets.randomHex(32) }, this.clock.now());
    const payload: PairingQrPayload = {
      v: 2,
      hubId: hub.hubId,
      hosts: [...hub.hosts],
      port: hub.port,
      pairingId: pairing.pairingId,
      secret: pairing.secret,
      expiresAt: pairing.expiresAt.toISOString(),
    };
    return { payload, text: encodePairingQr(payload) };
  }

  /** Consome o QR (uso unico) e devolve o segredo dele, para abrir o pedido do celular. */
  public takePairing(pairingId: string): { userId: string; secret: string } {
    const pairing = this.registry.take(pairingId, this.clock.now());
    return { userId: pairing.userId, secret: pairing.secret };
  }

  /** Cria o aparelho com credenciais proprias. */
  public async register(userId: string, deviceName: string): Promise<DeviceCredentials> {
    const token = this.secrets.randomHex(32);
    const deviceKey = this.secrets.randomHex(32);
    const device: PairedDevice = {
      id: this.ids.next(),
      userId,
      name: deviceName.trim().slice(0, 60) || 'Celular',
      tokenHash: this.secrets.sha256Hex(token),
      keyCiphertext: this.localCipher.encrypt(deviceKey),
      createdAt: this.clock.now(),
      lastSeenAt: null,
      revokedAt: null,
    };
    await this.devices.save(device);
    return { deviceId: device.id, token, deviceKey, userId };
  }

  /** Confere token e revogacao; devolve o aparelho e a chave do envelope dele. */
  public async authenticate(deviceId: string, token: string): Promise<{ device: PairedDevice; deviceKey: string }> {
    const device = await this.devices.findById(deviceId);
    if (!device || device.tokenHash !== this.secrets.sha256Hex(token)) throw new PairingError('DEVICE_UNKNOWN', 'aparelho desconhecido');
    if (device.revokedAt !== null) throw new PairingError('DEVICE_REVOKED', 'aparelho revogado');
    const deviceKey = this.openDeviceKey(device);
    await this.devices.save({ ...device, lastSeenAt: this.clock.now() });
    return { device, deviceKey };
  }

  /**
   * Chave do envelope do aparelho SEM o token (spec 024, desafio `ping`): o celular prova que tem a
   * chave e o hub prova que a conhece, sem o token trafegar ate um endereco ainda nao confirmado.
   * Nao marca `lastSeenAt` - so a sincronizacao de fato conta como uso.
   */
  public async deviceKeyFor(deviceId: string): Promise<{ device: PairedDevice; deviceKey: string }> {
    const device = await this.devices.findById(deviceId);
    if (!device) throw new PairingError('DEVICE_UNKNOWN', 'aparelho desconhecido');
    if (device.revokedAt !== null) throw new PairingError('DEVICE_REVOKED', 'aparelho revogado');
    return { device, deviceKey: this.openDeviceKey(device) };
  }

  /**
   * Chave do aparelho decifrada com a chave local desta instalacao. Pareado por outra instalacao
   * (config refeita do zero): nao abre - vira "aparelho desconhecido" (401), nao erro interno, e o
   * celular pede novo pareamento sem perder o que nao enviou (spec 024, FR-026).
   */
  private openDeviceKey(device: PairedDevice): string {
    try {
      return this.localCipher.decrypt(device.keyCiphertext);
    } catch {
      throw new PairingError('DEVICE_UNKNOWN', 'aparelho pareado por outra instalacao do desktop');
    }
  }

    /** Revoga um aparelho do usuario (FR-014). */
  public async revoke(userId: string, deviceId: string): Promise<void> {
    const device = await this.devices.findById(deviceId);
    if (!device || device.userId !== userId) throw new PairingError('DEVICE_UNKNOWN', 'aparelho desconhecido');
    await this.devices.save({ ...device, revokedAt: this.clock.now() });
  }

  /** Ha celular pareado e nao revogado? O hub entao escuta sozinho (spec 024, FR-024). */
  public hasActiveDevice(): Promise<boolean> {
    return this.devices.hasActive();
  }

  /** Aparelhos do usuario (tela de pareamento do desktop). */
  public list(userId: string): Promise<PairedDevice[]> {
    return this.devices.listByUser(userId);
  }
}

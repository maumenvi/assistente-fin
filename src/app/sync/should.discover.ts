/** Intervalo minimo entre buscas automaticas enquanto o desktop nao e encontrado. */
const MIN_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Vale varrer a rede atras do desktop agora? (spec 024, contracts/hub-discovery.md). Toda acao do
 * usuario busca na hora; o agendador automatico espera 2 min entre buscas enquanto o desktop esta
 * sumido, para nao gastar bateria e rede a cada volta ao primeiro plano.
 */
export function shouldDiscover(input: { unreachable: boolean; lastDiscoveryAt: Date | null; now: Date; manual: boolean }): boolean {
  if (input.manual) return true;
  if (!input.unreachable || input.lastDiscoveryAt === null) return true;
  return input.now.getTime() - input.lastDiscoveryAt.getTime() >= MIN_INTERVAL_MS;
}

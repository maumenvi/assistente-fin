/**
 * Decide o "ultima escrita vence" (spec 032): a versao que chega so vence se for ESTRITAMENTE mais
 * recente que a atual. No empate vale a que ja esta no hub (o hub e a autoridade), o que torna o
 * desfecho o mesmo nos dois aparelhos.
 */
export function incomingWins(incomingUpdatedAt: string, currentUpdatedAt: string): boolean {
  return new Date(incomingUpdatedAt).getTime() > new Date(currentUpdatedAt).getTime();
}

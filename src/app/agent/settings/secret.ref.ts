/** Nome da entrada do cofre que guarda a chave de API de um perfil de um usuario. */
export function secretRefFor(userId: string, profileId: string): string {
  return `agent.key.${userId}.${profileId}`;
}

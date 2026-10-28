/**
 * Sugestao de preferencia na propria conversa (spec 032, FR-005): aviso discreto, de um toque,
 * ignoravel. `state` acompanha a decisao do usuario.
 */
export interface SuggestionPart {
  readonly type: 'suggestion';
  readonly preferenceId: string;
  readonly text: string;
  readonly state: 'open' | 'confirmed' | 'dismissed';
}

import { type PreRegistration } from './pre.registration.entity.ts';
import { type DuplicateGroup } from './duplicate.group.ts';

function oldestFirst(a: PreRegistration, b: PreRegistration): number {
  return a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
}

/**
 * Agrupa os pendentes ligados por `possibleDuplicateOf` (spec 028, research R5): so conta quando o
 * alvo e um pre-registro pendente da propria lista e nenhum dos dois foi revisado ("sao compras
 * diferentes"). Apontar para um LANCAMENTO nao forma grupo - o aviso fica para a aprovacao.
 * Componentes com 2+ itens; membros do mais antigo ao mais recente; grupos pelo membro mais
 * recente, mais recentes primeiro.
 */
export function groupPossibleDuplicates(pending: readonly PreRegistration[]): DuplicateGroup[] {
  const byId = new Map(pending.map((pre) => [pre.id, pre]));
  const parent = new Map<string, string>(pending.map((pre) => [pre.id, pre.id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  for (const pre of pending) {
    const target = pre.possibleDuplicateOf === null ? undefined : byId.get(pre.possibleDuplicateOf);
    if (target === undefined || pre.duplicateReviewed || target.duplicateReviewed) continue;
    parent.set(find(pre.id), find(target.id));
  }
  const components = new Map<string, PreRegistration[]>();
  for (const pre of pending) {
    const root = find(pre.id);
    components.set(root, [...(components.get(root) ?? []), pre]);
  }
  return [...components.values()]
    .filter((members) => members.length >= 2)
    .map((members) => ({ members: [...members].sort(oldestFirst) }))
    .sort((a, b) => newest(b).getTime() - newest(a).getTime());
}

function newest(group: DuplicateGroup): Date {
  return group.members.reduce((latest, pre) => (pre.createdAt > latest ? pre.createdAt : latest), group.members[0]!.createdAt);
}

import { type Database } from '../../shared/database.port.ts';
import { type AiBlockIssue } from '../errors/ai.block.invalid.error.ts';
import { type AgentOp } from '../format/agent.op.ts';

/**
 * Confere que contas e categorias citadas no bloco existem (spec 029, FR-004, R2): o agente deve usar
 * os ids enviados, nunca nomes soltos. Devolve um problema por referencia desconhecida, sem repetir
 * valores do usuario. `categoryName` nao e referencia (o app cria ou reaproveita a categoria).
 */
export async function resolveReferences(database: Database, userId: string, op: AgentOp, opIndex: number): Promise<AiBlockIssue[]> {
  const issues: AiBlockIssue[] = [];
  const data = op.data ?? {};
  const accountId = data['accountId'];
  if (typeof accountId === 'string') {
    const account = await database.accounts.findById(userId, accountId);
    if (account === null) issues.push({ opIndex, path: 'data.accountId', message: 'conta nao encontrada: use um id de conta dos dados enviados' });
    else if (account.archived) issues.push({ opIndex, path: 'data.accountId', message: 'a conta esta arquivada' });
  }
  const categoryId = data['categoryId'];
  if (typeof categoryId === 'string' && (await database.categories.findById(userId, categoryId)) === null) {
    issues.push({ opIndex, path: 'data.categoryId', message: 'categoria nao encontrada: use um id de categoria dos dados enviados' });
  }
  return issues;
}

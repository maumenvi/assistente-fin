import { type z } from 'zod';
import { type AiBlockIssue } from '../errors/ai.block.invalid.error.ts';

/**
 * Traduz os erros do zod para problemas por operacao, sem repetir valores do usuario (spec 029,
 * R14): so o indice da operacao, o caminho do campo e a mensagem da regra.
 */
export function toBlockIssues(error: z.ZodError): AiBlockIssue[] {
  return error.issues.map((issue) => {
    const [root, index, ...rest] = issue.path;
    if (root === 'ops' && typeof index === 'number') {
      return { opIndex: index, path: rest.map(String).join('.'), message: issue.message };
    }
    return { opIndex: -1, path: issue.path.map(String).join('.'), message: issue.message };
  });
}

import { type FileGate } from '../../ports/tool/file.gate.ts';
import { type ToolContext } from '../../ports/tool/tool.context.ts';

/** A porta de permissao da execucao; sem ela a ferramenta nao acessa nada (falha fechada). */
export function requireFileGate(ctx: ToolContext): FileGate {
  if (ctx.files === undefined) throw new Error('acesso a arquivos indisponivel');
  return ctx.files;
}

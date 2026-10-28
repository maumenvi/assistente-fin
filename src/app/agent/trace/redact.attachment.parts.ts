import { READ_ATTACHMENT_TOOL } from '../../../domain/agent/attachment/attachment.tool.name.ts';
import { redactFileToolArgs } from './redact.file.tool.args.ts';
import { type LlmContentPart } from '../ports/llm/llm.content.part.ts';
import { type LlmMessage } from '../ports/llm/llm.message.ts';

const BLOCK = /<dado_externo\s+origem="anexo"([^>]*)>([\s\S]*?)<\/dado_externo>/g;

function attr(attrs: string, name: string): string {
  return new RegExp(`${name}="([^"]*)"`).exec(attrs)?.[1] ?? '?';
}

/** Troca o conteudo de blocos de anexo e de imagens por um marcador sem conteudo: nome, tipo e tamanho. */
function redactParts(parts: readonly LlmContentPart[]): LlmContentPart[] {
  return parts.map((part) => {
    if (part.type === 'image') return { type: 'text', text: `[anexo: imagem · ${part.mediaType} · ${part.dataBase64.length} caracteres]` };
    return { type: 'text', text: part.text.replace(BLOCK, (_all, attrs: string, body: string) => `[anexo: ${attr(attrs, 'nome')} · ${attr(attrs, 'tipo')} · ${body.length} caracteres]`) };
  });
}

/**
 * Tira dos pedidos gravados no trace (`StepDetail.request`) todo conteudo de anexo (spec 036, FR-015): blocos `<dado_externo origem="anexo">`,
 * partes de imagem, o resultado da ferramenta `read_attachment` e (spec 040) o de `read_file` e o conteudo gravado por `create_file`/`edit_file`. Funcao pura; so nome, tipo e tamanho ficam.
 */
export function redactAttachmentParts(messages: readonly LlmMessage[]): LlmMessage[] {
  const readCalls = new Set<string>();
  const fileCalls = new Set<string>();
  return messages.map((message): LlmMessage => {
    if (message.role === 'user') return { ...message, content: redactParts(message.content) };
    if (message.role === 'assistant') {
      for (const call of message.toolCalls ?? []) {
        if (call.name === READ_ATTACHMENT_TOOL) readCalls.add(call.id);
        if (call.name === 'read_file') fileCalls.add(call.id);
      }
      const toolCalls = message.toolCalls?.map((call) => ({ ...call, args: redactFileToolArgs(call.name, call.args) }));
      return { ...message, content: redactParts(message.content), ...(toolCalls === undefined ? {} : { toolCalls }) };
    }
    if (readCalls.has(message.toolCallId)) return { ...message, content: `[anexo: leitura · ${message.content.length} caracteres]` };
    if (fileCalls.has(message.toolCallId)) return { ...message, content: `[arquivo: leitura · ${message.content.length} caracteres]` };
    return message;
  });
}

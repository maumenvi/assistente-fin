import { INTENTS } from '../../../domain/agent/intent.ts';
import { type JsonSchema } from '../ports/llm/json.schema.ts';

/** Instrucao do classificador de intencao (modelo rapido), com saida `{ intent, confidence }`. */
export function routerSystemPrompt(): string {
  return [
    'Classifique o pedido do usuário de um app de finanças pessoais em UMA intenção:',
    '- direct: conversa simples (saudação, agradecimento, "o que você faz?"), sem consultar dados;',
    '- query: precisa consultar saldos, lançamentos, cartões, limites, previsão, ganhos ou gastos fixos, ou de um dado externo (cotação de moeda, planejamento de aposentadoria);',
    '- write_request: pede para lançar, criar, editar, apagar ou pagar algo;',
    '- settings_request: pede para mudar autonomia, aprovação automática, privacidade, consentimento, chave de API ou modo local;',
    '- preference: diz, pede para esquecer ou pergunta sobre uma preferência de uso ("prefiro respostas curtas", "esqueça isso", "o que você sabe sobre mim?");',
    '- out_of_scope: assunto fora de finanças pessoais do app.',
    'Responda apenas com JSON: {"intent": "...", "confidence": número de 0 a 1}.',
  ].join('\n');
}

/** Schema da saida estruturada do classificador. */
export const ROUTER_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: [...INTENTS] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['intent', 'confidence'],
  additionalProperties: false,
};

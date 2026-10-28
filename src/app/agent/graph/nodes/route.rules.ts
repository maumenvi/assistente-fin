import { type Intent } from '../../../../domain/agent/intent.ts';
import { isGuardedPolicy } from '../../../../domain/preference/guard/is.guarded.policy.ts';
import { normalizeForRules } from './normalize.for.rules.ts';

const CHANGE_VERBS =
  /\b(mude|mudar|muda|altere|alterar|ative|ativar|desative|desativar|configure|configurar|troque|trocar|permita|permitir|libere|liberar|habilite|habilitar|desabilite|desabilitar|ligue|ligar|desligue|desligar|defina|definir|coloque|colocar|remova|remover)\b/;
const SETTINGS_TOPICS =
  /\b(autonomia|aprovar sozinho|aprova sozinho|aprovacao automatica|aprovar automaticamente|aprovar automatico|privacidade|consentimento|chave de api|chave da api|modo local|somente local|apenas local|so local)\b/;

/** Formas imperativas: sempre pedido de escrita. */
const WRITE_IMPERATIVE =
  /\b(lance|registre|crie|adicione|apague|exclua|altere|edite|pague|transfira|cadastre|remova|deleta|delete|insira|marque como pago|classifique|classifica|reclassifique|reclassifica|categorize|categoriza|recategorize|recategoriza|renomeie|corrija)\b|\b(arrume|arruma|organize|organiza)\b.*\b(categoria\w*|pendente\w*|lancamento\w*)\b/;
/** Infinitivos: so contam como pedido quando vem de "quero/pode/preciso...". */
const WRITE_INFINITIVE = /\b(lancar|registrar|criar|adicionar|apagar|excluir|alterar|editar|pagar|transferir|cadastrar|inserir|classificar|reclassificar|categorizar|recategorizar|renomear|corrigir|arrumar)\b/;
/** Com anexo no turno (spec 036), estes verbos tambem pedem para gravar o conteudo do arquivo ("lance isso", "importe o extrato"). */
const ATTACHMENT_WRITE = /\b(importe|importar|inclua|incluir|lance|lancar|registre|registrar|cadastre|cadastrar|adicione|adicionar|salve|salvar|coloque|colocar|ponha|bote|botar|passe|passar|jogue|jogar)\b/;
const REQUEST_LEAD = /\b(quero|queria|gostaria de|preciso|precisava|pode|poderia|consegue|vamos|favor|por favor|bora)\b/;

const GREETING =
  /^(oi|ola|opa|e ai|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|muito obrigad[oa]|tchau|ate (mais|logo)|ok|certo|beleza|entendi|show|legal|perfeito|tudo bem|como vai|quem e voce|o que voce faz|o que voce pode fazer)\b/;

const OUT_OF_SCOPE =
  /\b(receita de|previsao do tempo|clima|futebol|filme|serie|musica|piada|poema|poesia|horoscopo|video ?game|codigo|programacao|traduz|traduza|historia do|capital d[aeo]|quem ganhou)\b/;

/** Pedidos que dependem de dado externo (spec 034): vao ao laco com ferramentas, onde o agente pode pedir uma capacidade. */
const EXTERNAL_DATA = /\b(cotacao|cotacoes|cambio|dolar|dolares|euro|euros|moeda\w*|convert\w*|convers\w*|aposentadoria|previdencia)\b/;

/** Pedido para retomar ou completar a resposta anterior. */
const FOLLOW_UP =
  /\b(continue|continua|continuar|prossiga|termine|terminar|complete|completa|incompleto|incompleta|cortou|cortada|faltou|falta o resto|estend\w*)\b|^(sim|s|pode sim|quero sim)\b/;

/** Termos que so existem no dominio financeiro: vencem qualquer assunto externo. */
const STRONG_DOMAIN = /\b(saldo\w*|gast\w*|fatura\w*|cartao|cartoes|limite\w*|lancamento\w*|extrato|categoria\w*|categoriz\w*|classific\w*|pendente\w*|despesa\w*|salario\w*|orcamento|parcela\w*)\b|r\$/;

/** Palavras do dominio financeiro do app: com elas, o pedido e uma consulta. */
const DOMAIN =
  /\b(gast\w*|saldo\w*|conta\w*|cartao|cartoes|fatura\w*|limite\w*|lancamento\w*|categoria\w*|categoriz\w*|classific\w*|pendente\w*|ganh\w*|renda\w*|salario\w*|dinheiro|quanto|quantos|quantas|extrato|previs\w*|parcela\w*|orcamento|economi\w*|dev[oe]\w*|pagu\w*|receb\w*|mes|meses|mercado|aluguel|despesa\w*|receita\w*|fixo\w*|mensal|semana|hoje|ontem|ano)\b|r\$/;

/** Dizer, esquecer ou listar uma preferencia de uso (spec 032): vence escrita e consulta. */
const PREFERENCE_STATEMENT = /\b(prefiro|preferia|prefere)\b|\b(sempre|nunca) (me )?(mostre|mostrar|use|usar|responda|responder|fale|falar|explique|explicar|resuma|resumir|traga|trazer|coloque|colocar|ponha|exiba|exibir|liste|listar|escreva|comece|comecar|termine)\b|\bde agora em diante\b|\ba partir de agora\b|\b(lembre|lembra|anote|guarde|memorize) que\b/;
const PREFERENCE_FORGET = /\b(esqueca|esquece|esquecer) (isso|aquilo|essa|esta|a preferencia|as preferencias|o que eu (disse|falei|pedi)|tudo (o )?que (voce )?(sabe|guardou) sobre mim)\b|\b(apague|apaga|remova|remove|exclua|delete) (essa |esta |a )?(preferencia|isso|aquilo)\b/;
const PREFERENCE_LIST = /\bo que voce (sabe|lembra) (sobre|de) mim\b|\b(minhas|quais( sao)?( as)?( minhas)?) preferencias\b|\bo que (voce )?guardou sobre mim\b/;

/**
 * Regras de roteamento em pt-BR, sem modelo (spec 031, T068). Devolve a intencao quando as
 * regras bastam e `null` quando o pedido e inconclusivo (so entao o roteador chama o modelo
 * rapido). Ordem: configuracao (inclusive autonomia/privacidade, spec 032 FR-009) > preferencia >
 * escrita > dado externo (spec 034) > saudacao > fora do assunto > consulta.
 */
export function routeByRules(rawText: string, options: { readonly hasAttachments?: boolean } = {}): Intent | null {
  const text = normalizeForRules(rawText).trim();
  if ((CHANGE_VERBS.test(text) && SETTINGS_TOPICS.test(text)) || isGuardedPolicy(rawText)) return 'settings_request';
  if (PREFERENCE_STATEMENT.test(text) || PREFERENCE_FORGET.test(text) || PREFERENCE_LIST.test(text)) return 'preference';
  if (WRITE_IMPERATIVE.test(text)) return 'write_request';
  if (options.hasAttachments === true && ATTACHMENT_WRITE.test(text)) return 'write_request';
  if (WRITE_INFINITIVE.test(text) && REQUEST_LEAD.test(text)) return 'write_request';
  if (EXTERNAL_DATA.test(text)) return 'query';
  // "continue", "ficou incompleto"...: segue a conversa com as ferramentas, nao e conversa solta nem fora do assunto
  if (FOLLOW_UP.test(text)) return 'query';
  if (OUT_OF_SCOPE.test(text) && !STRONG_DOMAIN.test(text)) return 'out_of_scope';
  const hasDomain = DOMAIN.test(text);
  if (!hasDomain && GREETING.test(text) && text.split(/\s+/).length <= 6) return 'direct';
  if (hasDomain) return 'query';
  return null;
}

import { type FileRequestView } from './file.request.view.ts';
import { type ChatBanner } from './chat.banner.ts';
import { type ViewMessage } from './view.message.ts';

/** Execucao em andamento, para o indicador de etapa e o botao Parar. */
export interface ActiveRunView {
  readonly runId: string;
  readonly node: string | null;
  readonly label: string;
  readonly stoppable: boolean;
}

/** Estado da tela de conversa (contracts/agent.events.md). */
export interface ChatViewState {
  readonly conversationId: string | null;
  readonly messages: readonly ViewMessage[];
  readonly activeRun: ActiveRunView | null;
  /** A ultima resposta nao terminou bem: a tela oferece "Tentar de novo". */
  readonly canRetryLast: boolean;
  readonly banner: ChatBanner | null;
  /** Ha mensagens mais antigas para carregar (a pagina carregada veio cheia). */
  readonly hasOlder: boolean;
  /** Pedidos de pasta e de edicao esperando a pessoa decidir no chat (spec 040). */
  readonly fileRequests: readonly FileRequestView[];
  /** Ultimo `seq` visto da execucao corrente (descarta repeticao e atraso). */
  readonly lastEvent: { readonly runId: string; readonly seq: number } | null;
}

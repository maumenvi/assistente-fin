import { type AttachmentPart } from './attachment/attachment.part.ts';
import { type CapabilityRequestPart } from './capability.request.part.ts';
import { type NoticePart } from './notice.part.ts';
import { type PlanPart } from './plan.part.ts';
import { type PreferencesAppliedPart } from './preferences.applied.part.ts';
import { type QueryPart } from './query.part.ts';
import { type ReportSavedPart } from './report/report.saved.part.ts';
import { type SuggestionPart } from './suggestion.part.ts';
import { type SummaryMarkerPart } from './summary.marker.part.ts';
import { type TextPart } from './text.part.ts';

/**
 * Parte de uma mensagem do agente. A spec 032 acrescentou sugestao de preferencia, preferencias aplicadas e a marca do
 * resumo; a 033 acrescentou o cartao do plano; a 034 acrescenta o pedido de capacidade; a 036 acrescenta o anexo; a 040 acrescenta o relatorio salvo.
 */
export type MessagePart = TextPart | QueryPart | NoticePart | SuggestionPart | PreferencesAppliedPart | SummaryMarkerPart | PlanPart | CapabilityRequestPart | AttachmentPart | ReportSavedPart;

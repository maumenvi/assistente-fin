import { normalizeText } from '../normalize.text.ts';

const PATTERNS: readonly RegExp[] = [
  /\b(saude|doenca\w*|remedio\w*|medicament\w*|diagnostic\w*|cancer|depress\w*|ansiedade|psicolog\w*|psiquiatr\w*|terapia|gravidez|gestante|hiv|diabet\w*|tratamento medico|consulta medica)\b/,
  /\b(cpf|rg|cnh|passaporte|titulo de eleitor|documento pessoal|documentos pessoais)\b/,
  /\b(religiao|religios\w*|igreja|evangelic\w*|catolic\w*|umbanda|candomble|ateu|budis\w*|espirit\w*)\b/,
  /\b(orientacao sexual|gay|lesbica|homossexual|bissexual|transgenero|trans)\b/,
  /\b(politic\w*|partido|eleicao|eleicoes|voto em|lula|bolsonaro)\b/,
  /\b(biometri\w*|impressao digital|reconhecimento facial)\b/,
];

/**
 * Dado pessoal sensivel (saude, documentos pessoais, religiao, orientacao sexual, politica,
 * biometria) dito de passagem: nunca vira preferencia nem sinal de aprendizado (spec 032, FR-008).
 */
export function isSensitiveTopic(text: string): boolean {
  const normalized = normalizeText(text);
  return PATTERNS.some((p) => p.test(normalized));
}

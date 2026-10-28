/** Estado de uma etapa: `warn` pede confirmacao para salvar; `skipped` = sera verificada depois. */
export type ConnectionStepStatus = 'ok' | 'failed' | 'warn' | 'skipped';

import { z } from 'zod';
import { agentSettingsInputSchema } from '../settings/agent.settings.input.schema.ts';

const userId = z.string().trim().min(1, 'userId obrigatorio');

/** Entrada de "ler a configuracao". */
export const getModelsInputSchema = z.object({ userId });

/** Entrada de "salvar a configuracao": a da tela + o usuario da sessao. */
export const setModelsInputSchema = agentSettingsInputSchema.extend({ userId });

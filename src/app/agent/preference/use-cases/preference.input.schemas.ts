import { z } from 'zod';
import { PREFERENCE_STATUSES } from '../../../../domain/preference/preference.status.ts';

const userId = z.string().trim().min(1, 'userId obrigatorio');
const id = z.string().trim().min(1, 'id obrigatorio').max(100);

/** Entrada de "listar preferencias". */
export const listPreferencesInputSchema = z.object({ userId, status: z.array(z.enum(PREFERENCE_STATUSES)).optional() });

/** Entrada de "editar preferencia": so o que veio muda; o escopo vem por nome (`account`/`category`) ou `global`. */
export const updatePreferenceInputSchema = z.object({
  userId,
  id,
  text: z.string().trim().min(1).max(400).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  scope: z.object({ kind: z.enum(['global', 'account', 'category']), id: z.string().trim().min(1).max(100).optional() }).optional(),
  private: z.boolean().optional(),
});

/** Entrada de "marcar privada/liberar". */
export const setPreferencePrivateInputSchema = z.object({ userId, id, private: z.boolean() });

/** Entrada de "apagar uma preferencia". */
export const deletePreferenceInputSchema = z.object({ userId, id });

/** Entrada de "apagar tudo" e de "ver avisos". */
export const preferenceUserInputSchema = z.object({ userId });

/** Entrada de confirmar ou recusar uma sugestao. */
export const decideSuggestionInputSchema = z.object({ userId, id });

import { z } from 'zod';

const userId = z.string().trim().min(1, 'userId obrigatorio');

/** Entrada de "registrar consentimento": a versao do texto que a tela mostrou. */
const kind = z.enum(['cloud', 'attachments']).default('cloud');

export const recordConsentInputSchema = z.object({ userId, kind, textVersion: z.string().trim().min(1).max(100) });

/** Entrada de "revogar" e de "situacao do consentimento". */
export const consentUserInputSchema = z.object({ userId, kind });

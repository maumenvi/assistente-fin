import { type ProviderId } from '../../../domain/agent/provider/provider.id.ts';
import { GOOGLE_GUIDE } from './google.guide.ts';
import { type Guide } from './guide.ts';
import { OLLAMA_GUIDE } from './ollama.guide.ts';
import { OPENROUTER_GUIDE } from './openrouter.guide.ts';

/** Todos os guias empacotados, por provedor (um por provedor do catalogo). */
export const GUIDES: Readonly<Record<ProviderId, Guide>> = {
  openrouter: OPENROUTER_GUIDE,
  google: GOOGLE_GUIDE,
  ollama: OLLAMA_GUIDE,
};

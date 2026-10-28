import { type ModelProfile } from '../../../domain/agent/model.profile.ts';
import { detectProvider } from '../../../domain/agent/provider/detect.provider.ts';
import { PROVIDERS } from '../../../domain/agent/provider/provider.catalog.ts';

/** Nome do provedor de um perfil para os avisos ("OpenRouter", "Google AI (Gemini)"); servidor proprio = "provedor". */
export function providerNameOfProfile(profile: ModelProfile | null): string {
  if (profile === null) return 'provedor';
  const id = detectProvider(profile);
  return id === 'custom' ? 'provedor' : PROVIDERS[id].label;
}

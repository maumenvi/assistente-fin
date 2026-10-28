import { z } from 'zod';
import { User } from '../../domain/user/user.entity.ts';
import { Cpf } from '../../domain/shared/cpf.value.object.ts';
import { Email } from '../../domain/shared/email.value.object.ts';
import { Phone } from '../../domain/shared/phone.value.object.ts';
import { type SyncAgentModelProfile } from '../../domain/agent/model.profile.ts';

export const syncAgentModelProfileSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['main', 'fast', 'fallback']),
  origin: z.enum(['google', 'openrouter']),
  baseUrl: z.string(),
  model: z.string(),
  apiKey: z.string().optional(),
  enabled: z.boolean(),
  updatedAt: z.string().optional(),
});

/**
 * Dados do usuario que o hub manda no pareamento (spec 022, T120): o celular passa a ser o MESMO
 * usuario do desktop (mesmo id), senao nenhum registro sincronizado bateria. Sem senha, chave de
 * recuperacao nem Telegram - segredos do desktop ficam no desktop.
 * Perfis em nuvem do assistente (spec 039) sincronizam seletivamente para o celular.
 */
export const pairedUserProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cpf: z.string().min(11),
  email: z.string().min(3),
  phone: z.string().min(8),
  createdAt: z.iso.datetime({ offset: true }),
  emailVerifiedAt: z.iso.datetime({ offset: true }).nullable(),
  phoneVerifiedAt: z.iso.datetime({ offset: true }).nullable(),
  lowBalanceThresholdCents: z.int().nullable(),
  agentProfiles: z.array(syncAgentModelProfileSchema).optional(),
});

export type PairedUserProfile = z.infer<typeof pairedUserProfileSchema>;

export function toPairedUserProfile(user: User, agentProfiles?: readonly SyncAgentModelProfile[]): PairedUserProfile {
  return {
    id: user.id,
    name: user.name,
    cpf: user.cpf.digits,
    email: user.email.value,
    phone: user.phone.value,
    createdAt: user.createdAt.toISOString(),
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
    lowBalanceThresholdCents: user.lowBalanceThresholdCents,
    ...(agentProfiles !== undefined ? { agentProfiles: [...agentProfiles] } : {}),
  };
}

/** O usuario local do celular, a partir do perfil do hub. */
export function userFromPairedProfile(profile: PairedUserProfile): User {
  return User.fromPersistence({
    id: profile.id,
    cpf: Cpf.create(profile.cpf),
    email: Email.create(profile.email),
    phone: Phone.create(profile.phone),
    name: profile.name,
    createdAt: new Date(profile.createdAt),
    emailVerifiedAt: profile.emailVerifiedAt === null ? null : new Date(profile.emailVerifiedAt),
    phoneVerifiedAt: profile.phoneVerifiedAt === null ? null : new Date(profile.phoneVerifiedAt),
    passwordHash: null,
    recoveryKeyHash: null,
    telegramChatId: null,
    defaultAccountId: null,
    lowBalanceThresholdCents: profile.lowBalanceThresholdCents,
  });
}

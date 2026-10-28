import { type ModelProfile } from '../../../domain/agent/model.profile.ts';

/** Perfil como a tela o recebe: sem `keyRef` e sem chave; so diz se ha uma guardada. */
export type ModelProfileView = Omit<ModelProfile, 'keyRef'> & { readonly hasKey: boolean };

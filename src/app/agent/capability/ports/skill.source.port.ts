import { type Candidate } from '../../../../domain/capability/candidate.ts';
import { type SkillFileInput } from '../../../../domain/capability/skill/skill.folder.ts';

/** Baixa a pasta de uma skill do catalogo (GitHub, skills.sh). Falha de rede/limite lanca com motivo legivel. */
export interface SkillSourcePort {
  download(candidate: Candidate, signal?: AbortSignal): Promise<SkillFileInput[]>;
}

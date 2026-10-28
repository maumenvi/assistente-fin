import { AgentError } from '../../errors/agent.error.ts';

/** Imagem anexada, mas o modelo que a veria nao tem visao. */
export class VisionNotSupportedError extends AgentError {
  public constructor() {
    super('VISION_NOT_SUPPORTED', 'o modelo nao enxerga imagens');
  }
}

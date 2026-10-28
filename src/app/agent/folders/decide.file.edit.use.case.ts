import { type FolderBroker } from './folder.broker.ts';

/** Resposta da pessoa a previa de uma edicao sem git: aprovar grava, negar deixa o arquivo intacto. */
export class DecideFileEditUseCase {
  private readonly broker: FolderBroker;

  public constructor(broker: FolderBroker) {
    this.broker = broker;
  }

  public execute(input: { readonly userId: string; readonly requestId: string; readonly approve: boolean }): void {
    this.broker.decideEdit(input.userId, input.requestId, input.approve);
  }
}

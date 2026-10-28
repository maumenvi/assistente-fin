import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { type GitProbePort } from '../../app/agent/ports/files/git.probe.port.ts';

/** Sobe os diretorios procurando `.git` (pasta, ou arquivo em worktrees). Avaliado a cada chamada: `git init` depois vale na hora. */
export class GitProbe implements GitProbePort {
  public async isInsideRepo(path: string): Promise<boolean> {
    let current = path;
    try {
      if (!(await stat(current)).isDirectory()) current = dirname(current);
    } catch {
      current = dirname(current);
    }
    for (;;) {
      try {
        await stat(join(current, '.git'));
        return true;
      } catch {
        // segue para o diretorio de cima
      }
      const parent = dirname(current);
      if (parent === current) return false;
      current = parent;
    }
  }
}

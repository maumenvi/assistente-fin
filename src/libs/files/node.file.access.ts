import { constants } from 'node:fs';
import { open, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, sep } from 'node:path';
import { FileTooLargeError } from '../../domain/agent/errors/file.too.large.error.ts';
import { FILE_LIMITS } from '../../domain/agent/folder/file.limits.ts';
import { type FileAccessPort, type FileEntry, type SearchFilesOptions } from '../../app/agent/ports/files/file.access.port.ts';

/** Pastas que a busca nunca percorre (ruido e dependencias). */
const SKIPPED_DIRS = new Set(['node_modules', '.git', '.cache', '__pycache__']);
/** Teto de itens examinados por busca: a busca nunca trava o app numa arvore gigante. */
const MAX_SCANNED = 50_000;

function globToRegExp(glob: string): RegExp {
  const source = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${source}$`, 'i');
}

/** `FileAccessPort` sobre `node:fs` (desktop). Nao decide permissao: as ferramentas passam pelo `FileGate` antes. */
export class NodeFileAccess implements FileAccessPort {
  public async realpath(path: string): Promise<string> {
    const missing: string[] = [];
    let current = path;
    for (;;) {
      try {
        const real = await realpath(current);
        return missing.length === 0 ? real : join(real, ...missing.reverse());
      } catch (error) {
        const parent = dirname(current);
        if ((error as { code?: string }).code !== 'ENOENT' || parent === current) throw error;
        missing.push(basename(current));
        current = parent;
      }
    }
  }

  public async isDirectory(path: string): Promise<boolean> {
    try {
      return (await stat(path)).isDirectory();
    } catch {
      return false;
    }
  }

  public async exists(path: string): Promise<boolean> {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  }

  public async search(root: string, options: SearchFilesOptions): Promise<{ entries: FileEntry[]; truncated: boolean }> {
    const needle = options.query?.toLowerCase();
    const pattern = options.glob === undefined ? null : globToRegExp(options.glob);
    const entries: FileEntry[] = [];
    let scanned = 0;
    let truncated = false;
    let level = [root];
    for (let depth = 0; depth <= FILE_LIMITS.searchMaxDepth && level.length > 0 && !truncated; depth += 1) {
      const nextLevel: string[] = [];
      for (const dir of level) {
        let children;
        try {
          children = await readdir(dir, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const child of children) {
          scanned += 1;
          if (scanned > MAX_SCANNED) {
            truncated = true;
            break;
          }
          if (child.isSymbolicLink()) continue;
          const full = join(dir, child.name);
          if (child.isDirectory()) {
            if (!SKIPPED_DIRS.has(child.name)) nextLevel.push(full);
            continue;
          }
          if (!child.isFile()) continue;
          if (needle !== undefined && !child.name.toLowerCase().includes(needle)) continue;
          if (pattern !== null && !pattern.test(child.name)) continue;
          if (entries.length >= options.maxResults) {
            truncated = true;
            break;
          }
          const info = await stat(full);
          entries.push({ path: full.split(sep).join('/'), size: info.size, modifiedAt: info.mtime.toISOString() });
        }
        if (truncated) break;
      }
      level = nextLevel;
    }
    return { entries, truncated };
  }

  public async read(path: string, maxBytes: number): Promise<Uint8Array> {
    const info = await stat(path);
    if (!info.isFile()) throw Object.assign(new Error('nao e um arquivo'), { code: 'ENOENT' });
    if (info.size > maxBytes) throw new FileTooLargeError(maxBytes);
    return new Uint8Array(await readFile(path));
  }

  public async create(path: string, content: string): Promise<string> {
    const ext = extname(path);
    const stem = path.slice(0, path.length - ext.length);
    for (let n = 1; n < 1000; n += 1) {
      const candidate = n === 1 ? path : `${stem}-${n}${ext}`;
      try {
        // `wx` falha se ja existe: nunca sobrescreve, nem em corrida entre duas execucoes
        const handle = await open(candidate, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o644);
        try {
          await handle.writeFile(content, 'utf8');
        } finally {
          await handle.close();
        }
        return candidate;
      } catch (error) {
        if ((error as { code?: string }).code !== 'EEXIST') throw error;
      }
    }
    throw new Error('nao foi possivel achar um nome livre');
  }

  public async write(path: string, content: string): Promise<void> {
    const info = await stat(path);
    if (!info.isFile()) throw Object.assign(new Error('nao e um arquivo'), { code: 'ENOENT' });
    await writeFile(path, content, 'utf8');
  }
}

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { FileTooLargeError } from '../../../src/domain/agent/errors/file.too.large.error.ts';
import { GitProbe } from '../../../src/libs/files/git.probe.ts';
import { NodeFileAccess } from '../../../src/libs/files/node.file.access.ts';

describe('NodeFileAccess / GitProbe', () => {
  let dir: string;
  const files = new NodeFileAccess();
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fc-files-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('busca por nome, glob e respeita o maximo', async () => {
    await mkdir(join(dir, 'sub'));
    await writeFile(join(dir, 'extrato-set.csv'), 'a');
    await writeFile(join(dir, 'sub', 'extrato-out.csv'), 'b');
    await writeFile(join(dir, 'nota.txt'), 'c');
    const byName = await files.search(dir, { query: 'EXTRATO', maxResults: 10 });
    assert.equal(byName.entries.length, 2);
    const byGlob = await files.search(dir, { glob: '*.txt', maxResults: 10 });
    assert.deepEqual(byGlob.entries.map((e) => e.path.split('/').pop()), ['nota.txt']);
    const limited = await files.search(dir, { query: 'extrato', maxResults: 1 });
    assert.equal(limited.entries.length, 1);
    assert.equal(limited.truncated, true);
  });

  it('busca nao segue link simbolico', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'fc-out-'));
    await writeFile(join(outside, 'segredo.txt'), 'x');
    await symlink(outside, join(dir, 'atalho'));
    const found = await files.search(dir, { query: 'segredo', maxResults: 10 });
    assert.equal(found.entries.length, 0);
    await rm(outside, { recursive: true, force: true });
  });

  it('realpath resolve link simbolico e caminho que ainda nao existe', async () => {
    const real = await files.realpath(dir);
    await symlink(dir, `${dir}-link`);
    assert.equal(await files.realpath(join(`${dir}-link`, 'novo.txt')), join(real, 'novo.txt'));
    await rm(`${dir}-link`);
  });

  it('read respeita o limite e create nunca sobrescreve', async () => {
    await writeFile(join(dir, 'grande.txt'), 'x'.repeat(100));
    await assert.rejects(files.read(join(dir, 'grande.txt'), 10), FileTooLargeError);
    assert.equal((await files.read(join(dir, 'grande.txt'), 1000)).length, 100);
    const first = await files.create(join(dir, 'rel.md'), 'um');
    const second = await files.create(join(dir, 'rel.md'), 'dois');
    const third = await files.create(join(dir, 'rel.md'), 'tres');
    assert.deepEqual([first, second, third].map((p) => p.split('/').pop()), ['rel.md', 'rel-2.md', 'rel-3.md']);
    assert.equal(await readFile(first, 'utf8'), 'um');
  });

  it('write so edita arquivo existente', async () => {
    await assert.rejects(files.write(join(dir, 'nao-existe.txt'), 'x'));
    await writeFile(join(dir, 'a.txt'), 'antes');
    await files.write(join(dir, 'a.txt'), 'depois');
    assert.equal(await readFile(join(dir, 'a.txt'), 'utf8'), 'depois');
  });

  it('GitProbe acha .git acima e avalia a cada chamada', async () => {
    const git = new GitProbe();
    await mkdir(join(dir, 'proj', 'src'), { recursive: true });
    await writeFile(join(dir, 'proj', 'src', 'f.txt'), 'x');
    assert.equal(await git.isInsideRepo(join(dir, 'proj', 'src', 'f.txt')), false);
    await mkdir(join(dir, 'proj', '.git'));
    assert.equal(await git.isInsideRepo(join(dir, 'proj', 'src', 'f.txt')), true);
    assert.equal(await git.isInsideRepo(join(dir, 'proj')), true);
  });
});

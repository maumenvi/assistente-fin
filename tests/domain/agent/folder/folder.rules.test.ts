import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PathOutsideGrantError } from '../../../../src/domain/agent/errors/path.outside.grant.error.ts';
import { accessCovers } from '../../../../src/domain/agent/folder/folder.access.ts';
import { type FolderGrant } from '../../../../src/domain/agent/folder/folder.grant.ts';
import { isDeniedPath } from '../../../../src/domain/agent/folder/is.denied.path.ts';
import { requiresEditConfirmation } from '../../../../src/domain/agent/folder/requires.edit.confirmation.ts';
import { resolveWithinGrant } from '../../../../src/domain/agent/folder/resolve.within.grant.ts';

const ctx = { home: '/home/ana', userData: '/home/ana/.config/finance-controller' };
const grant = (path: string, access: FolderGrant['access'] = ['read']): FolderGrant => ({ id: 'g', path, access, scope: 'persistent', createdAt: '2026-10-27T00:00:00Z' });

describe('accessCovers', () => {
  it('edit implica read, mas read nao implica create', () => {
    assert.equal(accessCovers(['edit'], 'read'), true);
    assert.equal(accessCovers(['read'], 'create'), false);
    assert.equal(accessCovers(['create'], 'read'), false);
  });
});

describe('isDeniedPath', () => {
  it('nega userData, ssh, gnupg, .env e pseudo-sistemas', () => {
    for (const p of ['/home/ana/.config/finance-controller/agent.json', '/home/ana/.ssh/id_rsa', '/home/ana/.gnupg', '/home/ana/proj/.env', '/home/ana/proj/.env.local', '/proc/1/environ', '/sys/x', '/dev/null']) {
      assert.equal(isDeniedPath(p, ctx), true, p);
    }
  });
  it('libera pasta comum e nome parecido', () => {
    for (const p of ['/home/ana/Documentos', '/home/ana/.sshfake/x', '/home/ana/environment.txt', '/home/ana/proj/env.md']) {
      assert.equal(isDeniedPath(p, ctx), false, p);
    }
  });
});

describe('resolveWithinGrant', () => {
  it('cobre o proprio diretorio e subpastas', () => {
    assert.ok(resolveWithinGrant('/a/b', [grant('/a/b')], 'read'));
    assert.ok(resolveWithinGrant('/a/b/c/d.txt', [grant('/a/b/')], 'read'));
  });
  it('prefixo parecido nao cobre (/a/b vs /a/bc)', () => {
    assert.equal(resolveWithinGrant('/a/bc/x', [grant('/a/b')], 'read'), null);
  });
  it('recusa .. e caminho relativo', () => {
    assert.throws(() => resolveWithinGrant('/a/b/../c', [grant('/a/b')], 'read'), PathOutsideGrantError);
    assert.throws(() => resolveWithinGrant('a/b', [grant('/a/b')], 'read'), PathOutsideGrantError);
  });
  it('acesso insuficiente nao cobre; edit cobre read', () => {
    assert.equal(resolveWithinGrant('/a/b/x', [grant('/a/b', ['read'])], 'edit'), null);
    assert.ok(resolveWithinGrant('/a/b/x', [grant('/a/b', ['edit'])], 'read'));
  });
});

describe('requiresEditConfirmation', () => {
  it('git grava direto; sem git confirma', () => {
    assert.equal(requiresEditConfirmation(true), false);
    assert.equal(requiresEditConfirmation(false), true);
  });
});

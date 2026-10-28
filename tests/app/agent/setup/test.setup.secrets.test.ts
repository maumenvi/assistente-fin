import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describeConnectionReport } from '../../../../src/app/agent/setup/describe.connection.report.ts';
import { startSetupWorld, USER } from './support/setup.harness.ts';

const SECRET = 'sk-or-v1-SEGREDO-NAO-VAZAR-1234567890';

describe('teste de conexao: a chave nunca vaza', () => {
  it('a chave nao aparece no relatorio nem no texto, mesmo com erro; so vai ao provedor no cabecalho', async () => {
    for (const keyState of ['ok', 'expired', 'no_credit'] as const) {
      const w = await startSetupWorld({ kind: 'openrouter', validKeys: [SECRET], keyState });
      try {
        const report = await w.test.execute({ userId: USER, draft: { provider: 'openrouter', apiKey: SECRET } });
        const all = JSON.stringify(report) + JSON.stringify(describeConnectionReport(report, 'openrouter'));
        assert.ok(!all.includes(SECRET) && !all.includes('SEGREDO'), keyState);
        for (const request of w.server.requests) {
          assert.ok(!request.url.includes('SEGREDO'), 'chave nunca na URL');
          assert.ok(!JSON.stringify(request.body ?? {}).includes('SEGREDO'), 'chave nunca no corpo');
        }
        assert.ok(w.server.requests.some((q) => q.authorization === `Bearer ${SECRET}`));
        assert.deepEqual(w.secrets.refs(), [], 'rascunho nao grava no cofre');
      } finally {
        await w.close();
      }
    }
  });

  it('chave invalida: o erro tambem nao a repete', async () => {
    const w = await startSetupWorld({ kind: 'google', validKeys: ['outra'] });
    try {
      const report = await w.test.execute({ userId: USER, draft: { provider: 'google', apiKey: 'AIzaSEGREDO-no-texto-123456' } });
      assert.ok(!JSON.stringify(report).includes('SEGREDO'));
      assert.ok(!JSON.stringify(describeConnectionReport(report, 'google')).includes('SEGREDO'));
    } finally {
      await w.close();
    }
  });
});

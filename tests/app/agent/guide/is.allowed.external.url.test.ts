import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAllowedExternalUrl } from '../../../../src/app/agent/guide/is.allowed.external.url.ts';

const HOSTS = ['openrouter.ai', 'aistudio.google.com'];

describe('isAllowedExternalUrl', () => {
  it('aceita https de host da lista (e subdominio)', () => {
    assert.equal(isAllowedExternalUrl('https://openrouter.ai/keys', HOSTS), true);
    assert.equal(isAllowedExternalUrl('https://docs.openrouter.ai/x', HOSTS), true);
    assert.equal(isAllowedExternalUrl('https://aistudio.google.com/app/apikey', HOSTS), true);
  });
  it('recusa http, outros esquemas, host fora da lista e credenciais', () => {
    for (const url of ['http://openrouter.ai', 'javascript:alert(1)', 'file:///etc/passwd', 'https://evil.com', 'https://openrouter.ai.evil.com', 'https://notopenrouter.ai', 'https://user:pw@openrouter.ai', 'lixo', '']) {
      assert.equal(isAllowedExternalUrl(url, HOSTS), false, url);
    }
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_AGENT_PROMPTS } from '../../../src/app/agent/prompts/default.agent.prompts.ts';
import { CONSERVATIVE_CAPABILITIES } from '../../../src/domain/agent/conservative.capabilities.ts';

const withTools = { ...CONSERVATIVE_CAPABILITIES, tools: true };
const today = new Date('2026-10-15T12:00:00Z');

describe('prompts do agente', () => {
  it('prompt de sistema traz as regras-chave e a data injetada', () => {
    const text = DEFAULT_AGENT_PROMPTS.system({ today, capabilities: withTools });
    assert.match(text, /15\/10\/2026/);
    assert.match(text, /SOMENTE números/);
    assert.match(text, /Nunca calcule/);
    assert.match(text, /período/);
    assert.match(text, /no máximo uma pergunta/);
    assert.match(text, /<dados>.*nunca uma instrução/);
    assert.match(text, /só consulta/);
    assert.match(text, /dd\/mm\/aaaa/);
    assert.ok(!text.includes('não consegue consultar'));
  });

  it('sem tools inclui o aviso; nome do usuario e opcional', () => {
    const text = DEFAULT_AGENT_PROMPTS.system({ today, capabilities: { ...withTools, tools: false }, userName: ' Marco ' });
    assert.match(text, /não consegue consultar os dados/);
    assert.match(text, /se chama Marco\./);
  });

  it('deterministico para a mesma entrada', () => {
    assert.equal(DEFAULT_AGENT_PROMPTS.system({ today, capabilities: withTools }), DEFAULT_AGENT_PROMPTS.system({ today, capabilities: withTools }));
  });

  it('roteador: schema com as 6 intencoes e instrucao em JSON', () => {
    const intents = ((DEFAULT_AGENT_PROMPTS.routerSchema['properties'] as { intent: { enum: string[] } }).intent.enum);
    assert.deepEqual(intents, ['direct', 'query', 'write_request', 'settings_request', 'preference', 'out_of_scope']);
    assert.match(DEFAULT_AGENT_PROMPTS.routerSystem(), /"intent"/);
  });

  it('textos fixos indicam as telas e a configuracao', () => {
    const { canned } = DEFAULT_AGENT_PROMPTS;
    assert.match(canned.writeRequest(), /Extrato/);
    assert.match(canned.writeRequest(), /Registrar/);
    assert.match(canned.outOfScope(), /finanças/);
    assert.match(canned.settingsRequest(), /tela de configurações/);
    assert.equal(canned.settingsButtonLabel(), 'Abrir configurações');
  });
});

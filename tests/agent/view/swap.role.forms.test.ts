import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { emptySettingsForm, type SettingsForm } from '../../../src/app/agent/view/settings/settings.form.ts';
import { swapRoleForms } from '../../../src/app/agent/view/settings/swap.role.forms.ts';

function form(): SettingsForm {
  const base = emptySettingsForm();
  return {
    ...base,
    profiles: {
      main: { ...base.profiles.main, model: 'gemini-2.5-flash', origin: 'google', hasKey: true },
      fast: { ...base.profiles.fast, model: 'gemini-2.0-flash', origin: 'google', hasKey: true },
      fallback: { ...base.profiles.fallback, model: 'openrouter/auto', origin: 'openrouter', hasKey: true },
    },
  };
}

describe('trocar papeis de modelo (arrastar)', () => {
  it('mesma origem: os modelos trocam de lugar, role/id ficam no lugar e a chave segue sem aviso', () => {
    const r = swapRoleForms(form(), 'main', 'fast');
    assert.equal(r.form.profiles.main.model, 'gemini-2.0-flash');
    assert.equal(r.form.profiles.fast.model, 'gemini-2.5-flash');
    assert.deepEqual([r.form.profiles.main.role, r.form.profiles.main.id, r.form.profiles.fast.role], ['main', 'main', 'fast']);
    assert.ok(r.form.profiles.main.hasKey && r.form.profiles.fast.hasKey);
    assert.equal(r.notice, null);
  });

  it('origens diferentes: a chave guardada nao acompanha o modelo e a tela avisa', () => {
    const r = swapRoleForms(form(), 'main', 'fallback');
    assert.equal(r.form.profiles.main.model, 'openrouter/auto');
    assert.equal(r.form.profiles.main.hasKey, false);
    assert.equal(r.form.profiles.fallback.hasKey, false);
    assert.match(r.notice ?? '', /chave não acompanha/);
  });

  it('o principal nunca fica vazio; trocar consigo mesmo nao faz nada', () => {
    const f = form();
    const empty: SettingsForm = { ...f, profiles: { ...f.profiles, fast: { ...f.profiles.fast, model: '' } } };
    const r = swapRoleForms(empty, 'main', 'fast');
    assert.equal(r.form, empty);
    assert.match(r.notice ?? '', /principal é obrigatório/);
    assert.equal(swapRoleForms(f, 'fast', 'fast').form, f);
  });
});

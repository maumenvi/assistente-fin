import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatChatText } from '../../../src/app/agent/view/format.chat.text.ts';

describe('formatChatText: links e blocos de codigo (spec 035)', () => {
  it('link https vira trecho com href', () => {
    const [block] = formatChatText('Abra [o site](https://openrouter.ai/keys) agora');
    assert.equal(block?.kind, 'paragraph');
    const runs = block?.kind === 'paragraph' ? block.runs : [];
    assert.deepEqual(runs.map((r) => [r.text, r.href]), [['Abra ', undefined], ['o site', 'https://openrouter.ai/keys'], [' agora', undefined]]);
  });

  it('link que nao e https (javascript:, http:) fica como texto, sem href', () => {
    for (const md of ['[x](javascript:alert(1))', '[x](http://exemplo.com)', '[x](data:text/html,oi)']) {
      const [block] = formatChatText(md);
      const runs = block?.kind === 'paragraph' ? block.runs : [];
      assert.ok(runs.every((r) => r.href === undefined), md);
    }
  });

  it('HTML nunca e interpretado', () => {
    const [block] = formatChatText('<a href="https://x.com">oi</a> <script>1</script>');
    const runs = block?.kind === 'paragraph' ? block.runs : [];
    assert.ok(runs.every((r) => r.href === undefined));
    assert.ok(runs.map((r) => r.text).join('').includes('<script>'));
  });

  it('bloco ``` vira kind code, com idioma e sem interpretar Markdown dentro', () => {
    const blocks = formatChatText('Rode:\n```bash\nollama pull qwen3:8b\n**nao negrito**\n```\nDepois teste.');
    assert.deepEqual(blocks.map((b) => b.kind), ['paragraph', 'code', 'paragraph']);
    assert.deepEqual(blocks[1], { kind: 'code', text: 'ollama pull qwen3:8b\n**nao negrito**', lang: 'bash' });
  });

  it('bloco sem fechar ainda sai como codigo', () => {
    assert.deepEqual(formatChatText('```\nls -la'), [{ kind: 'code', text: 'ls -la' }]);
  });
});

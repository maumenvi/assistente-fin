import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidUserNotificationSource } from '../../../src/domain/user-notification/is.valid.user.notification.source.ts';

test('isValidUserNotificationSource: aceita identificadores minusculos com hifen e digitos', () => {
  for (const source of ['mcp', 'mobile-capture', 'test-source', 'a', 'email2', 'a'.repeat(40)]) {
    assert.equal(isValidUserNotificationSource(source), true, source);
  }
});

test('isValidUserNotificationSource: recusa vazio, maiuscula, digito inicial, espaco e mais de 40 chars', () => {
  for (const source of ['', 'MCP', 'Mcp', '1mcp', '-mcp', 'mobile capture', 'mcp_x', 'a'.repeat(41)]) {
    assert.equal(isValidUserNotificationSource(source), false, source);
  }
});

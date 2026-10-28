import { z } from 'zod';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * Endereco base de um provedor: `https://` sempre; `http://` so para `localhost`/`127.0.0.1`/`[::1]`
 * (servidores locais). Sem barra no fim e sem credenciais no endereco.
 */
export const baseUrlSchema = z
  .string()
  .trim()
  .max(300)
  .transform((value) => value.replace(/\/+$/, ''))
  .refine((value) => {
    try {
      const url = new URL(value);
      if (url.username !== '' || url.password !== '') return false;
      return url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname));
    } catch {
      return false;
    }
  }, 'endereco invalido: use https:// (http:// so para localhost)');

/** Entidades XML basicas (`&amp;`, `&lt;`, `&#10;`...) para texto de celula. */
export function decodeXmlText(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Valor de um atributo (`name="..."`) numa string de atributos; `null` se ausente. */
export function xmlAttr(attrs: string, name: string): string | null {
  const match = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs);
  return match === null ? null : decodeXmlText(match[1] as string);
}

/** Todo o texto dentro de `<t ...>...</t>` de um trecho (celulas e strings compartilhadas com formatacao em trechos). */
export function xmlTextOf(fragment: string): string {
  let out = '';
  for (const m of fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += decodeXmlText(m[1] as string);
  return out;
}

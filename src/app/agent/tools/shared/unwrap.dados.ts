/** Tira o envelope `<dados origem="...">` de um texto de ferramenta, para compor outro resultado. */
export function unwrapDados(content: string): string {
  return content.replace(/^<dados origem="[^"]*">\n/, '').replace(/\n<\/dados>$/, '');
}

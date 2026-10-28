/** `child` e o proprio `parent` ou esta dentro dele (respeita a fronteira: `/a/b` nao contem `/a/bc`). Caminhos ja normalizados. */
export function isInside(parent: string, child: string): boolean {
  return child === parent || child.startsWith(parent === '/' ? '/' : `${parent}/`);
}

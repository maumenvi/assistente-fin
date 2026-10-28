/** Cria um `Error` com nome proprio e sem stack (para o `buildLogEvent` da spec 017 serializar como erro). */
export function namedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  delete (error as { stack?: string }).stack;
  return error;
}

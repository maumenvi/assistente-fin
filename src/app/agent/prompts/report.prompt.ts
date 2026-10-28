/** Trecho do prompt de sistema para `write_report` (spec 040, FR-014..017). So entra no desktop. */
export function reportPromptLines(): string[] {
  return [
    '',
    'Relatórios (write_report):',
    '- Antes de montar o relatório, consulte TODOS os dados que ele vai mostrar com as ferramentas de consulta; todo número do relatório precisa ter vindo delas (o app confere e recusa valores que não vieram).',
    '- Estrutura sugerida: título, resumo curto, depois blocos: tabela com os valores, gráfico (barras para comparar categorias, linhas para evolução no tempo, pizza para partes de um todo) e texto com a leitura dos números.',
    '- Escolha o formato "html" para relatório visual com gráficos e "md" para texto simples; salve numa pasta que a pessoa liberou (o app pergunta se faltar) e informe o caminho do arquivo gerado.',
  ];
}

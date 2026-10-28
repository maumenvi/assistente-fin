# Avaliação do agente — openai/gpt-oss-20b

Resultado: **REPROVADO** — 0/12 cenários (0.0% exatos), 0 valores inventados, 0 escritas indevidas.
Custo: indisponível · tempo total: 1.3 s

| Categoria | Passaram | Total |
|---|---|---|
| composite | 0 | 12 |

## Limiares violados
- exatidão 0.0% abaixo de 95%

## Falhas
- `composite.resumo.2026-09`: execução falhou (LLM_AUTH); trajetória: esperado [get_month_summary], chamado [] — «»
- `composite.resumo.2026-08`: execução falhou (LLM_AUTH); trajetória: esperado [get_month_summary], chamado [] — «»
- `composite.resumo.2026-07`: execução falhou (LLM_AUTH); trajetória: esperado [get_month_summary], chamado [] — «»
- `composite.resumo.2026-10`: execução falhou (LLM_AUTH); trajetória: esperado [get_month_summary], chamado [] — «»
- `composite.duas.categorias.2026-09.mercado.lazer`: execução falhou (LLM_AUTH); trajetória: esperado [query_transactions], chamado [] — «»
- `composite.duas.categorias.2026-08.transporte.sade`: execução falhou (LLM_AUTH); trajetória: esperado [query_transactions], chamado [] — «»
- `composite.duas.categorias.2026-07.mercado.restaurantes`: execução falhou (LLM_AUTH); trajetória: esperado [query_transactions], chamado [] — «»
- `composite.saldo.e.limite`: execução falhou (LLM_AUTH); trajetória: esperado [get_account_balances, get_spending_limits], chamado [] — «»
- `composite.poupanca.e.carteira`: execução falhou (LLM_AUTH); trajetória: esperado [get_account_balances], chamado [] — «»
- `composite.gastos.e.ganhos.setembro`: execução falhou (LLM_AUTH); trajetória: esperado [query_transactions], chamado [] — «»
- `composite.restaurantes.lazer.outubro`: execução falhou (LLM_AUTH); trajetória: esperado [query_transactions, get_spending_limits], chamado [] — «»
- `composite.saldo.e.fatura`: execução falhou (LLM_AUTH); trajetória: esperado [get_account_balances, get_credit_card_status], chamado [] — «»

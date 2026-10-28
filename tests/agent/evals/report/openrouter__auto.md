# Avaliação do agente — openrouter/auto

Resultado: **REPROVADO** — 0/12 cenários (0.0% exatos), 0 valores inventados, 0 escritas indevidas.
Custo: indisponível · tempo total: 48.0 s

| Categoria | Passaram | Total |
|---|---|---|
| composite | 0 | 12 |

## Limiares violados
- exatidão 0.0% abaixo de 95%

## Falhas
- `composite.resumo.2026-09`: execução falhou (LLM_QUOTA); trajetória: esperado [get_month_summary], chamado [] — «»
- `composite.resumo.2026-08`: execução falhou (LLM_QUOTA); trajetória: esperado [get_month_summary], chamado [] — «»
- `composite.resumo.2026-07`: execução falhou (LLM_QUOTA); trajetória: esperado [get_month_summary], chamado [] — «»
- `composite.resumo.2026-10`: execução falhou (LLM_QUOTA); trajetória: esperado [get_month_summary], chamado [] — «»
- `composite.duas.categorias.2026-09.mercado.lazer`: execução falhou (LLM_QUOTA); trajetória: esperado [query_transactions], chamado [] — «»
- `composite.duas.categorias.2026-08.transporte.sade`: faltam valores esperados: R$ 519,27, R$ 1.653,39; trajetória: esperado [query_transactions], chamado [] — «## Comparação não disponível  Período consultado: **08/2026**.  Não encontrei valores de **transporte** nem de **saúde** — nenhum valor foi apurado ainda. Sem e»
- `composite.duas.categorias.2026-07.mercado.restaurantes`: execução falhou (LLM_QUOTA); trajetória: esperado [query_transactions], chamado [] — «»
- `composite.saldo.e.limite`: faltam valores esperados: R$ 60.320,38, R$ 357,13; trajetória: esperado [get_account_balances, get_spending_limits], chamado [] — «Não consigo ver seus dados agora: esta versão do assistente não tem acesso às ferramentas do app, então não posso consultar saldo de conta nem limite de categor»
- `composite.poupanca.e.carteira`: execução falhou (LLM_QUOTA); trajetória: esperado [get_account_balances], chamado [] — «»
- `composite.gastos.e.ganhos.setembro`: execução falhou (LLM_QUOTA); trajetória: esperado [query_transactions], chamado [] — «»
- `composite.restaurantes.lazer.outubro`: execução falhou (LLM_QUOTA); trajetória: esperado [query_transactions, get_spending_limits], chamado [] — «»
- `composite.saldo.e.fatura`: execução falhou (LLM_QUOTA); trajetória: esperado [get_account_balances, get_credit_card_status], chamado [] — «»

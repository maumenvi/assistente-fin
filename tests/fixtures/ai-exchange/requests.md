# Pedidos de amostra para medir a taxa de blocos validos (spec 029, SC-009)

Rode cada pedido em cada app de IA (ChatGPT, Claude, Gemini), **depois de colar o texto de "Compartilhar com IA"**,
e salve a resposta (o bloco copiado pelo botao "copiar" do chat, ou a resposta inteira) em
`tests/fixtures/ai-exchange/agents/<agente>/<NN-slug>.txt`. Depois: `npm test -- "tests/app/ai-exchange/eval/*.test.ts"`.

Dados de teste: use um conjunto fictício (3 contas, categorias Mercado/Lazer/Transporte, ~40 lançamentos).

1. Lance estes 3 gastos: padaria R$ 23,50 hoje; posto R$ 210 ontem no cartão; farmácia R$ 67,90 anteontem.
2. Categorize este extrato (cole 8 linhas com descrições variadas) e lance tudo na conta corrente.
3. Troque a categoria das 5 maiores compras do mês para "Lazer".
4. Marque o aluguel como pago.
5. Lance uma geladeira de R$ 3.000 em 10 vezes no cartão.
6. Apague a assinatura de streaming (peça o bloco com a confirmação).
7. Mude o limite de Mercado de outubro para R$ 900.
8. Registre meu salário de R$ 6.500 recebido hoje na conta corrente.
9. Crie a categoria "Pets" e lance uma ração de R$ 120.
10. Cancele as parcelas restantes da compra parcelada mais recente.
11. (foto) Lance os itens deste cupom fiscal.
12. Lance 15 gastos de uma vez (lista longa) e mantenha um bloco só.

Para cada resposta, anote se o bloco foi importado sem edicao.

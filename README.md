# Assistente Fin

**Assistente Fin** é um assistente financeiro pessoal **local-first**: um app **desktop (Electron)**, um **app Android** que
sincroniza com o desktop e um **servidor MCP** para assistentes de IA operarem os dados.
O usuário é dono dos dados: tudo roda sobre um PostgreSQL próprio, sem servidor de aplicação.
Um **agente de IA embutido** conversa sobre as finanças, lê extratos e faturas, gera relatórios e propõe alterações
que só valem depois da aprovação — com os números sempre conferidos contra os dados reais.

> **Repositório de portfólio.** Esta é a vitrine pública: mostra a **arquitetura** e o **núcleo testado**
> (domínio e casos de uso), não o produto inteiro. O app completo (desktop, Android, MCP, sync, empacotamento)
> é comercializado e vive em repositório privado. Licença não comercial — veja [LICENSE](LICENSE).

## Agente de IA

O diferencial do produto: um agente que **conversa sobre as finanças do usuário sem inventar números e sem mexer em nada sem
aprovação**. Roda no desktop e no celular, com o modelo à escolha (OpenRouter, Google Gemini ou Ollama local — com "somente local"
nada sai do computador). Visão técnica completa em [docs/agent/README.md](docs/agent/README.md).

| Pergunta com resposta conferida | Pede acesso à pasta (uma única ação) |
|---|---|
| ![Chat](docs/media/agente-chat.png) | ![Permissão de pasta](docs/media/agente-permissao-pasta.png) |
| **Relatório salvo no computador** | **O `.html` gerado (gráfico em SVG, abre offline)** |
| ![Relatório salvo](docs/media/agente-relatorio-salvo.png) | ![Relatório HTML](docs/media/agente-relatorio-html.png) |

Capturas do app real com um servidor de LLM de teste: as consultas (cartões "Consultei"), os números e os arquivos são os do app;
só o texto do modelo é roteirizado.

### Estratégia

O princípio é **deixar o modelo decidir *o que perguntar* e o código garantir *o que vale***: o modelo escolhe ferramentas e redige a
resposta; quem busca dados, faz contas, confere números, grava e libera acesso é código determinístico e testado.

```mermaid
flowchart LR
  U["Pergunta"] --> R["Rotear<br/>intenção"]
  R --> RE["Raciocinar<br/>modelo + ferramentas"]
  RE <--> T["Ferramentas<br/>consultas · cálculo"]
  RE --> A["Responder<br/>verifica números"]
  A --> M["Resposta<br/>(valor não conferido é ocultado)"]
  RE -. propor .-> P["Plano de alteração<br/>aprovar · desfazer"]
  RE -. precisa de arquivo .-> F["Cartão no chat<br/>(pasta/arquivo)"]
```

- **Grafo declarado como dado**: nós (`route`, `react`, `tools`, `respond`) e arestas são dados validados em tempo de montagem, com o
  diagrama gerado do próprio código; um runner único cuida de orçamento, cancelamento, checkpoint e trace por passo.
- **Intenção primeiro**: regras baratas classificam o pedido (consulta, preferência, alteração) e só então o modelo rápido desempata;
  **cada intenção enxerga só as ferramentas dela** (um pedido de consulta nunca grava, um de preferência nunca consulta dados).
- **Ferramentas pequenas e tipadas**: consultas aos mesmos casos de uso das telas, sem caminho paralelo. Contas (soma, variação,
  projeção) passam por `calculate`/`compare_periods` — o modelo não faz aritmética.
- **Modelo em 3 níveis com roteamento por custo**: alto, médio e básico por passo, com troca automática para o modelo alternativo
  quando o principal falha, e telemetria de tokens/custo por nível.
- **Propor, depois confirmar**: toda escrita vira um *plano* revisável (antes/depois, alertas), aplicado numa transação só.
- **Contexto sob controle**: preferências do usuário entram no prompt; conversas longas são **compactadas** em segundo plano (70% da
  janela; 50% em modelos locais pequenos) com resumo **sem valores em reais**, que são sempre consultados de novo.
- **Orçamento por pedido**: passos, tempo, custo e tokens; ao estourar, o agente entrega o que apurou e oferece **Continuar** do
  checkpoint. Até 5 conversas executam em paralelo, com aviso no desktop quando uma termina ou espera a pessoa.
- **Qualidade medida, não suposta**: suíte de avaliação de regressão sobre base sintética (exatidão, zero valores inventados, zero
  escritas indevidas) que roda também com um prompt degradado, para provar que os testes pegam a piora.

### Guardrails

| Risco | Como é barrado (por construção, com teste) |
|---|---|
| **Número inventado** | *Livro-razão de fatos*: cada valor, data e quantidade devolvidos pelas ferramentas (e as figuras que o usuário escreveu) é registrado; `verifyFigures` confere a resposta e **oculta** o que não bater, com uma correção automática antes de entregar. Datas do período e contagens de itens também são fatos. |
| **Escrita indevida** | O agente **nunca grava direto**: só `propose_changes`, que cria um plano pendente. Aprovar é um clique do usuário; item cujo dado mudou desde a proposta é pulado; plano vence em 24 h; dá para **desfazer** por 7 dias. Autonomia por tipo de ação **começa desligada** e é limitada em valor e quantidade; excluir, transferir e pagar fatura **sempre** pedem aprovação; itens vindos de anexo nunca são aprovados sozinhos. |
| **Vazamento entre usuários** | O `userId` vem **da sessão**, nunca do modelo nem do schema da ferramenta; ferramentas rejeitam esse campo na montagem. |
| **Ferramenta com poder demais** | Registros separados por **efeito** (consulta, memória, planejamento, externo, arquivo): cada intenção só recebe o seu, e um registro recusa ferramentas de efeito não permitido. |
| **Prompt injection** | Texto de anexo, arquivo ou ferramenta externa entra como **dado** (`<dados>` com neutralização), nunca como instrução; padrões de ordem embutida são marcados e aparecem na tela de execução. |
| **Capacidade externa (MCP/skill)** | Nada conecta antes de **aprovação** com cartão que mostra o que sai do aparelho; credenciais vão direto ao cofre, nunca ao chat; mudança de identidade da capacidade bloqueia o uso até reaprovar; saída filtrada por *egress guard*. |
| **Acesso a arquivos** | Permissão **só por clique** na UI (nenhuma ferramenta concede); `..`, links simbólicos para fora, dados do próprio app, `~/.ssh`, `.env*` e pseudo-sistemas são barrados; criar nunca sobrescreve; editar fora do git exige **prévia aprovada**; o registro da execução guarda só o caminho, nunca o conteúdo. |
| **Privacidade** | Consentimento explícito antes de qualquer envio à nuvem e outro, separado, para anexos; "somente local" bloqueia a nuvem; preferências privadas nunca vão a modelo de nuvem; segredos nunca entram em log, trace nem estado gravado. |
| **Relatório com dado falso** | `write_report` recebe o relatório como **dados** (nunca HTML do modelo), confere todo número contra as consultas da execução antes de gravar e escapa todo texto; o `.html` não tem script nem recurso externo. |
| **Execução fora de controle** | Orçamento de passos, tempo, custo e tokens; teto de consultas por resposta; no máximo 5 execuções simultâneas; parar a qualquer momento; execuções órfãs de uma queda viram "interrompidas" e podem continuar. |
| **Falha do provedor** | Erros de domínio com mensagem acionável (chave recusada, crédito, sem rede), nova tentativa com recuo, modelo alternativo e aviso de qual respondeu. |

## Em funcionamento

![Tour pelo desktop](docs/media/desktop-tour.gif)

| Dashboard | Extrato |
|---|---|
| ![Dashboard](docs/media/desktop-dashboard.png) | ![Extrato](docs/media/desktop-extrato.png) |
| **Limites de gasto** | **Gastos fixos** |
| ![Limites](docs/media/desktop-limites.png) | ![Gastos fixos](docs/media/desktop-gastos-fixos.png) |
| **Cartão de crédito** | **Projeções** |
| ![Cartão](docs/media/desktop-cartao.png) | ![Projeções](docs/media/desktop-projecoes.png) |

### App Android

<p align="center">
  <img src="docs/media/android-tour.gif" alt="Tour pelo app Android" width="260">
  &nbsp;
  <img src="docs/media/android-lancamento.gif" alt="Lançando um gasto" width="260">
</p>

| Início | Limites | Extrato | Simular compra | Mais |
|---|---|---|---|---|
| <img src="docs/media/android-inicio.png" width="160"> | <img src="docs/media/android-inicio-limites.png" width="160"> | <img src="docs/media/android-extrato.png" width="160"> | <img src="docs/media/android-simular.png" width="160"> | <img src="docs/media/android-mais.png" width="160"> |

O app roda sincronizado com o desktop (mesmos saldos, limites e lançamentos) e funciona offline.
Vídeo do tour: [android-tour.mp4](docs/media/android-tour.mp4).

### Servidor MCP (assistente de IA operando o app)

![Sessão MCP](docs/media/mcp-assistente.gif)

Sessão real contra o servidor MCP embutido no desktop (63 ferramentas, HTTP local, autenticado por chave),
rodando sobre um banco de teste descartável: o assistente consulta os limites, lança um gasto e simula uma compra.
As perguntas são ilustrativas; as chamadas e as respostas são as do servidor. O lançamento criado pelo MCP
aparece na hora no extrato do desktop:

![Extrato com o lançamento criado via MCP](docs/media/desktop-extrato-mcp.png)

## O que o produto faz

- **Desktop**: contas, ganhos, gastos fixos, cartões com compras parceladas, limites de gasto,
  categorias (renomear propaga), recorrência com materialização, previsão mensal adaptativa,
  simulação de compra, cenários com pontos de restauração, backup, multiusuário por CPF.
- **Android**: lançamento rápido, pré-registro (comprovantes, NFC-e), widgets e atalhos, sync com o desktop.
- **MCP embutido**: assistentes de IA consultam e lançam dados por HTTP local, autenticados por chave.
- **Agente de IA no chat** (desktop e celular): perguntas em linguagem natural sobre os dados, com a **resposta conferida** — todo
  valor citado precisa ter vindo de uma consulta; o que não conferir é ocultado. Veja a seção "Agente de IA".
- **Troca de dados com agentes de IA**: exporta/importa blocos estruturados, sem expor o banco.
- **Segurança**: códigos de verificação cifrados em repouso (AES-256-GCM), chaves de acesso por usuário.

## Visão geral do sistema

```mermaid
flowchart LR
  subgraph Desktop["Desktop (Electron)"]
    UI["UI React (renderer)"] -->|IPC tipado| Main["Main process"]
    Main --> UC["Casos de uso"]
    MCP["Servidor MCP<br/>127.0.0.1 · Streamable HTTP"] --> UC
    Hub["Hub de sync<br/>HTTP local"] --> UC
  end
  UC --> PG[("PostgreSQL<br/>local ou nuvem")]
  AI["Assistente de IA"] -->|"MCP + FIN_CTRL_KEY"| MCP
  subgraph Android["App Android (React Native)"]
    RN["UI nativa"] --> SQ[("SQLite local<br/>+ outbox")]
  end
  SQ <-->|"sync incremental"| Hub
```

## Arquitetura em camadas

A regra de dependência aponta sempre para dentro: o domínio não conhece nada de fora.
Persistência e notificação entram por **portas** (interfaces) e têm adaptadores intercambiáveis.

```mermaid
flowchart TB
  UI["Interfaces<br/>Electron · React Native · MCP"] --> APP
  APP["app/ — casos de uso<br/>orquestram, validam entrada (Zod), controlam transação"] --> DOM
  DOM["domain/ — regras puras<br/>entidades, value objects, cálculos (sem I/O)"]
  APP --> PORTS["Portas<br/>repositórios · UnitOfWork · senders"]
  PORTS -.implementado por.-> FAKE["Adaptador fake<br/>(em memória)"]
  PORTS -.implementado por.-> PRISMA["Adaptador Prisma<br/>(PostgreSQL)"]
  PORTS -.implementado por.-> SQLITE["Adaptador SQLite<br/>(Android)"]
```

| Camada | Conteúdo | Neste repositório |
|---|---|---|
| `src/domain` | Entidades e regras puras (dinheiro, saldo, recorrência, previsão, cartão, **agente, planos, autonomia, preferências, capacidades**) | ✅ |
| `src/app` | ~1.100 arquivos: um caso de uso + um schema de entrada por operação, mais o **núcleo do agente** (`app/agent`: grafo, ferramentas, verificação, planos, memória, arquivos, relatórios) | ✅ |
| `src/composition` | Montagem dos casos de uso e do agente (injeção de dependências) | ✅ |
| `src/libs` | Adaptadores de plataforma sem I/O de banco: modelos (OpenAI-compatível, streaming SSE), leitura de PDF/planilha, disco, relógio, ids, criptografia | ✅ |
| `src/database/fake` | Adaptador em memória usado pelos testes de caso de uso (inclui os armazenamentos do agente) | ✅ |
| `src/database/{prisma,sqlite}` | Adaptadores reais, mappers e migrações | privado |
| `src/react`, `src/react-native`, `src/mcp` | Interfaces (desktop, Android, MCP) | privado |

## Decisões de engenharia

- **Casos de uso pequenos e isolados**: cada operação tem seu `*.use.case.ts` e seu `*.input.schema.ts`
  (validação na borda com Zod), o que facilita testar, expor via MCP e reaproveitar no Android.
- **Dinheiro em centavos inteiros**: sem erro de ponto flutuante.
- **Unit of Work**: operações que tocam várias entidades (transferência, pagamento de fatura, parcelas)
  são atômicas, com **bloqueio otimista** por versão contra edição concorrente.
- **Mesma suíte, vários adaptadores**: os testes de contrato rodam contra o fake e contra o Postgres real.
- **Local-first com sync**: o app Android grava num SQLite local e registra mudanças por *trigger* numa
  outbox; o desktop aplica de forma idempotente e resolve conflitos.
- **Pré-registro com deduplicação por conteúdo**: lançamentos vindos do celular passam por aprovação
  e não duplicam.
- **Desenvolvimento orientado a especificação** (GitHub Spec Kit): ~40 specs com plano e tarefas;
  os comentários do código citam a spec que justifica cada regra.
- **IA com guarda-corpos por construção**: ferramentas só de leitura por padrão (registros separados por efeito: consulta, memória,
  planejamento, externo, arquivo); modelo nunca vê `userId`; permissão de pasta só nasce de um clique na UI; resultado de ferramenta
  externa ou arquivo entra como dado, nunca como instrução.
- **Eventos como fonte da UI**: o estado do chat e das conversas em paralelo é uma função pura dos eventos do agente (`reduceChat`,
  `AgentActivityTracker`), o que torna o comportamento testável sem Electron.

## Fluxo: do celular ao assistente de IA

```mermaid
sequenceDiagram
  participant U as Usuário
  participant A as App Android
  participant H as Hub (desktop)
  participant DB as PostgreSQL
  participant IA as Assistente (MCP)
  U->>A: lança gasto (offline ok)
  A->>A: grava no SQLite + outbox
  A->>H: sync (mudanças pendentes)
  H->>DB: aplica via caso de uso (idempotente)
  H-->>A: confirma e devolve mudanças do desktop
  IA->>H: tool "listar lançamentos" (FIN_CTRL_KEY)
  H->>DB: consulta
  H-->>IA: resultado
```

## Modelo de dados (resumo)

```mermaid
erDiagram
  USER ||--o{ ACCOUNT : possui
  USER ||--o{ CATEGORY : define
  ACCOUNT ||--o{ TRANSACTION : recebe
  CATEGORY ||--o{ TRANSACTION : classifica
  TRANSACTION_SERIES ||--o{ TRANSACTION : materializa
  USER ||--o{ INCOME : tem
  USER ||--o{ FIXED_EXPENSE : tem
  USER ||--o{ SPENDING_LIMIT : tem
  USER ||--o{ PROJECTION_SCENARIO : simula
  USER ||--o{ PRE_REGISTRATION : "recebe do celular"
  USER ||--o{ MCP_ACCESS_KEY : autoriza
```

O schema completo está em [prisma/schema.prisma](prisma/schema.prisma).

## Testes

```bash
npm install
npm test            # node:test — domínio e casos de uso
npm run typecheck   # tsc --noEmit
```

Neste recorte: **2170 testes** de domínio, casos de uso e do **núcleo do agente** (grafo, ferramentas, verificação de números,
planos, permissão de arquivos, relatórios), todos verdes, com typecheck limpo. No repositório completo são ~5000 `node:test` mais
uma suíte e2e com ~210 cenários em Playwright sobre o app Electron real (com um servidor de LLM de mentira).

## Stack

TypeScript · Node · Electron · React · React Native / Expo · PostgreSQL · Prisma · SQLite · Zod ·
Model Context Protocol (SDK oficial) · agentes de IA (OpenRouter, Google Gemini, Ollama) · Fastify · Playwright ·
electron-builder (AppImage, Flatpak) · APK assinado.

## Contato

**Marco Aurélio Tôrres Vieira** — Senior Backend Engineer (Node.js/TypeScript, IA aplicada: MCP e agentes) · Belo Horizonte, MG

- GitHub: [github.com/maumenvi](https://github.com/maumenvi)
- LinkedIn: [Marco Aurélio Tôrres Vieira](https://www.linkedin.com/in/marco-aurélio-tôrres-vieira-294524b8)

Aberto a conversar sobre o produto, licenciamento ou oportunidades.


[![M8ven Verified](https://m8ven.ai/badge/mcp/maumenvi-assistente-fin-evoh6m?variant=verified&v=6c218a0d5b8cc593d8aad864cef0dc70)](https://m8ven.ai/mcp/maumenvi-assistente-fin-evoh6m?s=readme)

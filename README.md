# Finance Controller

Controle financeiro pessoal **local-first**: um app **desktop (Electron)**, um **app Android** que
sincroniza com o desktop e um **servidor MCP** para assistentes de IA operarem os dados.
O usuário é dono dos dados: tudo roda sobre um PostgreSQL próprio, sem servidor de aplicação.

> **Repositório de portfólio.** Esta é a vitrine pública: mostra a **arquitetura** e o **núcleo testado**
> (domínio e casos de uso), não o produto inteiro. O app completo (desktop, Android, MCP, sync, empacotamento)
> é comercializado e vive em repositório privado. Licença não comercial — veja [LICENSE](LICENSE).

## Em funcionamento

![Tour pelo desktop](docs/media/desktop-tour.gif)

| Dashboard | Extrato |
|---|---|
| ![Dashboard](docs/media/desktop-dashboard.png) | ![Extrato](docs/media/desktop-extrato.png) |
| **Limites de gasto** | **Gastos fixos** |
| ![Limites](docs/media/desktop-limites.png) | ![Gastos fixos](docs/media/desktop-gastos-fixos.png) |
| **Cartão de crédito** | **Projeções** |
| ![Cartão](docs/media/desktop-cartao.png) | ![Projeções](docs/media/desktop-projecoes.png) |

<!-- TODO: android-*.png/gif e mcp-assistente.gif quando houver captura no aparelho -->

## O que o produto faz

- **Desktop**: contas, ganhos, gastos fixos, cartões com compras parceladas, limites de gasto,
  categorias (renomear propaga), recorrência com materialização, previsão mensal adaptativa,
  simulação de compra, cenários com pontos de restauração, backup, multiusuário por CPF.
- **Android**: lançamento rápido, pré-registro (comprovantes, NFC-e), widgets e atalhos, sync com o desktop.
- **MCP embutido**: assistentes de IA consultam e lançam dados por HTTP local, autenticados por chave.
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
| `src/domain` | Entidades e regras puras (dinheiro, saldo, recorrência, previsão, cartão) | ✅ |
| `src/app` | ~500 arquivos: um caso de uso + um schema de entrada por operação | ✅ |
| `src/database/fake` | Adaptador em memória usado pelos testes de caso de uso | ✅ |
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
- **Desenvolvimento orientado a especificação** (GitHub Spec Kit): ~30 specs com plano e tarefas;
  os comentários do código citam a spec que justifica cada regra.

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

Neste recorte: **1213 testes** de domínio e casos de uso, todos verdes, com typecheck limpo. No
repositório completo são ~2500 `node:test` mais uma suíte e2e com Playwright sobre o app Electron real.

## Stack

TypeScript · Node · Electron · React · React Native / Expo · PostgreSQL · Prisma · SQLite · Zod ·
Model Context Protocol (SDK oficial) · Fastify · Playwright · electron-builder (AppImage, Flatpak) · APK assinado.

## Contato

**Marco Aurélio Tôrres Vieira** — aberto a conversar sobre o produto, licenciamento ou oportunidades.

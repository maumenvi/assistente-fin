# Assistente de finanças (agente de IA) — visão geral

Tela principal do app (desktop e Android): o usuário pergunta em texto livre e o agente consulta os
dados com ferramentas **somente leitura**, citando só números que as ferramentas devolveram. Esta é a
visão da spec 031; as specs 032–034 (preferências, planos e autonomia, capacidades dinâmicas)
estendem os pontos listados no fim.

## Camadas e portas

```
domain/agent        puro: tipos (execução, passo, fato, perfil), erros, regras pequenas
app/agent           portas e casos de uso (nada de rede, disco ou UI)
  ports/llm         LlmPort (um único `stream`; `generate` é o coletor)
  ports/tool        ToolPort (list/execute; nunca lança)
  ports/store       AgentStorePort (conversas, mensagens, execuções, passos)
  ports/settings    AgentSettingsPort + SecretStorePort (chave só no cofre)
  ports/observe     AgentTracePort (fire-and-forget) + AgentLogPort
  ports/events      AgentEventsPort (eventos de UI ao vivo, em memória)
  graph/            o grafo como dado + runner; nodes/ um arquivo por nó
  tools/            as 9 ferramentas de consulta + registro
  verify/           livro-razão de fatos e verificação de valores
libs/llm, libs/sse  adaptador OpenAI-compatível (OpenRouter e servidores locais), parser SSE
database/*          Database.agent em fake, sqlite (celular) e prisma (desktop)
composition/build.agent.ts   monta tudo (as bordas só fornecem plataforma)
```

Bordas: `src/react/main/services/agent.*` (IPC do Electron, `AgentRuntime`) e
`src/react-native/composition/build.mobile.agent.ts` (celular). Telas em
`src/react/renderer/screens/agent/` e `src/react-native/screens/agent/`; a lógica de tela vive em
funções puras de `app/agent/view/` e é compartilhada.

## O grafo

`docs/agent/graph.md` (gerado por `npm run agent:graph` a partir de `agent.graph.ts`; um teste
falha se estiver desatualizado). Resumo: `route → answer | react`, `react → tools | respond`,
`tools → react`, `respond → react (uma correção) | END`. Estouro de passos, tempo ou custo entrega o
que já foi apurado (`partial.answer`).

## Receitas

**Adicionar uma ferramenta de consulta**: crie `app/agent/tools/<id>.agent.tool.ts` (`id` snake_case,
`effect: 'read'`, schema Zod **sem `userId`**), devolva `buildToolResult` com `facts` para todo valor
que a resposta possa citar, passe textos livres do usuário por `sanitizeText`, registre em
`default.agent.tools.ts` e escreva o teste (fatos corretos, usuário errado, amostra ≤ 10).

**Adicionar um nó**: um arquivo em `graph/nodes/` com `defineNode` (o compilador recusa uma
transição fora de `to`), inclua em `agent.graph.ts`, ponha o rótulo em `node.labels.ts` e rode
`npm run agent:graph`.

**Adicionar um adaptador de LLM**: implemente `LlmPort` (só `stream`), passe a suíte de contrato
`tests/agent/llm/llm.port.contract.ts` e monte-o em `app/agent/llm/build.llm.port.ts`.

## Onde ficam os dados e os segredos

- Conversas, mensagens, execuções e passos (trace): `Database.agent` — SQLite do celular e Postgres
  do desktop; **não sincronizam** e **não entram no backup**.
- Configuração dos modelos: desktop `userData/agent-models.json` (cifrado com o `SecretBox`);
  celular `deviceSettings.ai.agent`. **Chave de API**: no mesmo arquivo cifrado (desktop) ou no
  Keystore (celular, reaproveitando a entrada da captura). Nunca em log, trace, evento ou erro
  (`tests/agent/security/secrets.scan.test.ts` varre tudo).
- Trace: gravado em segundo plano (`StoreTrace`, fila de 500) e resumido no `LogSink` da spec 017;
  falha do trace vira aviso e nunca atrasa a resposta.

## Preferências e compactação (spec 032)

- **Preferências**: `domain/preference/` (puro: ciclo de vida, conflito por tópico, seleção por
  escopo e privacidade, guardas de autonomia/privacidade e de dado sensível) e `app/agent/preference/`
  (ferramentas de memória `remember/forget/list_preferences` só no intent `preference`, aprendizado
  organico, casos de uso da tela). Única entidade sincronizada (`preference`, "última escrita vence");
  sinais, recusas, avisos e resumos ficam só no aparelho.
- **Limiares** (constantes nomeadas em `domain/preference/lifecycle/constants.ts`): candidata com 3
  sinais em 30 dias; expira em 45 dias sem reforço; aprendida ativa sem uso por 180 dias é desativada;
  recusa lembrada por 90 dias (vence com 6 sinais); meia-vida da confiança 30 dias. Ajuste só ali.
- **Aprendizado**: regras locais sobre mensagens do usuário (`app/agent/preference/learn/signal.rules.ts`
  é o catálogo; um gosto novo é uma linha + teste). O modelo só refina a redação de uma candidata nova,
  e só se a política de consentimento/modo local permitir. Roda depois da resposta (`AfterTurnHooks`).
- **Privacidade**: global = vai à nuvem; conta/categoria = privada até liberar. O prompt é composto em
  `context/compose.system.ts` (base → modo → preferências → resumo), ordem estável para o cache.
- **Compactação**: `app/agent/compaction/` — gatilho 70% da janela (50% se ≤ 16 384 tokens), bloco =
  tudo menos as 8 últimas, resumo incremental validado (sem valores, ids do catálogo), falha cai no
  descarte seguro (`CompactingContextStrategy`). O histórico nunca é alterado.
- **Logs**: o `input` dos canais `agent:preferences.*` segue a regra da spec 017 (sem mascarar); o
  resumo e as preferências não entram no `LogSink` do trace.

## Planos e escrita segura (spec 033)

- **Único caminho de escrita**: a ferramenta `propose_changes` (`effect: 'write'`, só no registro de
  planejamento do intent `write_request`). Ela **nunca grava**: `ProposePlan` monta os itens com os
  adaptadores das 14 operações (`app/agent/plan/operations/`), verifica (`plan/verify/`: datas
  −5a..+1a, duplicata, limite do cartão, divergência do pedido, confiança) e salva um plano `pending`.
- **Motor** (`app/agent/plan/engine/`): aprovar = idempotência → validade (24 h) → seleção/edições →
  revalidação por `beforeFingerprint` (dado mudou ⇒ `stale`) → registra `approved` → aplica **numa
  única `Database.transaction`** pelos MESMOS casos de uso das telas (`Container.agentWriters`).
  Falha ⇒ rollback total, plano volta a `pending` com `lastError`. `recoverPlans` reaplica o que ficou
  `approved` após fechar o app.
- **Desfazer**: cada aplicação guarda `touched` (antes/depois dos registros pelos codecs do sync);
  `revertApplication` restaura em ordem inversa e pula o item editado depois (`edited_since`). Categoria
  criada pelo plano é mantida (o app não exclui categorias).
- **Autonomia** (`domain/autonomy`): política local por aparelho, só via `agent:autonomy.set` (tela
  de configuração); 9 chaves, padrão tudo desligado, R$ 200 / 10 itens; `evaluateAutonomy` pura. Excluir,
  transferir e pagar fatura não têm chave. O agente não tem ferramenta para aprovar nem mudar política.
- **Regras de categorização**: evidência a cada categorização que o usuário aprova (2 iguais em 90 dias
  ⇒ sugestão no cartão do plano); `categorizationRule` é a única entidade nova que sincroniza (backup
  v5, LWW, hub exige `backupSchemaVersion ≥ 5`).
- **Limites v1**: recorrência e compras parceladas ficam nas telas; transações de série/parcela/
  transferência/fatura não são editadas pelo agente.
- Avaliação: `npm run agent:evals -- --suite write` (12 cenários; ≥ 95% sem edição, 0 valores trocados,
  0 gravações sem aprovação).

## Capacidades dinâmicas (spec 034)

O assistente pode **pedir** uma capacidade que o app não tem — um servidor MCP remoto (ex.: cotação de moedas) ou uma
skill de instruções — e o **usuário aprova** num cartão. Nada é conectado, instalado nem usado antes disso.

- **Fluxo**: lacuna ⇒ `find_capability` (cria até 3 pedidos `pending` com o candidato **da fonte**, nunca do modelo) ⇒
  cartão na conversa (parte `capability_request`) ⇒ **só a UI** aprova (`agent:capabilities.approve` / `AgentService`)
  ⇒ conecta, lista as ferramentas, compara com o declarado e **fixa a identidade** ⇒ a UI manda "Aprovei a
  capacidade X. Continue o pedido anterior." e o agente retoma com `list_capability_tools` → `call_capability_tool`
  (ou `read_skill`). Não existe ferramenta, tecla de autonomia nem canal do agente que aprove ou conecte.
- **Catálogo** (`app/agent/capability/catalog`): curado do app (selo *Curado*) > registro oficial de MCP (selo *Registro
  oficial*) > skills.sh / GitHub / URL colada pelo usuário (selo *Não verificado*, passo extra: digitar o nome do
  publicador). Máximo de 3 candidatos; Android só recebe MCP remoto (https) e skills de instruções. **As entradas
  curadas atuais são exemplos (`*.exemplo.com.br`): troque por endereços verificados antes de distribuir.**
- **Defesas** (`app/agent/capability/safety`): resultado externo é **dado** (`<dados origem="capacidade:slug">`, controles
  removidos, 6 000 caracteres, segredos mascarados, texto que dá ordens é **marcado** e registrado, nunca obedecido); a
  **barreira de saída** só deixa sair valor/data/id que o usuário escreveu (mensagens recentes) ou que uma consulta do app
  trouxe (valores vindos de capacidade externa podem ser **citados**, mas não contam como "já conhecidos" para planos);
  argumentos validados contra o schema fixado; no máximo 3 chamadas externas por resposta; identidade
  (nome+descrição+schema de cada ferramenta, hash por arquivo de skill) reverificada no 1º uso da sessão ⇒ mudou =
  `needs_review` + novo cartão "Aprovar de novo" com a diferença. Capacidade **nunca escreve**: escrita só por
  `propose_changes` (033).
- **Transporte** (`libs/mcp`): cliente Streamable HTTP próprio (JSON ou SSE, `Mcp-Session-Id`, 1 re-init em 404,
  `redirect:'manual'` ⇒ erro, https salvo o servidor local de desenvolvimento por aparelho, 1 MiB / 30 s / 15 s ocioso);
  credencial só vai ao host fixado e vive no `SecretStorePort` (`agent.key.cap.<id>.<Cabeçalho>`), nunca no chat, no
  log, no trace nem nas mensagens ao modelo.
- **Skills**: pasta de **texto** (≤ 200 arquivos, ≤ 5 MB, sem link simbólico, script, binário ou caminho que escapa), hash
  por arquivo, guardadas no banco do aparelho; lidas por `read_skill` como dado, com a ressalva de que o prompt do sistema
  vence.
- **Dados**: `Database.capabilities` (capacidades, pedidos, usos, arquivos de skill) é **local por aparelho e usuário**:
  não sincroniza nem entra no backup. Histórico de uso: 90 dias.
- **Telas**: cartão de aprovação na conversa, *Capacidades conectadas* (desktop `/assistente/capacidades`; celular
  *Mais › Capacidades*) com pausar/retomar/revogar (apaga as credenciais na hora), histórico do que foi enviado e
  recebido; a *Execução do agente* mostra a chamada externa e a marca de injeção ou bloqueio.
- **Origem no Maia**: os provedores do catálogo foram portados de `maia-cli` e rastreados em
  `src/libs/catalog/maia.origin.json`. `npm run maia:origin:verify` mostra o que mudou no Maia; `:gate` roda antes de
  `dist:appimage`, `dist:flatpak`, `mobile:build:apk` e `release` e **reprova** se algo de segurança do Maia
  (`guardrails/`, `agent/access/`, `agent/catalog/lock/`, `agent/catalog/providers/`, `SECURITY.md`, entrada nova no
  `CHANGELOG.md`) mudou; depois da revisão, `:sync` atualiza o registro (`--ack <arquivo>` para os adaptados).
- Avaliação: `npm run agent:evals -- --suite capability` (10 cenários; cartão certo em 100%, 0 conexões sem aprovação,
  0 candidatos fabricados).

## Configuração simplificada (spec 035)

- **Catálogo** (`domain/agent/provider/`): um arquivo por provedor (`provider.openrouter.ts`, `provider.google.ts`,
  `provider.ollama.ts`) com endereço, origem, chave esperada, modelos preferidos, plataformas e hosts do guia.
  **Para acrescentar um provedor compatível**: crie `provider.<id>.ts`, inclua o id em `PROVIDER_IDS` e em `PROVIDERS`,
  escreva `app/agent/guide/<id>.guide.ts` (+ imagens em `src/assets/guide/` ≤ 300 KB, ids em `guide.image.id.ts`)
  e registre em `guides.ts`; as telas não mudam.
- **Teste em etapas** (`app/agent/setup/test.setup.use.case.ts`): rascunho em memória → `ConnectionReport` com 5
  etapas (`reach`, `key`, `model`, `tools`, `context`; `ok|failed|warn|skipped`). O modelo padrão é **provado**
  (`pick.default.model.ts`: `openrouter/auto` e a lista curta passam pela sonda de ferramentas). Contexto mínimo
  8 192 / recomendado 16 384 tokens (Ollama: `/api/ps` ou sonda de enchimento; nunca enchimento na nuvem).
  `describe.connection.report.ts` é a **função única** de texto (desktop e Android).
- **Salvar** (`save.setup.use.case.ts`) reexecuta o teste no servidor; `warn` exige `confirmWarnings`; perfil + chave
  vão juntos. Canais `agent:setup.get|test|save|clearKey` e `agent:app.openExternal` (só `https` de hosts do catálogo);
  `setup.test`/`setup.save` estão em `CREDENTIAL_OPERATIONS`.
- **Avisos na conversa**: `key_rejected`, `key_expired`, `quota_exhausted` (substituem o texto genérico do erro) e
  `fallback_used` (uma vez por resposta). Nenhuma troca de modelo é silenciosa.
- **Google**: interface compatível com OpenAI (`Authorization: Bearer`), ids `models/…` normalizados, erro 400 "API
  key not valid" = chave recusada, tool call sem `index`/`id` tolerado.
- **Testes e2e**: `FINCTRL_TEST_PROVIDER_URLS` (endereços dos provedores de mentira) e `FINCTRL_TEST_OPEN_EXTERNAL=1`
  (registra os links em vez de abrir o navegador).

## Anexos no chat (spec 036)

- **Pipeline** (`app/agent/attachment/`): `PrepareAttachmentUseCase` valida o tamanho **antes** de extrair, detecta o
  tipo por extensão **e** assinatura (`detect.attachment.kind.ts`), extrai localmente (`extract/extract.<fmt>.ts`: txt,
  csv, xlsx com `fflate`, pdf via `PdfTextPort` → `pdfjs-dist` **fixado em 4.10.38**, imagem via `ImageReducerPort`)
  e guarda um **rascunho em memória** (`AttachmentDraftStore`, TTL 1 h, nunca em disco). O envio (`attachmentIds`) consome
  os rascunhos e grava o `Attachment` (id = id do rascunho) no `AgentStorePort.attachments`.
  **Para acrescentar um formato**: um `extract.<fmt>.ts` + um caso em `detect.attachment.kind.ts` + o `kind` em
  `domain/agent/attachment/attachment.kind.ts`; nada mais muda.
- **Portões** (`gate/check.attachment.gates.ts`, rodados no servidor **antes de qualquer requisição**; `agent:attachment.check`
  é só conforto da tela): somente local × nuvem → visão → consentimento de anexos (`agent-attachments-v1`, tipo próprio em
  `ConsentRecord.kind`) → rascunho lendo → janela do modelo (`attachmentTextBudget`: 40% do espaço livre, teto 48 000
  caracteres; `null` = bloqueia).
- **Conteúdo para o modelo**: bloco `<dado_externo origem="anexo">` numa parte de texto **separada** da pergunta
  (roteamento, memória e verificação leem só a primeira parte). O que não cabe é lido por `read_attachment` (por páginas).
  Imagens (`image_url` JPEG) só com `capabilities.vision`: as da mensagem atual e das 2 mensagens anteriores com anexo, no
  máximo 3. Totais calculados pelo app entram no ledger como fatos; **valor lido de imagem não é fato** (aviso "li da imagem").
- **Plano**: `propose_changes` aceita `attachmentId`; itens ganham `origin: 'attachment'`, **nunca** são auto-aplicados e,
  se a origem é imagem, vêm desmarcados com `low_confidence`.
- **Privacidade**: conteúdo nunca em log/trace/execução (`redact.attachment.parts`, `redactAgentState`; `agent:attachment.prepare`
  e `.open` estão em `CREDENTIAL_OPERATIONS`); fora do backup e do sync (`no.backup.no.sync.test.ts`).
- **Android**: `platform/attachments/` (seletor de arquivos/imagens/câmera, leitura com checagem de tamanho antes de ler,
  redutor `expo-image-manipulator`, PDF por `pdfjs` com recusa segura se o motor não carregar). Módulos nativos novos
  exigem **reconstruir o APK**.

## Várias conversas, arquivos do computador e relatórios (spec 040)

- **Conversas em paralelo**: `ActiveRuns` aceita até 5 execuções ao mesmo tempo (`MAX_CONCURRENT_RUNS`; a 6ª é recusada com
  `ConcurrencyLimitError`). `AgentActivityTracker` (`app/agent/runs/`) deriva, só dos eventos, o estado de cada conversa
  (`running`, `awaiting_user` por plano/capacidade/limite/pasta/edição, `completed`, `failed`, `interrupted`); alimenta o ícone de
  chat, o menu da bandeja e o `AgentConversationNotifier`, que avisa no desktop (texto genérico) quando uma conversa termina ou
  espera a pessoa e repete o aviso a cada 4 h. A execução vive no processo principal: fechar a janela não a interrompe.
- **Arquivos com permissão** (`app/agent/folders/`, `app/agent/tools/files/`): ferramentas `search_files`, `read_file`,
  `create_file`, `edit_file` e `request_folder_access` têm o efeito `'file'`, aceito só pelo **registro próprio e desktop-only**
  (`createFileToolRegistry`); os registros de consulta, memória e planejamento o recusam. A ferramenta nunca decide permissão:
  `FileGate.ensure(path, access)` resolve o `realpath` (links simbólicos), recusa `..`, aplica a *deny list* (dados do app,
  `~/.ssh`, `.env*`…), procura uma concessão (`resolveWithinGrant`) e, se faltar, **bloqueia a execução** com um cartão no chat
  (`folder_permission_requested`) até a pessoa agir. Concessão só nasce do clique na UI (`FolderBroker.decide/addGrant`), nunca de
  ferramenta ou texto do modelo. Editar fora de um repositório git exige prévia aprovada; criar nunca sobrescreve. O tempo de
  espera pela pessoa sai do orçamento de tempo da execução (`RunnerContext.waited`).
- **Conteúdo de arquivo é dado**: o texto volta embrulhado em `<dados>` (`wrapExternalResult`), com marca de injeção
  (`detectInjection`); o trace guarda só o caminho (`redactFileToolArgs`), nunca o conteúdo.
- **Todos os valores legíveis viram fatos**: `ValueFactCollector` extrai cada valor/data/quantidade das células e do texto
  (CSV, XLSX, PDF, anexos e arquivos), e `callDerivedFacts` registra a quantidade de itens e as datas pedidas por cada consulta:
  o que o dado diz não é mascarado como "(valor não confirmado)"; valor inventado continua sendo.
- **Relatórios** (`app/agent/tools/report/`): `write_report` recebe um `ReportSpec` (blocos `text`, `table`, `chart`), **confere
  todo número contra o ledger da execução** (`validateReportFigures`; divergência → `ReportDataMismatchError`, nada é gravado),
  renderiza de forma determinística — HTML autocontido com SVG, tema claro/escuro e sem script (`renderReportHtml`,
  `renderChartSvg`) ou Markdown com barras ASCII — e grava numa pasta autorizada. O modelo nunca escreve HTML.
- **Limites por pedido**: padrão de 40 passos, 5 min e US$ 1,00 (configuráveis até 100 / 30 min / US$ 20) e 60 consultas por
  resposta; o padrão antigo guardado migra sozinho para o novo.

## Qualidade

`npm run agent:evals -- --suite compaction`: 12 cenários de conversa que estoura a janela 3–5 vezes;
fidelidade ≥ 95%, 0 valores repetidos da memória, histórico íntegro, prefixo estável.

`npm run agent:evals` (veja [evals.md](evals.md)): 62 cenários sobre uma base sintética; limiares de
exatidão ≥ 95%, 0 valores inventados, 0 escritas indevidas.

## Pontos de extensão das specs 032–040

- **032** (preferências e compactação): **implementada** — `CompactingContextStrategy` envolve o
  descarte seguro; partes `suggestion`, `preferences_applied` e `summary_marker` em
  `domain/agent/message.part.ts`.
- **033** (planos e autonomia): **implementada** — veja a seção "Planos e escrita segura".
- **034** (capacidades dinâmicas): **implementada** — veja a seção "Capacidades dinâmicas".
- **035–040** (configuração simples, anexos, inteligência, roteamento em 3 níveis com métricas, configuração por cartões e
  sincronização com o celular, conversas em paralelo/arquivos/relatórios): **implementadas** — veja as seções acima.

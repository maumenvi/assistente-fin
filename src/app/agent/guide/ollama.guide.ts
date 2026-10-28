import { type Guide } from './guide.ts';

const PRINT: readonly [number, number] = [1126, 883];
const ILLUSTRATION: readonly [number, number] = [900, 560];

/** Guia do Ollama (so desktop): instalar, baixar o modelo, janela de contexto e escolher no app. */
export const OLLAMA_GUIDE: Guide = {
  id: 'ollama',
  title: 'Como configurar o Ollama neste computador',
  intro: 'O **Ollama** roda o modelo **no seu computador**: nada sai daqui e não precisa de chave. Em troca, precisa de um computador razoável (16 GB de memória é o ideal) e de algum espaço em disco. São 4 passos.',
  steps: [
    {
      id: 'install',
      title: 'Instale o Ollama',
      markdown: 'Abra a [página de download do Ollama](https://ollama.com/download), escolha o seu sistema (**macOS**, **Linux** ou **Windows**) e siga a instrução. No Linux é só copiar e colar o comando no terminal.',
      figure: { image: 'ollama.download', aspect: PRINT, caption: 'Captura de tela do site do Ollama em 23/10/2026: o sistema e o comando de instalação.', highlights: [{ label: 'A', rect: { x: 37.8, y: 34.2, w: 19, h: 4.4 } }, { label: 'B', rect: { x: 2.8, y: 40.2, w: 54, h: 6.4 } }], cropBottomPct: 25 },
    },
    {
      id: 'pull',
      title: 'Baixe o modelo recomendado',
      markdown: 'No terminal, rode o comando abaixo (o download tem alguns GB e leva alguns minutos):\n\n```bash\nollama pull qwen3:8b\n```',
      figure: { image: 'illustration.terminal.pull', aspect: ILLUSTRATION, caption: 'Ilustração: o comando para baixar o modelo no terminal.', illustration: true, highlights: [{ label: 'A', rect: { x: 7, y: 25, w: 52, h: 8 } }] },
    },
    {
      id: 'context',
      title: 'Aumente a memória do modelo (contexto)',
      markdown: 'Por padrão o Ollama usa só **4 mil tokens** de memória, pouco para o assistente (o mínimo é 8 mil; o ideal, 16 mil). Feche o Ollama e abra de novo com:\n\n```bash\nOLLAMA_CONTEXT_LENGTH=16384 ollama serve\n```',
      figure: { image: 'illustration.terminal.context', aspect: ILLUSTRATION, caption: 'Ilustração: o comando que liga o Ollama com 16 mil tokens de contexto.', illustration: true, highlights: [{ label: 'A', rect: { x: 7, y: 25, w: 70, h: 8 } }] },
    },
    {
      id: 'paste',
      title: 'Escolha o Ollama no app e teste',
      markdown: 'Em **Configurar assistente**, escolha **Ollama (neste computador)** e toque em **Testar e salvar**. O endereço padrão (`http://localhost:11434`) já vem preenchido e o app escolhe sozinho o melhor modelo instalado.',
      figure: { image: 'illustration.choose.provider', aspect: ILLUSTRATION, caption: 'Ilustração do app: a opção "Ollama (neste computador)".', illustration: true, highlights: [{ label: 'A', rect: { x: 5.5, y: 71.4, w: 89, h: 19.6 } }] },
    },
  ],
};

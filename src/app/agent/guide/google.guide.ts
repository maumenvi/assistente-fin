import { type Guide } from './guide.ts';

const PRINT: readonly [number, number] = [1126, 827];
const ILLUSTRATION: readonly [number, number] = [900, 560];

/** Guia do Google AI (Gemini): chave no Google AI Studio. Prints de 23/10/2026 (interface em português). */
export const GOOGLE_GUIDE: Guide = {
  id: 'google',
  title: 'Como configurar o Google AI (Gemini)',
  intro: 'O **Google AI Studio** dá uma chave **gratuita** (com limites diários) para os modelos **Gemini**. Você só precisa de uma conta Google. São 5 passos.',
  steps: [
    {
      id: 'account',
      title: 'Entre no Google AI Studio',
      markdown: 'Abra o [Google AI Studio](https://aistudio.google.com) e entre com a sua conta Google. No menu da esquerda toque em **Dashboard**. O modelo que o app usa por padrão é o **Gemini 2.5 Flash** (`gemini-2.5-flash`), que usa as ferramentas do app com mais segurança — você não precisa escolhê-lo.',
      figure: { image: 'google.playground', aspect: PRINT, caption: 'Captura de tela do Google AI Studio em 23/10/2026: o menu "Dashboard" e o modelo Gemini 3.8 Flash.', highlights: [{ label: 'A', rect: { x: 0.7, y: 41.6, w: 18, h: 4.2 } }, { label: 'B', rect: { x: 74.9, y: 8.3, w: 22.8, h: 15 } }] },
    },
    {
      id: 'keys',
      title: 'Abra "Chaves de API"',
      markdown: 'Dentro do Dashboard, toque em **Chaves de API** (*API keys*), no menu da esquerda.',
      figure: { image: 'google.keys', aspect: PRINT, caption: 'Captura de tela do Google AI Studio em 23/10/2026: o menu "Chaves de API".', highlights: [{ label: 'A', rect: { x: 0.7, y: 15.1, w: 18, h: 4.2 } }] },
    },
    {
      id: 'create',
      title: 'Toque em "Criar chave de API"',
      markdown: 'No canto superior direito, toque em **Criar chave de API** (*Create API key*). Escolha o projeto padrão (**Default Gemini Project**) quando pedir.',
      figure: { image: 'google.keys', aspect: PRINT, caption: 'Captura de tela do Google AI Studio em 23/10/2026: o botão "Criar chave de API".', highlights: [{ label: 'A', rect: { x: 78.5, y: 5.6, w: 15.8, h: 4.2 } }] },
    },
    {
      id: 'key',
      title: 'Copie a chave',
      markdown: 'A chave nova aparece na lista. Toque no ícone de **copiar** ao lado dela. É como uma senha: **não mostre a ninguém**. Você pode abrir a [lista de chaves](https://aistudio.google.com/api-keys) quando quiser.',
      figure: { image: 'google.keys', aspect: PRINT, caption: 'Captura de tela do Google AI Studio em 23/10/2026: a chave (coberta) e o ícone de copiar.', highlights: [{ label: 'A', rect: { x: 25, y: 38.8, w: 6.2, h: 6 } }, { label: 'B', rect: { x: 77.4, y: 41.5, w: 1.9, h: 2.6 } }] },
    },
    {
      id: 'paste',
      title: 'Cole no app e teste',
      markdown: 'Em **Configurar assistente**, escolha **Google AI (Gemini)**, cole a chave e toque em **Testar e salvar**. O app confere a chave, o modelo e a consulta aos seus dados.',
      figure: { image: 'illustration.paste.key', aspect: ILLUSTRATION, caption: 'Ilustração do app: o campo da chave e o botão "Testar e salvar".', illustration: true, highlights: [{ label: 'A', rect: { x: 5.5, y: 19.4, w: 89, h: 13.8 } }, { label: 'B', rect: { x: 5.5, y: 51.8, w: 89, h: 13.8 } }] },
    },
  ],
};

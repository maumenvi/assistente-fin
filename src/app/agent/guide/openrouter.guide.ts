import { type Guide } from './guide.ts';

const PRINT: readonly [number, number] = [1126, 827];
const ILLUSTRATION: readonly [number, number] = [900, 560];

/** Guia do OpenRouter: conta, chave (validade longa e limite de gasto), copiar e colar no app. Prints de 23/10/2026. */
export const OPENROUTER_GUIDE: Guide = {
  id: 'openrouter',
  title: 'Como configurar o OpenRouter',
  intro: 'O **OpenRouter** é um serviço em nuvem com **uma chave só para vários modelos**. O app escolhe um modelo que funciona sozinho. São 6 passos rápidos; você precisa de uma conta e de um cartão para colocar saldo (a chave pode ter um limite de gasto).',
  steps: [
    {
      id: 'account',
      title: 'Crie a sua conta',
      markdown: 'Abra o [OpenRouter](https://openrouter.ai) e toque em **Sign Up** (canto superior direito). Entre com o Google, o GitHub ou o e-mail.',
      figure: { image: 'openrouter.home', aspect: PRINT, caption: 'Captura de tela do OpenRouter em 23/10/2026: o botão "Sign Up".', highlights: [{ label: 'A', rect: { x: 89, y: 1.2, w: 8, h: 4.6 } }], cropBottomPct: 40 },
    },
    {
      id: 'new-key',
      title: 'Abra "API Keys" e toque em "New Key"',
      markdown: 'Já com a conta criada, abra as [chaves de API](https://openrouter.ai/keys). No menu da esquerda toque em **API Keys** e depois no botão **New Key** (canto superior direito).',
      figure: { image: 'openrouter.keys', aspect: PRINT, caption: 'Captura de tela do OpenRouter em 23/10/2026: o menu "API Keys" e o botão "New Key".', highlights: [{ label: 'A', rect: { x: 1.4, y: 26, w: 17.5, h: 4.6 } }, { label: 'B', rect: { x: 87, y: 8.6, w: 9.6, h: 4.4 } }] },
    },
    {
      id: 'validity',
      title: 'Dê um nome e escolha uma validade longa',
      markdown: 'Em **Name** escreva, por exemplo, `assistente-fin`. Em **Expiration** troque o padrão (**1 day**, só um dia!) por uma validade longa, como **Never** ou um ano — senão a chave vence e o assistente para de responder.',
      figure: { image: 'openrouter.form', aspect: PRINT, caption: 'Captura de tela do OpenRouter em 23/10/2026: os campos "Name" e "Expiration".', highlights: [{ label: 'A', rect: { x: 28.8, y: 16.5, w: 41.2, h: 5.4 } }, { label: 'B', rect: { x: 28.8, y: 28.6, w: 41.2, h: 5.4 } }] },
    },
    {
      id: 'credit-limit',
      title: 'Defina um limite de gasto (Credit limit)',
      markdown: 'Em **Credit limit** escolha **Custom amount** e digite um valor, por exemplo `5` (dólares). Quando a chave gastar esse total, o OpenRouter para de aceitar pedidos — assim você nunca paga além do que definiu. Depois toque em **Create**.',
      figure: { image: 'openrouter.form', aspect: PRINT, caption: 'Captura de tela do OpenRouter em 23/10/2026: o "Credit limit", o valor e o botão "Create".', highlights: [{ label: 'A', rect: { x: 30.2, y: 50.6, w: 39, h: 5.4 } }, { label: 'B', rect: { x: 30.2, y: 56.1, w: 39, h: 5.4 } }, { label: 'C', rect: { x: 64, y: 84.7, w: 6, h: 5 } }] },
    },
    {
      id: 'key',
      title: 'Copie a chave',
      markdown: 'A chave aparece **uma única vez**. Toque no botão de copiar ao lado dela e guarde num lugar seguro. Ela é como uma senha: **não mostre a ninguém**.',
      figure: { image: 'openrouter.created', aspect: PRINT, caption: 'Captura de tela do OpenRouter em 23/10/2026: a chave criada (coberta) e o botão de copiar.', highlights: [{ label: 'A', rect: { x: 30, y: 31, w: 29, h: 6 } }, { label: 'B', rect: { x: 59.4, y: 32, w: 3, h: 4 } }] },
    },
    {
      id: 'paste',
      title: 'Cole no app e teste',
      markdown: 'Em **Configurar assistente**, escolha **OpenRouter**, cole a chave no campo e toque em **Testar e salvar**. O app confere a chave, o modelo e a consulta aos seus dados — e diz o que corrigir se algo falhar.',
      figure: { image: 'illustration.paste.key', aspect: ILLUSTRATION, caption: 'Ilustração do app: o campo da chave e o botão "Testar e salvar".', illustration: true, highlights: [{ label: 'A', rect: { x: 5.5, y: 19.4, w: 89, h: 13.8 } }, { label: 'B', rect: { x: 5.5, y: 51.8, w: 89, h: 13.8 } }] },
    },
  ],
  closing: 'Para repor crédito depois, abra [as configurações de crédito](https://openrouter.ai/settings/credits).',
};

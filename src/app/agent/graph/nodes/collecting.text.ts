import { type LlmEvent } from '../../ports/llm/llm.event.ts';
import { type LlmUsage } from '../../ports/llm/llm.usage.ts';

/** Texto completo e uso de uma geracao so de texto. */
export interface CollectedText {
  readonly text: string;
  readonly usage: LlmUsage | null;
}

/** Consome um stream repassando cada pedaco de texto assim que chega (`onDelta`) e devolve o total. */
export async function collectingText(events: AsyncIterable<LlmEvent>, onDelta: (text: string) => void): Promise<CollectedText> {
  let text = '';
  let usage: LlmUsage | null = null;
  for await (const event of events) {
    if (event.type === 'text_delta') {
      text += event.text;
      onDelta(event.text);
    } else if (event.type === 'usage') {
      const { type: _type, ...rest } = event;
      usage = rest;
    }
  }
  return { text, usage };
}

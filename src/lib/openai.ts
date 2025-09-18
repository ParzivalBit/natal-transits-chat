// src/lib/openai.ts
type ChatRole = 'system' | 'user' | 'assistant';

export type ChatMessage = { role: ChatRole; content: string };

function getModel(envName: 'OPENAI_MODEL_CHAT' | 'OPENAI_MODEL_REFINER', fallback: string): string {
  const m = process.env[envName];
  return (m && m.trim().length > 0) ? m : fallback;
}

export async function chatComplete(messages: ChatMessage[], useRefiner = false): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  const model = useRefiner
    ? getModel('OPENAI_MODEL_REFINER', 'gpt-4o-mini')
    : getModel('OPENAI_MODEL_CHAT', 'gpt-4o-mini');

  const body = {
    model,
    messages,
    temperature: 0.8,
    top_p: 1,
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`OpenAI error ${res.status}: ${txt}`);
  }
  const data: unknown = await res.json();
  // type guard minimale
  const msg = (data as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content;
  if (typeof msg !== 'string' || msg.length === 0) {
    throw new Error('OpenAI returned empty message');
  }
  return msg.trim();
}

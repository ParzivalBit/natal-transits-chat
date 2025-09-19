'use client';

import React, { useMemo, useRef, useState } from 'react';
import { systemChat } from '@/ai/systemPrompts';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

type Props = {
  /** Contesto da /api/compat/[id] (CONTEXT_*, PEER_SUMMARY, ecc.) */
  initialContext?: string;
  /** Se vuoi passare un system prompt già unito, questo ha priorità */
  systemPrompt?: string;
  /** Endpoint della chat (default: /api/chat) */
  endpoint?: string;
};

/* ---------- Type guards & helpers (no any) ---------- */
function isRecord(o: unknown): o is Record<string, unknown> {
  return typeof o === 'object' && o !== null;
}
function isTextHolder(o: unknown): o is { text: string } {
  return isRecord(o) && typeof o.text === 'string';
}
function get(obj: unknown, path: Array<string | number>): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (!isRecord(cur) && !Array.isArray(cur)) return undefined;
    if (typeof key === 'number') {
      if (!Array.isArray(cur) || key < 0 || key >= cur.length) return undefined;
      cur = cur[key];
    } else {
      const rec = cur as Record<string, unknown>;
      if (!(key in rec)) return undefined;
      cur = rec[key];
    }
  }
  return cur;
}

/** Estrae testo da stringhe o array di blocchi con {text} (OpenAI/Anthropic-like) */
function extractFromContentField(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts = content
      .map((c) => (typeof c === 'string' ? c : isTextHolder(c) ? c.text : ''))
      .filter(Boolean);
    return parts.join('');
  }
  if (isTextHolder(content)) return content.text;
  return '';
}

/** Estrae il testo dai formati JSON più comuni (aggiunge anche supporto a { answer: "..." }) */
function extractTextFromJSON(json: unknown): string {
  if (!isRecord(json)) return '';

  // Diretti (incluso 'answer')
  const direct =
    get(json, ['answer']) ??            // <-- supporto al tuo backend
    get(json, ['reply']) ??
    get(json, ['content']) ??
    get(json, ['message']) ??
    get(json, ['text']) ??
    get(json, ['output_text']) ??
    get(json, ['result', 'text']) ??
    get(json, ['data', 0, 'text']) ??
    get(json, ['generations', 0, 'text']);
  const directStr = extractFromContentField(direct);
  if (directStr) return directStr;

  // OpenAI chat (non stream)
  const msgContent = get(json, ['choices', 0, 'message', 'content']);
  const msgStr = extractFromContentField(msgContent);
  if (msgStr) return msgStr;

  // Delta anche senza stream
  const deltaContent = get(json, ['choices', 0, 'delta', 'content']);
  const deltaStr = extractFromContentField(deltaContent);
  if (deltaStr) return deltaStr;

  // Anthropic-like
  const anthropicStr = extractFromContentField(get(json, ['content']));
  if (anthropicStr) return anthropicStr;

  return '';
}

/** Normalizza il testo per l’utente: niente **grassetti**, niente \n raw, bullet carini */
function normalizeOutput(text: string): string {
  let t = text;

  // Se accidentalmente è stato passato un JSON in stringa, prova a leggerlo
  if (t.trim().startsWith('{') && t.includes('"answer"')) {
    try {
      const parsed = JSON.parse(t) as unknown;
      const fromJson = extractTextFromJSON(parsed);
      if (fromJson) t = fromJson;
    } catch {
      // ignore
    }
  }

  // Unifica newline e rimuovi escape visivi
  t = t.replace(/\r\n/g, '\n');
  t = t.replace(/\\n/g, '\n').replace(/\\t/g, '    ');

  // Rimuovi markdown base
  t = t.replace(/\*\*(.*?)\*\*/g, '$1'); // **bold** -> bold
  t = t.replace(/\*(.*?)\*/g, '$1');     // *italic* -> italic (semplice)

  // Bullet list più leggibili
  t = t.replace(/^\s*-\s+/gm, '• ');

  // Collassa e rifinisci
  t = t.replace(/\n{3,}/g, '\n\n').trim();
  return t;
}
/* ---------------------------------------------------- */

export default function ChatUI({
  initialContext = '',
  systemPrompt,
  endpoint = '/api/chat',
}: Props) {
  // 1) Costruisci il messaggio di sistema unendo regole + contesto
  const finalSystem = useMemo(() => {
    if (systemPrompt && systemPrompt.trim()) return systemPrompt.trim();
    const blocks: string[] = [];
    if (systemChat) blocks.push(systemChat.trim());
    if (initialContext) blocks.push(initialContext.trim());
    return blocks.join('\n\n').trim();
  }, [systemPrompt, initialContext]);

  // Stato messaggi: includi il system come primo messaggio (non mostrato)
  const [messages, setMessages] = useState<Msg[]>(
    finalSystem ? [{ role: 'system', content: finalSystem }] : []
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const streamingRef = useRef(false);

  function pushUserMessage(text: string) {
    setMessages(prev => [...prev, { role: 'user', content: text }]);
  }
  function startAssistantMessage() {
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
  }
  function appendToAssistant(chunk: string) {
    setMessages(prev => {
      const out = [...prev];
      const last = out[out.length - 1];
      if (!last || last.role !== 'assistant') return out;
      last.content = (last.content || '') + chunk;
      return out;
    });
  }
  function setAssistant(text: string) {
    setMessages(prev => {
      const out = [...prev];
      const last = out[out.length - 1];
      if (!last || last.role !== 'assistant') out.push({ role: 'assistant', content: text });
      else last.content = text;
      return out;
    });
  }
  function normalizeLastAssistant() {
    setMessages(prev => {
      const out = [...prev];
      const last = out[out.length - 1];
      if (last && last.role === 'assistant') {
        last.content = normalizeOutput(last.content || '');
      }
      return out;
    });
  }

  // SSE (OpenAI style)
  async function readSSE(res: Response) {
    const reader = res.body?.getReader();
    if (!reader) { setAssistant('Errore: stream non disponibile.'); return; }
    streamingRef.current = true;
    startAssistantMessage();

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') { streamingRef.current = false; normalizeLastAssistant(); return; }
        try {
          const parsed: unknown = JSON.parse(data);
          const piece =
            extractFromContentField(get(parsed, ['choices', 0, 'delta', 'content'])) ||
            extractFromContentField(get(parsed, ['choices', 0, 'message', 'content'])) ||
            extractFromContentField(get(parsed, ['content'])) ||
            '';
          if (piece) appendToAssistant(piece);
        } catch {
          if (data) appendToAssistant(data + '\n');
        }
      }
    }
    streamingRef.current = false;
    normalizeLastAssistant();
  }

  // ——— Send ———
  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setLoading(true);

    pushUserMessage(text);
    setInput('');

    try {
      const payload = {
        messages: [...messages, { role: 'user', content: text } as Msg],
        system: finalSystem,
        prompt: finalSystem ? `${finalSystem}\n\n${text}` : text,
        question: text,
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'accept': 'text/event-stream, application/json, text/plain',
        },
        body: JSON.stringify(payload),
      });

      const ctype = res.headers.get('content-type') || '';

      // Caso 1: SSE
      if (ctype.includes('text/event-stream')) {
        await readSSE(res);
        setLoading(false);
        return;
      }

      // Caso 2: JSON (leggiamo anche raw per fallback)
      if (ctype.includes('application/json')) {
        const raw = await res.clone().text().catch(() => '');
        let assistantText = '';
        try {
          const j: unknown = await res.json();
          assistantText = extractTextFromJSON(j);
        } catch {
          assistantText = '';
        }
        if (!assistantText && raw) {
          // alcuni back-end mandano JSON con content-type sbagliato nella clone
          try {
            const maybe: unknown = JSON.parse(raw);
            assistantText = extractTextFromJSON(maybe);
          } catch {
            assistantText = raw;
          }
        }
        setAssistant(assistantText ? normalizeOutput(assistantText) : 'Non ho ricevuto un contenuto utilizzabile dal modello.');
        setLoading(false);
        return;
      }

      // Caso 3: testo semplice (o content-type non affidabile)
      const textBody = await res.text();
      const clean = (textBody || '').trim();
      // Prova a interpretarlo come JSON con answer; altrimenti normalizza testo
      let final = '';
      if (clean.startsWith('{')) {
        try {
          const maybe: unknown = JSON.parse(clean);
          final = extractTextFromJSON(maybe);
        } catch {
          final = clean;
        }
      } else {
        final = clean;
      }
      setAssistant(final ? normalizeOutput(final) : 'Non ho ricevuto una risposta valida dal modello.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore di rete';
      setAssistant(`Errore: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messaggi (non mostro il system) */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {messages
          .filter(m => m.role !== 'system')
          .map((m, i) => (
            <div
              key={i}
              className={
                m.role === 'user'
                  ? 'ml-auto max-w-[80%] rounded-2xl border px-3 py-2 bg-gray-50'
                  : 'mr-auto max-w-[80%] rounded-2xl border px-3 py-2'
              }
            >
              <div className="whitespace-pre-wrap text-[0.95rem] leading-relaxed">
                {m.content}
              </div>
            </div>
          ))}
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <input
          className="flex-1 rounded-lg border px-3 py-2"
          placeholder='Es. "qual è il segno di questa persona?"'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
        />
        <button
          className="rounded-lg border px-4 py-2 disabled:opacity-50"
          onClick={send}
          disabled={loading || !input.trim()}
        >
          {loading ? (streamingRef.current ? 'Ricevo…' : 'Invio…') : 'Invia'}
        </button>
      </div>

      <p className="mt-2 text-xs text-gray-500">
        La chat mostra solo testo pulito: niente JSON, niente markdown rumoroso.
      </p>
    </div>
  );
}

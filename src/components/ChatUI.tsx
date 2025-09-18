// src/components/ChatUI.tsx
// parametro useEffect rimosso dal primo import perché non era mai utilizzato <-------------
'use client';

import React, { useCallback, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function ChatUI({ initialContext }: { initialContext?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const firstSend = useRef(true);

  // (opzionale) carica storico sessione se già esiste… qui manteniamo semplice

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput('');
    setMsgs((m) => [...m, { role: 'user', content: userText }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [
            // inviamo solo gli ultimi exchange (semplice)
            ...msgs.slice(-10),
            { role: 'user', content: userText },
          ],
          // includiamo contesto ad ogni invio (semplice e robusto)
          context: initialContext,
        }),
      });

      const json = await res.json();
      const answer: string = json?.answer ?? '(no answer)';
      setMsgs((m) => [...m, { role: 'assistant', content: answer }]);
    } catch (err) {
      setMsgs((m) => [
        ...m,
        { role: 'assistant', content: 'Si è verificato un errore. Riprova tra poco.' },
      ]);
    } finally {
      setLoading(false);
      firstSend.current = false;
    }
  }, [input, loading, msgs, initialContext]);

  return (
    <div className="flex h-full flex-col rounded-2xl border">
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {msgs.length === 0 && (
          <div className="text-sm text-gray-500">
            Chiedimi dei transiti del mese, es. “A quali transiti dovrei fare più attenzione?” oppure
            “Spiegami i transiti del 18”.
          </div>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`rounded-xl p-3 text-sm ${
              m.role === 'user' ? 'bg-gray-100' : 'bg-white border'
            }`}
          >
            <div className="text-xs mb-1 text-gray-500">{m.role === 'user' ? 'You' : 'AI'}</div>
            <div>{m.content}</div>
          </div>
        ))}
      </div>

      <div className="border-t p-2">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border px-3 py-2 text-sm"
            placeholder="Scrivi qui..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendMessage();
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {loading ? '...' : 'Invia'}
          </button>
        </div>
      </div>
    </div>
  );
}

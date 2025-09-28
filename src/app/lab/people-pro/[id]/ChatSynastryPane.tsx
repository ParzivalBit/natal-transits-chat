// FILE: src/app/lab/people/[id]/ChatSynastryPane.tsx
"use client";

import React, { useState } from "react";

export type SynastryContext = {
  user: {
    id: string;
    houseSystem: "placidus" | "whole";
    houses?: number[];
    points: { name: string; lon: number; retro?: boolean }[];
    axes?: { AC: number; IC: number; DC: number; MC: number };
  };
  person: {
    id: string;
    name?: string | null;
    houseSystem: "placidus" | "whole";
    houses?: number[];
    points: { name: string; lon: number; retro?: boolean }[];
    axes?: { AC: number; IC: number; DC: number; MC: number };
  };
  aspects: {
    a: { who: "user" | "person"; name: string; lon: number };
    b: { who: "user" | "person"; name: string; lon: number };
    type: "conjunction" | "sextile" | "square" | "trine" | "opposition";
    delta: number; exact: number; strength: number;
  }[];
};

export default function ChatSynastryPane({ context }: { context: SynastryContext }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    { role: "assistant", content: "Ciao! Fammi una domanda sulla sinastria; ho già il contesto calcolato." },
  ]);

  const onSend = async () => {
    if (!input.trim()) return;
    setMessages((m) => [...m, { role: "user", content: input }]);
    // Stub: integra qui il tuo endpoint chat (POST /api/chat) passando { messages, context }
    setMessages((m) => [...m, { role: "assistant", content: "Ricevuto! Userò il contesto di sinastria per risponderti." }]);
    setInput("");
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="mb-2 text-sm font-medium">Chat Sinastria</div>
        <div className="h-64 overflow-auto rounded-md border p-2 text-sm">
          {messages.map((m, i) => (
            <div key={i} className={`mb-2 ${m.role === "user" ? "text-gray-900" : "text-sky-700"}`}>
              <strong>{m.role === "user" ? "Tu" : "Assistente"}:</strong> {m.content}
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            className="flex-1 rounded-md border px-2 py-1 text-sm"
            placeholder="Scrivi…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => (e.key === "Enter" ? onSend() : undefined)}
          />
          <button className="rounded-md bg-gray-900 px-3 py-1 text-sm text-white" onClick={onSend}>
            Invia
          </button>
        </div>
      </div>

      <details className="rounded-lg border border-gray-200 bg-white p-3 text-xs shadow-sm">
        <summary className="cursor-pointer select-none font-medium">Vedi SynastryContext (debug)</summary>
        <pre className="mt-2 max-h-72 overflow-auto">{JSON.stringify(context, null, 2)}</pre>
      </details>
    </div>
  );
}

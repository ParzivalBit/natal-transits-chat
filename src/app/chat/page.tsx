// src/app/chat/page.tsx
import ChatUI from '@/components/ChatUI';

export const dynamic = 'force-dynamic';

export default function ChatPage() {
  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">Chat</h1>
      <ChatUI />
    </div>
  );
}

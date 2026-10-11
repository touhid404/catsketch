import { GuestAvatar } from '../../avatars/components/GuestAvatar';
import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, MessageCircle, Send } from 'lucide-react';
import type { ChatMessage } from '@syncspace/shared';
export default function ChatPanel({
  messages,
  guestId,
  connected,
  onSend,
  notify,
}: {
  messages: ChatMessage[];
  guestId: string;
  connected: boolean;
  onSend: (text: string) => Promise<void>;
  notify: (message: string) => void;
}) {
  const [draft, setDraft] = useState(''),
    [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await onSend(draft.trim());
      setDraft('');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="chat-panel" role="tabpanel">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <MessageCircle size={25} />
            <strong>Start the conversation.</strong>
            <span>
              A quick thought, a useful link,
              <br />
              or just a hello.
            </span>
          </div>
        )}
        {messages.map((message) => (
          <div
            className={`chat-message ${message.guestId === guestId ? 'own-message' : ''}`}
            key={message.id}
          >
            <div>
              <GuestAvatar
                guestId={message.guestId}
                name={message.username}
                className="chat-avatar"
              />
              <strong>{message.username}</strong>
              <time dateTime={message.createdAt}>
                {new Date(message.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </div>
            <p>{message.text}</p>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="chat-composer" onSubmit={send}>
        <input
          aria-label="Chat message"
          placeholder="Share a thought…"
          maxLength={1000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          className="icon-button"
          aria-label="Send message"
          disabled={!draft.trim() || sending || !connected}
        >
          {sending ? <LoaderCircle size={17} className="spin" /> : <Send size={17} />}
        </button>
      </form>
    </div>
  );
}

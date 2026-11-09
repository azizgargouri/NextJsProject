'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { api } from '@/lib/api';
import type { MoveMessageDto } from '@/lib/api/moves';
import { cn } from '@/lib/utils';

const REFRESH_MS = 15_000;

/**
 * Client ↔ mover chat on the tracking page — the same thread the mover sees on
 * the job (MOVER_CLIENT). Open while the move is live (assigned → delivered);
 * read-only afterwards. Refreshes every 15 s, like the rest of the tracking.
 */
export function MoveChat({
  moveId,
  moverName,
  open,
}: {
  moveId: string;
  moverName: string;
  open: boolean;
}) {
  const [messages, setMessages] = useState<MoveMessageDto[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  const load = useCallback(async () => {
    try {
      setMessages(await api.moves.messages(moveId));
      setError(null);
    } catch {
      setError('Messages could not be loaded.');
    }
  }, [moveId]);

  useEffect(() => {
    void load();
    if (!open) return;
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load, open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const message = await api.moves.sendMessage(moveId, body);
      setMessages((current) => [...current, message]);
      setDraft('');
      setError(null);
    } catch {
      setError('The message could not be sent. Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section aria-labelledby="move-chat-title" className="border-b border-ink px-4 py-4">
      <div className="mx-auto max-w-7xl">
        <p
          id="move-chat-title"
          className="mono flex items-center gap-2 text-[10px] font-bold text-ink-60"
        >
          <MessageSquare className="size-3.5" aria-hidden /> MESSAGES WITH {moverName.toUpperCase()}
        </p>

        <ol
          ref={listRef}
          aria-live="polite"
          className="mt-3 max-h-72 space-y-2 overflow-y-auto border border-ink bg-paper p-3"
        >
          {messages.length === 0 ? (
            <li className="mono text-[11px] text-ink-60">
              {open ? 'No messages yet. Ask your mover anything about the move.' : 'No messages.'}
            </li>
          ) : (
            messages.map((message) => (
              <li
                key={message.id}
                className={cn('flex', message.mine ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[80%] border px-3 py-2 text-sm',
                    message.mine ? 'border-ink bg-ink text-paper' : 'border-ink/30 bg-paper-soft',
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  <p
                    className={cn(
                      'mono mt-1 text-[10px]',
                      message.mine ? 'text-paper/70' : 'text-ink-60',
                    )}
                  >
                    {message.mine ? 'You' : message.senderRole === 'ADMIN' ? 'MoveUp' : moverName}
                    {' · '}
                    {new Date(message.createdAt).toLocaleString([], {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </li>
            ))
          )}
        </ol>

        {open ? (
          <form onSubmit={send} className="mt-3 flex gap-2">
            <label htmlFor="move-chat-input" className="sr-only">
              Message to {moverName}
            </label>
            <input
              id="move-chat-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={2000}
              placeholder="Write to your mover…"
              disabled={sending}
              className="min-w-0 flex-1 border border-ink bg-paper px-3 py-2 text-sm outline-none focus-visible:border-hazard"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="mono inline-flex items-center gap-2 bg-ink px-4 text-[11px] text-paper hover:bg-hazard disabled:opacity-50"
            >
              <Send className="size-3.5" aria-hidden /> SEND
            </button>
          </form>
        ) : (
          <p className="mono mt-2 text-[10px] text-ink-60">
            The chat is closed now that the move is finished.
          </p>
        )}
        {error ? (
          <p role="alert" className="mono mt-2 text-[11px] text-hazard">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}

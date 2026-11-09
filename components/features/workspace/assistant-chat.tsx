'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Bot, Loader2, Square, Trash2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useOnlineStatus } from '@/hooks/use-online-status';
import type { ChatHistoryDto } from '@/types';
import { useWorkspace } from './workspace-context';
import { Textarea } from './workspace-ui';

const TOOL_LABELS: Record<string, string> = {
  'tool-listMyClaims': 'Reading your claims',
  'tool-getClaimDetails': 'Opening the claim & Vision AI dossier',
  'tool-getMoverRating': 'Checking mover ratings',
  'tool-estimateCompensation': 'Calculating compensation & liability split',
};

const SUGGESTIONS = {
  CLIENT: [
    'Where are my claims at?',
    'Estimate compensation for a broken glass table (450 TND)',
    'Check details of CLM-DEMO-0001',
    'Which mover has the best rating?',
  ],
  MOVER: [
    'Do I have open claims?',
    'Estimate liability for a 300 TND damaged item',
    'What is my current rating?',
  ],
} as const;

type CachedMessage = { id: string; role: 'user' | 'assistant'; text: string };

function toUIMessage(message: CachedMessage): UIMessage {
  return { id: message.id, role: message.role, parts: [{ type: 'text', text: message.text }] };
}

function textOf(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === 'text' ? (part as { text: string }).text : ''))
    .join('');
}

/**
 * MoveUp assistant — AI SDK UI `useChat` (course ch.6 "Étape 2").
 *  - streaming tokens: each assistant message grows as parts arrive,
 *  - tool calls are visible as small "reading your claims…" chips,
 *  - history: MongoDB (server, cross-device) + localStorage (offline, PWA).
 */
export function AssistantChat() {
  const { user } = useWorkspace();
  const token = useAuthStore((state) => state.accessToken);
  const online = useOnlineStatus();
  const [input, setInput] = useState('');
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [cached, setCached, { loaded }] = useLocalStorage<CachedMessage[]>(
    `moveup-chat-${user?.id ?? 'anon'}`,
    [],
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  // Token read at request time so a refreshed token is always used.
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai/chat',
        headers: (): Record<string, string> => {
          const current = useAuthStore.getState().accessToken;
          return current ? { Authorization: `Bearer ${current}` } : {};
        },
      }),
    [],
  );

  const { messages, setMessages, sendMessage, status, error, stop } = useChat({ transport });

  // 1) show the offline cache instantly, 2) replace it with the server history when online.
  useEffect(() => {
    if (!loaded) return;
    if (cached.length && messages.length === 0) setMessages(cached.map(toUIMessage));
    if (!online) return;
    fetch('/api/ai/chat', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((response) => (response.ok ? (response.json() as Promise<ChatHistoryDto>) : null))
      .then((history) => {
        if (!history) return;
        setEnabled(history.enabled);
        if (history.messages.length) {
          setMessages(
            history.messages.map((message) =>
              toUIMessage({ id: message.id, role: message.role, text: message.content }),
            ),
          );
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once the cache is loaded
  }, [loaded]);

  // Keep the offline copy in sync once an answer is complete.
  useEffect(() => {
    if (status !== 'ready' || messages.length === 0) return;
    setCached(
      messages.slice(-30).map((message) => ({
        id: message.id,
        role: message.role === 'user' ? 'user' : 'assistant',
        text: textOf(message),
      })),
    );
  }, [messages, setCached, status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, status]);

  const busy = status === 'submitted' || status === 'streaming';
  const canSend = online && !busy && enabled !== false && input.trim().length > 0;

  const submit = (text: string) => {
    if (!text.trim() || busy || !online) return;
    void sendMessage({ text: text.trim() });
    setInput('');
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(input);
  };

  const clear = async () => {
    await fetch('/api/ai/chat', {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    setMessages([]);
    setCached([]);
  };

  const suggestions = user?.role === 'MOVER' ? SUGGESTIONS.MOVER : SUGGESTIONS.CLIENT;

  return (
    <div className="flex h-[min(720px,calc(100dvh-14rem))] flex-col border border-ink">
      <div className="flex items-center justify-between border-b border-ink px-4 py-3">
        <p className="mono flex items-center gap-2 text-[11px]">
          <Bot className="size-4 text-hazard" /> MoveUp Assistant
        </p>
        <Button variant="ghost" size="sm" onClick={clear} disabled={busy || messages.length === 0}>
          <Trash2 /> Clear
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {enabled === false ? (
          <p className="mono border border-hazard p-3 text-[11px] normal-case tracking-normal text-hazard">
            The assistant is not configured on this server yet (missing AI key). Claims and reviews
            still work normally.
          </p>
        ) : null}

        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-80">
              Ask about your claims, ratings or how MoveUp works. Try:
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => submit(suggestion)}
                  disabled={!online || enabled === false}
                  className="mono border border-ink px-3 py-2 text-[10px] normal-case tracking-normal hover:bg-ink hover:text-paper disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] space-y-2 px-4 py-3',
                message.role === 'user' ? 'bg-ink text-paper' : 'border border-ink bg-paper',
              )}
            >
              {message.parts.map((part, index) => {
                if (part.type === 'text') {
                  return (
                    <p key={index} className="whitespace-pre-line text-sm leading-6">
                      {(part as { text: string }).text}
                    </p>
                  );
                }
                if (part.type.startsWith('tool-')) {
                  return (
                    <p key={index} className="mono flex items-center gap-2 text-[10px] text-ink-80">
                      <Wrench className="size-3" /> {TOOL_LABELS[part.type] ?? 'Using a tool'}
                    </p>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {status === 'submitted' ? (
          <p className="mono flex items-center gap-2 text-[10px] text-ink-80">
            <Loader2 className="size-3 animate-spin" /> Thinking…
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mono text-[11px] normal-case tracking-normal text-hazard">
            {error.message.includes('AI_RATE_LIMITED')
              ? 'Hourly limit reached — try again later.'
              : 'The assistant could not answer. Please retry.'}
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="flex gap-2 border-t border-ink p-3">
        <label htmlFor="assistant-input" className="sr-only">
          Message
        </label>
        <Textarea
          id="assistant-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit(input);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder={online ? 'Type your question…' : 'Offline — history is read-only'}
          disabled={!online || enabled === false}
          className="min-h-12 flex-1 resize-none"
        />
        {busy ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => void stop()}
            aria-label="Stop generating"
          >
            <Square />
          </Button>
        ) : (
          <Button type="submit" variant="hazard" disabled={!canSend}>
            Send
          </Button>
        )}
      </form>
    </div>
  );
}

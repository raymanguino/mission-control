import { useEffect, useState, useRef } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { api } from '../utils/api.js';
import type { Channel, Message } from '@mission-control/types';

export default function Chat() {
  const { channelId } = useParams<{ channelId: string }>();
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get<Channel[]>('/api/channels')
      .then(setChannels)
      .catch(() => {
        setChannels([]);
      });
  }, []);

  const selected =
    channelId && channels ? channels.find((c) => c.id === channelId) : undefined;

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const loadMessages = () => {
      const id = selected.id;
      api
        .get<Message[]>(`/api/channels/${id}/messages?limit=50`)
        .then((msgs) => {
          if (cancelled) return;
          const list = Array.isArray(msgs) ? msgs : [];
          setMessages([...list].reverse());
        })
        .catch(() => {});
    };
    loadMessages();
    const id = setInterval(loadMessages, 5_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!channelId) {
    return <Navigate to="/chat" replace />;
  }

  if (channels === null) {
    return <p className="text-gray-500 text-sm">Loading…</p>;
  }

  if (channels.length === 0) {
    return (
      <div className="text-gray-500 text-sm max-w-md">
        <p>No channels yet. Add a channel to start chatting.</p>
      </div>
    );
  }

  if (!selected) {
    return <Navigate to="/chat" replace />;
  }

  async function send() {
    if (!selected || !text.trim()) return;
    await api.post(`/api/channels/${selected.id}/messages`, { content: text.trim() });
    setText('');
    const msgs = await api.get<Message[]>(
      `/api/channels/${selected.id}/messages?limit=50`,
    );
    const list = Array.isArray(msgs) ? msgs : [];
    setMessages([...list].reverse());
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col -m-6 overflow-hidden"
      style={{ height: 'calc(100vh - 0px)' }}
    >
      <div className="flex-1 flex min-h-0 flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
          {messages.map((m) => (
            <div key={m.id}>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs font-semibold text-indigo-400">{m.author}</span>
                <span className="text-xs text-gray-600">
                  {new Date(m.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-gray-200 mt-0.5">
                {m.content.trim() ? (
                  m.content
                ) : m.source === 'discord' ? (
                  <span className="text-gray-500 italic">
                    (no text — if others’ messages look empty, enable Message Content Intent for the bot in the
                    Discord Developer Portal)
                  </span>
                ) : (
                  ''
                )}
              </p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-gray-800 px-4 py-3 flex flex-col gap-2">
          <p className="text-xs text-gray-500">Posting as Mr</p>
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Message…"
              className="flex-1 bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={send}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

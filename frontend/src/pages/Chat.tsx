import { useEffect, useState, useRef } from 'react';
import { api } from '../utils/api.js';
import type { Channel, Message } from '@mission-control/types';

export default function Chat() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  /** Optional Discord snowflake; when set, backend resolves display name for author */
  const [postAsDiscordUserId, setPostAsDiscordUserId] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<Channel[]>('/api/channels').then((c) => {
      setChannels(c);
      if (c.length > 0 && !selected) setSelected(c[0]!);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const loadMessages = () => {
      const channelId = selected.id;
      api
        .get<Message[]>(`/api/channels/${channelId}/messages?limit=50`)
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

  async function send() {
    if (!selected || !text.trim()) return;
    const trimmedId = postAsDiscordUserId.trim();
    const payload =
      /^\d{17,20}$/.test(trimmedId)
        ? { discordUserId: trimmedId, content: text.trim() }
        : { author: 'Dashboard', content: text.trim() };
    await api.post(`/api/channels/${selected.id}/messages`, payload);
    setText('');
    const msgs = await api.get<Message[]>(
      `/api/channels/${selected.id}/messages?limit=50`,
    );
    const list = Array.isArray(msgs) ? msgs : [];
    setMessages([...list].reverse());
  }

  return (
    <div
      className="flex h-full min-h-0 gap-0 -m-6 overflow-hidden"
      style={{ height: 'calc(100vh - 0px)' }}
    >
      {/* Channel list */}
      <aside className="w-48 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-800 text-sm font-medium text-gray-300">
          Channels
        </div>
        <div className="flex-1 overflow-y-auto">
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              title={
                c.source === 'discord' && c.externalId
                  ? `Discord channel id ${c.externalId} — pick the channel that matches where people talk in Discord`
                  : undefined
              }
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                selected?.id === c.id
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="block"># {c.name}</span>
              {c.source === 'discord' && c.externalId ? (
                <span className="block text-[10px] text-gray-600 font-mono mt-0.5 truncate">
                  …{c.externalId.slice(-8)}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </aside>

      {/* Messages */}
      <div className="flex-1 flex min-h-0 flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
          {messages.map((m) => (
            <div key={m.id}>
              <div className="flex items-baseline gap-2 flex-wrap">
                {m.fromMissionControl ? (
                  <span
                    className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-200 border border-amber-700/60"
                    title="Sent from Mission Control (dashboard or API)"
                  >
                    MC
                  </span>
                ) : null}
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
          <input
            value={postAsDiscordUserId}
            onChange={(e) => setPostAsDiscordUserId(e.target.value)}
            placeholder="Post as Discord user ID (optional, 17–20 digits)"
            className="w-full bg-gray-900 rounded-md px-3 py-1.5 text-xs text-gray-400 border border-gray-800 focus:outline-none focus:border-indigo-500 font-mono"
          />
          <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Message…"
            className="flex-1 bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
          />
          <button
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

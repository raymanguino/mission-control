import { useEffect, useState, useRef } from 'react';
import { api } from '../utils/api.js';
import type { Channel, Message } from '@mission-control/types';

export default function Chat() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<Channel[]>('/api/channels').then((c) => {
      setChannels(c);
      if (c.length > 0 && !selected) setSelected(c[0]!);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    const fetch = () =>
      api
        .get<Message[]>(`/api/channels/${selected.id}/messages?limit=50`)
        .then((msgs) => setMessages([...msgs].reverse()))
        .catch(() => {});
    fetch();
    const id = setInterval(fetch, 5_000);
    return () => clearInterval(id);
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    if (!selected || !text.trim()) return;
    await api.post(`/api/channels/${selected.id}/messages`, {
      author: 'Dashboard',
      content: text.trim(),
    });
    setText('');
    const msgs = await api.get<Message[]>(
      `/api/channels/${selected.id}/messages?limit=50`,
    );
    setMessages([...msgs].reverse());
  }

  return (
    <div className="flex h-full gap-0 -m-6 overflow-hidden" style={{ height: 'calc(100vh - 0px)' }}>
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
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                selected?.id === c.id
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              # {c.name}
            </button>
          ))}
        </div>
      </aside>

      {/* Messages */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.map((m) => (
            <div key={m.id}>
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-indigo-400">{m.author}</span>
                <span className="text-xs text-gray-600">
                  {new Date(m.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm text-gray-200 mt-0.5">{m.content}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-gray-800 px-4 py-3 flex gap-2">
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
  );
}

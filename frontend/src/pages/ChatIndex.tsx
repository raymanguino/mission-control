import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';
import type { Channel } from '@mission-control/types';

export default function ChatIndex() {
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[] | null>(null);

  useEffect(() => {
    api
      .get<Channel[]>('/api/channels')
      .then((c) => {
        setChannels(c);
        if (c.length > 0) {
          navigate(`/chat/${c[0]!.id}`, { replace: true });
        }
      })
      .catch(() => {
        setChannels([]);
      });
  }, [navigate]);

  if (channels === null) {
    return <p className="text-gray-500 text-sm">Loading channels…</p>;
  }

  if (channels.length === 0) {
    return (
      <div className="text-gray-500 text-sm max-w-md">
        <p>No channels yet. Add a channel (for example via the API) to start chatting.</p>
      </div>
    );
  }

  return <p className="text-gray-500 text-sm">Redirecting…</p>;
}

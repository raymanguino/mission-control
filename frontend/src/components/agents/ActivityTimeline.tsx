import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../utils/api.js';
import type { AgentActivity, FleetActivityEntry } from '@mission-control/types';

const PAGE_SIZE = 50;
const POLL_MAX = 200;

/** Scrollable list area for agent + fleet activity (shared). */
const ACTIVITY_LIST_MAX_HEIGHT_CLASS =
  'max-h-[min(70vh,28rem)] overflow-y-auto overflow-x-hidden';

/** Shared default for agent + fleet activity feeds: rows start collapsed. */
const ACTIVITY_ROW_DEFAULT_OPEN = false;

export type TimelineEntry = AgentActivity & { agentName?: string };

type EventTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

function eventTone(type: string): EventTone {
  const t = type.toLowerCase();
  if (t.includes('error') || t.includes('fail')) return 'danger';
  if (
    t.includes('complete') ||
    t.includes('success') ||
    /\bdone\b/.test(t) ||
    t === 'ok'
  ) {
    return 'success';
  }
  if (t.includes('warn') || t.includes('idle') || t.includes('waiting')) return 'warning';
  if (
    t.includes('start') ||
    t.includes('task') ||
    t.includes('info') ||
    t.includes('report')
  ) {
    return 'info';
  }
  return 'neutral';
}

const toneChip: Record<EventTone, string> = {
  neutral: 'bg-gray-700/80 text-gray-200 border-gray-600',
  info: 'bg-indigo-950/80 text-indigo-200 border-indigo-800/80',
  success: 'bg-emerald-950/80 text-emerald-200 border-emerald-800/80',
  warning: 'bg-amber-950/80 text-amber-200 border-amber-800/80',
  danger: 'bg-red-950/80 text-red-200 border-red-800/80',
};

const toneDot: Record<EventTone, string> = {
  neutral: 'bg-gray-500 border-gray-950',
  info: 'bg-indigo-400 border-gray-950',
  success: 'bg-emerald-400 border-gray-950',
  warning: 'bg-amber-400 border-gray-950',
  danger: 'bg-red-400 border-gray-950',
};

function formatEventTypeLabel(type: string): string {
  const spaced = type.replace(/_/g, ' ').trim();
  if (!spaced) return type;
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDayHeading(dayKey: string, now: Date): string {
  const todayKey = localDayKey(now);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterdayKey = localDayKey(y);

  if (dayKey === todayKey) return 'Today';
  if (dayKey === yesterdayKey) return 'Yesterday';

  const parts = dayKey.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) return dayKey;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeShort(iso: string): string {
  const diffSec = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, 'second');
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  const diffHr = Math.round(diffSec / 3600);
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, 'hour');
  const diffDay = Math.round(diffSec / 86400);
  if (Math.abs(diffDay) < 7) return rtf.format(diffDay, 'day');
  const diffWeek = Math.round(diffSec / (86400 * 7));
  if (Math.abs(diffWeek) < 5) return rtf.format(diffWeek, 'week');
  const diffMonth = Math.round(diffSec / (86400 * 30));
  if (Math.abs(diffMonth) < 12) return rtf.format(diffMonth, 'month');
  return rtf.format(Math.round(diffSec / (86400 * 365)), 'year');
}

function groupByDay(activities: AgentActivity[]): { dayKey: string; items: AgentActivity[] }[] {
  const map = new Map<string, AgentActivity[]>();
  for (const a of activities) {
    const key = localDayKey(new Date(a.createdAt));
    const list = map.get(key);
    if (list) list.push(a);
    else map.set(key, [a]);
  }
  return Array.from(map.entries()).map(([dayKey, items]) => ({ dayKey, items }));
}

function CollapsibleActivityCard({
  defaultOpen,
  summary,
  children,
}: {
  defaultOpen: boolean;
  summary: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      className="group rounded-lg border border-gray-800 bg-gray-900/80 overflow-hidden"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="list-none cursor-pointer select-none px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        {summary}
      </summary>
      {children}
    </details>
  );
}

function TimelineGroupedList({
  entries,
  showAgent,
}: {
  entries: TimelineEntry[];
  showAgent: boolean;
}) {
  const now = new Date();
  const grouped = groupByDay(entries);

  return (
    <>
      {grouped.map(({ dayKey, items }) => (
        <div key={dayKey} className="mb-8 last:mb-0">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 sticky top-0 bg-gray-900/95 py-1 backdrop-blur-sm z-10 border-b border-gray-800/80">
            {formatDayHeading(dayKey, now)}
          </h3>
          <ul className="relative pl-6 border-l border-gray-700/90 space-y-0">
            {items.map((a) => {
              const tone = eventTone(a.type);
              const entry = a as TimelineEntry;
              const hasBody =
                Boolean(a.description) ||
                Boolean(a.metadata && Object.keys(a.metadata).length > 0);

              return (
                <li key={a.id} className="relative pb-6 last:pb-0">
                  <span
                    className={`absolute -left-[25px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full border-2 ring-2 ring-gray-800 ${toneDot[tone]}`}
                    aria-hidden
                  />
                  <CollapsibleActivityCard
                    defaultOpen={ACTIVITY_ROW_DEFAULT_OPEN}
                    summary={
                      <div className="flex flex-wrap items-center gap-2 gap-y-1">
                        <span
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-gray-500 group-open:rotate-90 transition-transform"
                          aria-hidden
                        >
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-4 w-4"
                            aria-hidden
                          >
                            <path
                              fillRule="evenodd"
                              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                        <span
                          className={`inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-xs font-medium ${toneChip[tone]}`}
                        >
                          {formatEventTypeLabel(a.type)}
                        </span>
                        {showAgent && entry.agentName && (
                          <Link
                            to={`/agents/${a.agentId}`}
                            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 truncate max-w-[12rem]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {entry.agentName}
                          </Link>
                        )}
                        <span className="text-xs text-gray-500 tabular-nums ml-auto sm:ml-0">
                          {new Date(a.createdAt).toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-600 tabular-nums">
                          {formatRelativeShort(a.createdAt)}
                        </span>
                      </div>
                    }
                  >
                    <div className="border-t border-gray-800/80 px-3 pb-2.5 pt-0">
                      {a.description && (
                        <p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap">{a.description}</p>
                      )}
                      {a.metadata && Object.keys(a.metadata).length > 0 && (
                        <pre className="text-xs text-gray-500 mt-2 overflow-x-auto font-mono bg-gray-950/60 rounded-md p-2 border border-gray-800/80">
                          {JSON.stringify(a.metadata, null, 2)}
                        </pre>
                      )}
                      {!hasBody && (
                        <p className="text-xs text-gray-600 mt-2 italic">No additional details.</p>
                      )}
                    </div>
                  </CollapsibleActivityCard>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

function TimelineChrome({
  title,
  subtitle,
  loading,
  loadError,
  empty,
  hasMore,
  loadingMore,
  onLoadMore,
  children,
}: {
  title: string;
  subtitle: string;
  loading: boolean;
  loadError: boolean;
  empty: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">{title}</h2>
        <p className="text-xs text-gray-600">{subtitle}</p>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading activity…</p>}
      {!loading && loadError && empty && (
        <p className="text-sm text-amber-500/90">Could not load activity.</p>
      )}
      {!loading && !loadError && empty && <p className="text-sm text-gray-500">No activity yet.</p>}

      {children ? (
        <div className={ACTIVITY_LIST_MAX_HEIGHT_CLASS}>{children}</div>
      ) : null}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void onLoadMore()}
            className="text-sm px-4 py-2 rounded-lg border border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800 hover:border-gray-600 disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load older events'}
          </button>
        </div>
      )}
    </div>
  );
}

export function ActivityTimeline({ agentId }: { agentId: string }) {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const activitiesRef = useRef<AgentActivity[]>([]);
  activitiesRef.current = activities;

  const refresh = useCallback(() => {
    const n = activitiesRef.current.length;
    const limit = Math.min(POLL_MAX, Math.max(PAGE_SIZE, n || PAGE_SIZE));
    return api
      .get<{ data: AgentActivity[] }>(`/api/agents/${agentId}/activity?limit=${limit}&offset=0`)
      .then((r) => {
        setActivities(r.data);
        setHasMore(r.data.length === limit);
        setLoadError(false);
      })
      .catch(() => {
        setLoadError(true);
      });
  }, [agentId]);

  useEffect(() => {
    setActivities([]);
    setLoading(true);
    setLoadError(false);
    let cancelled = false;

    void api
      .get<{ data: AgentActivity[] }>(
        `/api/agents/${agentId}/activity?limit=${PAGE_SIZE}&offset=0`,
      )
      .then((r) => {
        if (cancelled) return;
        setActivities(r.data);
        setHasMore(r.data.length === PAGE_SIZE);
        setLoadError(false);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const id = setInterval(() => {
      void refresh();
    }, 10_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [agentId, refresh]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const offset = activities.length;
      const r = await api.get<{ data: AgentActivity[] }>(
        `/api/agents/${agentId}/activity?limit=${PAGE_SIZE}&offset=${offset}`,
      );
      setActivities((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        const merged = [...prev];
        for (const row of r.data) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            merged.push(row);
          }
        }
        return merged;
      });
      setHasMore(r.data.length === PAGE_SIZE);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  const entries: TimelineEntry[] = activities;

  return (
    <TimelineChrome
      title="Activity"
      subtitle="Newest first · updates every 10s"
      loading={loading}
      loadError={loadError}
      empty={!loading && activities.length === 0}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={loadMore}
    >
      {!loading && (activities.length > 0 || !loadError) && (
        <TimelineGroupedList entries={entries} showAgent={false} />
      )}
    </TimelineChrome>
  );
}

export function FleetActivityTimeline() {
  const [activities, setActivities] = useState<FleetActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const activitiesRef = useRef<FleetActivityEntry[]>([]);
  activitiesRef.current = activities;

  const refresh = useCallback(() => {
    const n = activitiesRef.current.length;
    const limit = Math.min(POLL_MAX, Math.max(PAGE_SIZE, n || PAGE_SIZE));
    return api
      .get<{ data: FleetActivityEntry[] }>(`/api/agents/fleet-activity?limit=${limit}&offset=0`)
      .then((r) => {
        setActivities(r.data);
        setHasMore(r.data.length === limit);
        setLoadError(false);
      })
      .catch(() => {
        setLoadError(true);
      });
  }, []);

  useEffect(() => {
    setActivities([]);
    setLoading(true);
    setLoadError(false);
    let cancelled = false;

    void api
      .get<{ data: FleetActivityEntry[] }>(`/api/agents/fleet-activity?limit=${PAGE_SIZE}&offset=0`)
      .then((r) => {
        if (cancelled) return;
        setActivities(r.data);
        setHasMore(r.data.length === PAGE_SIZE);
        setLoadError(false);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const id = setInterval(() => {
      void refresh();
    }, 10_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refresh]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const offset = activities.length;
      const r = await api.get<{ data: FleetActivityEntry[] }>(
        `/api/agents/fleet-activity?limit=${PAGE_SIZE}&offset=${offset}`,
      );
      setActivities((prev) => {
        const seen = new Set(prev.map((a) => a.id));
        const merged = [...prev];
        for (const row of r.data) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            merged.push(row);
          }
        }
        return merged;
      });
      setHasMore(r.data.length === PAGE_SIZE);
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  const entries: TimelineEntry[] = activities;

  return (
    <TimelineChrome
      title="Fleet activity"
      subtitle="All agents · newest first · updates every 10s"
      loading={loading}
      loadError={loadError}
      empty={!loading && activities.length === 0}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={loadMore}
    >
      {!loading && (activities.length > 0 || !loadError) && (
        <TimelineGroupedList entries={entries} showAgent />
      )}
    </TimelineChrome>
  );
}

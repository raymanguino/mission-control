import { useEffect, useState } from 'react';
import { api } from '../utils/api.js';

interface ReqInfo {
  method: string;
  url: string;
  host: string;
  remoteAddress: string;
  remotePort: number;
}

interface ResInfo {
  statusCode: number;
}

interface LogLine {
  time: string;
  level: number;
  levelLabel: string;
  msg: string;
  raw: string;
  pid?: number;
  hostname?: string;
  reqId?: string;
  req?: ReqInfo;
  res?: ResInfo;
  responseTime?: number;
  guildId?: string;
  err?: string;
}

interface LogsResponse {
  lines: LogLine[];
  total: number;
  hasMore: boolean;
}

type LevelFilter = 'all' | 'info' | 'warn' | 'error' | 'debug';

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const levelColors: Record<string, string> = {
  info: 'bg-blue-900 text-blue-300',
  warn: 'bg-yellow-900 text-yellow-300',
  error: 'bg-red-900 text-red-300',
  debug: 'bg-gray-700 text-gray-400',
  fatal: 'bg-red-950 text-red-200',
  trace: 'bg-gray-800 text-gray-500',
  unknown: 'bg-gray-800 text-gray-500',
};

const statusColor = (code?: number) => {
  if (!code) return 'text-gray-400';
  if (code >= 500) return 'text-red-400';
  if (code >= 400) return 'text-orange-400';
  if (code >= 300) return 'text-yellow-400';
  if (code >= 200) return 'text-green-400';
  return 'text-gray-400';
};

export default function Logs() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(yesterday);
  const [toDate, setToDate] = useState(today);
  const [level, setLevel] = useState<LevelFilter>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [offset, setOffset] = useState(0);

  const limit = 500;

  const buildParams = () => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (offset > 0) params.set('offset', String(offset));
    if (fromDate) {
      params.set('from', new Date(fromDate).toISOString());
    }
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      params.set('to', end.toISOString());
    }
    if (level && level !== 'all') {
      params.set('level', level);
    }
    return params;
  };

  const load = () => {
    setLoading(true);
    api
      .get<LogsResponse>(`/api/logs?${buildParams()}`)
      .then((res) => {
        setLines(res.lines);
        setTotal(res.total);
      })
      .catch(() => {
        setLines([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fromDate, toDate, level, offset]);

  const handlePrevPage = () => {
    setOffset((o) => Math.max(0, o - limit));
  };

  const handleNextPage = () => {
    if (lines.length === limit) {
      setOffset((o) => o + limit);
    }
  };

  const formatTime = (time: string) => {
    const d = new Date(time);
    return d.toLocaleTimeString();
  };

  const formatMs = (ms?: number) => {
    if (ms === undefined) return '—';
    return `${ms.toFixed(1)}ms`;
  };

  const isRequestLog = (line: LogLine) => {
    return line.msg === 'incoming request' || line.msg === 'request completed';
  };

  const getRequestSummary = (line: LogLine) => {
    if (line.msg === 'incoming request' && line.req) {
      return `${line.req.method} ${line.req.url}`;
    }
    if (line.msg === 'request completed' && line.res) {
      return `${line.res.statusCode}`;
    }
    return line.msg;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Logs</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setOffset(0);
              }}
              className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-indigo-500"
            />
            <label className="text-xs text-gray-500">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setOffset(0);
              }}
              className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="w-px h-5 bg-gray-700" />

          <select
            value={level}
            onChange={(e) => {
              setLevel(e.target.value as LevelFilter);
              setOffset(0);
            }}
            className="bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All levels</option>
            <option value="debug">Debug+</option>
            <option value="info">Info+</option>
            <option value="warn">Warn+</option>
            <option value="error">Error+</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-700 bg-gray-900 text-indigo-600 focus:ring-indigo-500"
            />
            Auto-refresh
          </label>

          <button
            onClick={load}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-md"
          >
            Refresh
          </button>

          <a
            href={`/api/logs/download?${buildParams()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-md"
          >
            Download
          </a>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Showing {lines.length} of {total.toLocaleString()} lines
          {offset > 0 && ` (starting at ${offset})`}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevPage}
            disabled={offset === 0}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 rounded"
          >
            Prev
          </button>
          <button
            onClick={handleNextPage}
            disabled={lines.length < limit}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 rounded"
          >
            Next
          </button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="sticky top-0 bg-gray-900 border-b border-gray-800">
              <tr className="text-xs text-gray-500 text-left">
                <th className="px-3 py-2 font-medium w-20">Time</th>
                <th className="px-3 py-2 font-medium w-16">Level</th>
                <th className="px-3 py-2 font-medium w-16">Req ID</th>
                <th className="px-3 py-2 font-medium w-28">Method</th>
                <th className="px-3 py-2 font-medium w-48">URL / Status</th>
                <th className="px-3 py-2 font-medium w-20">Time</th>
                <th className="px-3 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : lines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                    No log entries found
                  </td>
                </tr>
              ) : (
                lines.map((line, idx) => (
                  <tr
                    key={`${line.time}-${line.reqId || idx}`}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30"
                  >
                    <td className="px-3 py-1.5 text-gray-400 font-mono text-xs whitespace-nowrap">
                      {formatTime(line.time)}
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          levelColors[line.levelLabel] || levelColors.unknown
                        }`}
                      >
                        {line.levelLabel}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-gray-500 font-mono text-xs">
                      {line.reqId || '—'}
                    </td>
                    <td className="px-3 py-1.5 text-gray-300 font-mono text-xs">
                      {line.req?.method || '—'}
                    </td>
                    <td className="px-3 py-1.5 text-gray-300 font-mono text-xs">
                      {isRequestLog(line) ? (
                        <span className={statusColor(line.res?.statusCode)}>
                          {getRequestSummary(line)}
                        </span>
                      ) : (
                        line.msg
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-gray-500 font-mono text-xs">
                      {formatMs(line.responseTime)}
                    </td>
                    <td className="px-3 py-1.5 text-gray-400 font-mono text-xs">
                      {line.req?.remoteAddress && `${line.req.remoteAddress}:${line.req.remotePort}`}
                      {line.hostname && !line.req && line.msg}
                      {line.err && <span className="text-red-400">{line.err}</span>}
                      {!line.req?.remoteAddress && !line.hostname && !line.err && line.msg}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
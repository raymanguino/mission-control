import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { FoodLog, MarijuanaSession, SleepLog } from '@mission-control/types';
import { api } from '../utils/api.js';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export interface WellnessContextValue {
  foodLogs: FoodLog[];
  marijuanaSessions: MarijuanaSession[];
  sleepLogs: SleepLog[];
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  loadWellness: () => void;
  upsertSleepLog: (saved: SleepLog) => void;
}

const WellnessContext = createContext<WellnessContextValue | null>(null);

export function WellnessProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [marijuanaSessions, setMarijuanaSessions] = useState<MarijuanaSession[]>([]);
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);

  const loadWellness = useCallback(() => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const fromStr = from.toISOString().slice(0, 10);
    api.get<FoodLog[]>(`/api/health/food?from=${fromStr}`).then(setFoodLogs).catch(() => {});
    api
      .get<MarijuanaSession[]>(`/api/health/marijuana?from=${fromStr}`)
      .then(setMarijuanaSessions)
      .catch(() => {});
    api.get<SleepLog[]>(`/api/health/sleep?from=${fromStr}`).then(setSleepLogs).catch(() => {});
  }, []);

  const upsertSleepLog = useCallback((saved: SleepLog) => {
    setSleepLogs((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id);
      if (idx === -1) return [saved, ...prev];
      const next = [...prev];
      next[idx] = saved;
      return next;
    });
  }, []);

  useEffect(() => {
    loadWellness();
  }, [loadWellness]);

  const value = useMemo(
    () => ({
      foodLogs,
      marijuanaSessions,
      sleepLogs,
      selectedDate,
      setSelectedDate,
      loadWellness,
      upsertSleepLog,
    }),
    [
      foodLogs,
      marijuanaSessions,
      sleepLogs,
      selectedDate,
      loadWellness,
      upsertSleepLog,
    ],
  );

  return <WellnessContext.Provider value={value}>{children}</WellnessContext.Provider>;
}

export function useWellness(): WellnessContextValue {
  const ctx = useContext(WellnessContext);
  if (!ctx) {
    throw new Error('useWellness must be used within WellnessProvider');
  }
  return ctx;
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const BASE = import.meta.env['VITE_API_URL'] ?? '';

export const DEFAULT_DASHBOARD_TITLE = 'Mission Control';

interface DashboardTitleContextValue {
  dashboardTitle: string;
  refreshDashboardTitle: () => Promise<void>;
}

const DashboardTitleContext = createContext<DashboardTitleContextValue | null>(null);

export function DashboardTitleProvider({ children }: { children: ReactNode }) {
  const [dashboardTitle, setDashboardTitle] = useState(DEFAULT_DASHBOARD_TITLE);

  const refreshDashboardTitle = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/settings/display`);
      if (!res.ok) return;
      const data = (await res.json()) as { dashboardTitle?: unknown };
      if (typeof data.dashboardTitle === 'string' && data.dashboardTitle.trim()) {
        setDashboardTitle(data.dashboardTitle.trim());
      } else {
        setDashboardTitle(DEFAULT_DASHBOARD_TITLE);
      }
    } catch {
      // Keep current title on network failure.
    }
  }, []);

  useEffect(() => {
    void refreshDashboardTitle();
  }, [refreshDashboardTitle]);

  useEffect(() => {
    document.title = dashboardTitle;
  }, [dashboardTitle]);

  const value = useMemo(
    () => ({ dashboardTitle, refreshDashboardTitle }),
    [dashboardTitle, refreshDashboardTitle],
  );

  return (
    <DashboardTitleContext.Provider value={value}>{children}</DashboardTitleContext.Provider>
  );
}

export function useDashboardTitle(): DashboardTitleContextValue {
  const ctx = useContext(DashboardTitleContext);
  if (!ctx) {
    throw new Error('useDashboardTitle must be used within DashboardTitleProvider');
  }
  return ctx;
}

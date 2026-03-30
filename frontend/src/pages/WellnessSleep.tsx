import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useWellness } from '../contexts/WellnessContext.js';
import { WellnessDateBar } from '../components/wellness/WellnessDateBar.js';
import { SleepSection } from './Health.js';

export default function WellnessSleep() {
  const { selectedDate, sleepLogs, loadWellness, upsertSleepLog } = useWellness();
  const [searchParams, setSearchParams] = useSearchParams();
  const openAddFromUrl = searchParams.get('add') === '1';

  const consumeOpenAddFromUrl = useCallback(() => {
    setSearchParams(
      (prev) => {
        if (!prev.get('add')) return prev;
        const next = new URLSearchParams(prev);
        next.delete('add');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  return (
    <div className="max-w-2xl space-y-4">
      <WellnessDateBar />
      <SleepSection
        date={selectedDate}
        sleepLogs={sleepLogs}
        onUpsert={upsertSleepLog}
        onRefresh={loadWellness}
        openAddFromUrl={openAddFromUrl}
        onConsumeOpenAddFromUrl={consumeOpenAddFromUrl}
      />
    </div>
  );
}

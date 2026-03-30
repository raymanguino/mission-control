import { useWellness } from '../../contexts/WellnessContext.js';
import { todayStr } from '../../pages/Health.js';

export function WellnessDateBar() {
  const { selectedDate, setSelectedDate } = useWellness();

  return (
    <div className="flex items-center gap-3">
      <label className="text-sm text-gray-400">Date</label>
      <input
        type="date"
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
        className="bg-gray-800 rounded-md px-3 py-1.5 text-sm text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
      />
      <button
        type="button"
        onClick={() => setSelectedDate(todayStr())}
        className="text-xs text-gray-500 hover:text-gray-300"
      >
        Today
      </button>
    </div>
  );
}

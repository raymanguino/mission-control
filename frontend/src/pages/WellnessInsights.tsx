import { useWellness } from '../contexts/WellnessContext.js';
import { AnalysisTab } from './Health.js';

export default function WellnessInsights() {
  const { sleepLogs, foodLogs, marijuanaSessions } = useWellness();

  return (
    <AnalysisTab
      sleepLogs={sleepLogs}
      foodLogs={foodLogs}
      marijuanaSessions={marijuanaSessions}
    />
  );
}

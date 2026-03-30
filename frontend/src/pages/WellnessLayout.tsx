import { Outlet } from 'react-router-dom';
import { WellnessProvider } from '../contexts/WellnessContext.js';

export default function WellnessLayout() {
  return (
    <WellnessProvider>
      <div>
        <h1 className="text-2xl font-semibold mb-4">Wellness</h1>
        <Outlet />
      </div>
    </WellnessProvider>
  );
}

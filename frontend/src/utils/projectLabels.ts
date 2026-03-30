import type { ProjectStatus } from '@mission-control/types';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  denied: 'Denied',
};

export const PROJECT_STATUS_BADGE_CLASS: Record<ProjectStatus, string> = {
  pending_approval: 'text-yellow-400 bg-yellow-950/40',
  approved: 'text-green-400 bg-green-950/40',
  denied: 'text-red-400 bg-red-950/40',
};

import { type PlanStatus } from '../plan.status.ts';

const ALLOWED: Readonly<Record<PlanStatus, readonly PlanStatus[]>> = {
  pending: ['approved', 'rejected', 'expired', 'stale', 'applied'],
  approved: ['applied', 'pending'],
  applied: ['reverted', 'partial'],
  partial: ['reverted'],
  rejected: [],
  expired: [],
  stale: [],
  reverted: [],
};

export function canTransition(from: PlanStatus, to: PlanStatus): boolean {
  return ALLOWED[from].includes(to);
}

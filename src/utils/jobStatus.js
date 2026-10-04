// Who can set which job status. The server enforces the same rule.
export const ALL_JOB_STATUSES = ['pending', 'in_progress', 'ready_for_pickup', 'awaiting_delivery', 'completed', 'cancelled']
const OWNER_ONLY = ['completed', 'cancelled']

// Staff move jobs through the working steps; only the owner closes (or reopens) a job.
export function statusOptionsFor(isOwner, currentStatus) {
  if (isOwner) return ALL_JOB_STATUSES
  if (OWNER_ONLY.includes(currentStatus)) return [currentStatus]
  return ALL_JOB_STATUSES.filter((status) => !OWNER_ONLY.includes(status))
}

export function staffCanChangeStatus(isOwner, currentStatus) {
  return isOwner || !OWNER_ONLY.includes(currentStatus)
}

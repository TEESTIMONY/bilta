import { DJANGO_API_BASE, fetchAllPages, fetchJson } from './api'

export function getStaffProfiles() {
  return fetchAllPages(`${DJANGO_API_BASE}/staff-profiles/`)
}

export function updateStaffProfile(id, fields) {
  return fetchJson(`${DJANGO_API_BASE}/staff-profiles/${id}/`, { method: 'PATCH', body: JSON.stringify(fields) })
}

export function getStaffDailyRecords(start, end) {
  const query = new URLSearchParams({ start, end })
  return fetchAllPages(`${DJANGO_API_BASE}/staff-daily-records/?${query}`)
}

export function saveStaffDailyRecord(id, fields) {
  return fetchJson(`${DJANGO_API_BASE}/staff-daily-records/${id ? `${id}/` : ''}`, {
    method: id ? 'PATCH' : 'POST', body: JSON.stringify(fields),
  })
}

export function getMyAttendance() {
  return fetchJson(`${DJANGO_API_BASE}/staff-daily-records/attendance/`)
}

export function recordMyAttendance(action) {
  return fetchJson(`${DJANGO_API_BASE}/staff-daily-records/${action}/`, { method: 'POST', body: '{}' })
}

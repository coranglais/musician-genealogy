const BASE = '/api/v1';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function searchMusicians(q, page = 1, perPage = 20) {
  return request(`/search?q=${encodeURIComponent(q)}&page=${page}&per_page=${perPage}`);
}

export function autocomplete(q, limit = 8) {
  return request(`/search/autocomplete?q=${encodeURIComponent(q)}&limit=${limit}`);
}

export function getMusician(id) {
  return request(`/musicians/${id}`);
}

export function getMusicianTeachers(id) {
  return request(`/musicians/${id}/teachers`);
}

export function getMusicianStudents(id) {
  return request(`/musicians/${id}/students`);
}

export function getMusicianLineage(id, depth = 3, includeSecondary = false) {
  return request(`/musicians/${id}/lineage?depth=${depth}&include_secondary=${includeSecondary}`);
}

export function listMusicians(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/musicians${qs ? '?' + qs : ''}`);
}

export function getInstitution(id) {
  return request(`/institutions/${id}`);
}

export function listInstitutions(q) {
  return request(`/institutions${q ? '?q=' + encodeURIComponent(q) : ''}`);
}

export function listInstruments() {
  return request('/instruments');
}

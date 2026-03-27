const BASE = '/api/v1';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function searchMusicians(q, page = 1, perPage = 20, instrument = null) {
  let url = `/search?q=${encodeURIComponent(q)}&page=${page}&per_page=${perPage}`;
  if (instrument) url += `&instrument=${instrument}`;
  return request(url);
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

export function getInstrument(id) {
  return request(`/instruments`).then(instruments => instruments.find(i => i.id === id));
}

export function getMusiciansForInstrument(id, includeCompanions = true, page = 1, perPage = 50) {
  return request(`/instruments/${id}/musicians?include_companions=${includeCompanions}&page=${page}&per_page=${perPage}`);
}

// --- Config ---

export function getPublicConfig() {
  return request('/config/public');
}

// --- Auth ---

export function login(password) {
  return request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

export function logout() {
  return request('/auth/logout', { method: 'POST' });
}

// --- Admin Submissions ---

export function listSubmissions(status, page = 1, perPage = 20) {
  const params = new URLSearchParams({ page, per_page: perPage });
  if (status) params.set('status', status);
  return request(`/admin/submissions?${params}`);
}

export function getSubmission(id) {
  return request(`/admin/submissions/${id}`);
}

export function approveSubmission(id) {
  return request(`/admin/submissions/${id}/approve`, { method: 'PUT' });
}

export function rejectSubmission(id, editorNotes) {
  return request(`/admin/submissions/${id}/reject`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ editor_notes: editorNotes }),
  });
}

export function approveSingleRecord(submissionId, recordId) {
  return request(`/admin/submissions/${submissionId}/records/${recordId}/approve`, { method: 'PUT' });
}

export function rejectSingleRecord(submissionId, recordId) {
  return request(`/admin/submissions/${submissionId}/records/${recordId}/reject`, { method: 'PUT' });
}

export function listPendingMusicians() {
  return request('/admin/pending/musicians');
}

export function listPendingLineage() {
  return request('/admin/pending/lineage');
}

export function editPendingMusician(id, data) {
  return request(`/admin/pending/musicians/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function editPendingLineage(id, data) {
  return request(`/admin/pending/lineage/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// --- Public Submissions ---

export function submitContribution(data) {
  return request('/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function parseSubmissionText(text, submitterName) {
  const res = await fetch(`${BASE}/submissions/parse-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, submitter_name: submitterName }),
  });
  if (res.status === 429) {
    throw new Error('RATE_LIMIT');
  }
  if (res.status === 422) {
    throw new Error('PARSE_FAILED');
  }
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export function checkSubmissionStatus(token) {
  return request(`/submissions/status/${token}`);
}

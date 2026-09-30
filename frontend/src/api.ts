// API client — เรียก backend ผ่าน /api (vite proxy ไป :4000 ใน dev)

const BASE = '/api';

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ---------- Types ----------
export interface Criterion {
  id: string;
  name: string;
  weightPercent: number;
  displayOrder: number;
}
export interface Competitor {
  id: string;
  name: string;
  bibNumber?: string | null;
  displayOrder: number;
}
export interface Judge {
  id: string;
  label: string;
  accessToken?: string;
}
export interface Competition {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  createdAt?: string;
  criteria?: Criterion[];
  competitors?: Competitor[];
  judges?: Judge[];
  _count?: { competitors: number; judges: number; criteria: number };
}

export interface JudgeBreakdown {
  judgeId: string;
  judgeLabel: string;
  perCriterion: Record<string, number>;
  weightedTotal: number | null;
  complete: boolean;
}
export interface CompetitorResult {
  competitorId: string;
  competitorName: string;
  judges: JudgeBreakdown[];
  finalScore: number | null;
  rank: number | null;
}
export interface ResultsResponse {
  competition: { id: string; name: string; status: string };
  criteria: Criterion[];
  judges: { id: string; label: string }[];
  results: CompetitorResult[];
}

// ---------- Admin ----------
export const adminApi = {
  listCompetitions: () => req<Competition[]>('/admin/competitions'),
  getCompetition: (id: string) => req<Competition>(`/admin/competitions/${id}`),
  createCompetition: (data: { name: string; description?: string }) =>
    req<Competition>('/admin/competitions', { method: 'POST', body: JSON.stringify(data) }),
  updateCompetition: (id: string, data: Record<string, unknown>) =>
    req<Competition>(`/admin/competitions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addCriterion: (id: string, data: { name: string; weightPercent: number; displayOrder?: number }) =>
    req<Criterion>(`/admin/competitions/${id}/criteria`, { method: 'POST', body: JSON.stringify(data) }),
  updateCriterion: (id: string, data: { name?: string; weightPercent?: number; displayOrder?: number }) =>
    req<Criterion>(`/admin/criteria/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCriterion: (id: string) => req<void>(`/admin/criteria/${id}`, { method: 'DELETE' }),
  addCompetitor: (id: string, data: { name: string; bibNumber?: string; displayOrder?: number }) =>
    req<Competitor>(`/admin/competitions/${id}/competitors`, { method: 'POST', body: JSON.stringify(data) }),
  updateCompetitor: (id: string, data: { name?: string; bibNumber?: string | null; displayOrder?: number }) =>
    req<Competitor>(`/admin/competitors/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCompetitor: (id: string) => req<void>(`/admin/competitors/${id}`, { method: 'DELETE' }),
  addJudge: (id: string, data: { label: string }) =>
    req<Judge>(`/admin/competitions/${id}/judges`, { method: 'POST', body: JSON.stringify(data) }),
  updateJudge: (id: string, data: { label: string }) =>
    req<Judge>(`/admin/judges/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteJudge: (id: string) => req<void>(`/admin/judges/${id}`, { method: 'DELETE' }),
  getJudgeLink: (id: string) => req<{ url: string; token: string }>(`/admin/judges/${id}/link`),
  getResults: (id: string) => req<ResultsResponse>(`/admin/competitions/${id}/results`),
  getVersion: () => req<{ version: string }>(`/version`),
  deleteCompetition: (id: string) => req<void>(`/admin/competitions/${id}`, { method: 'DELETE' }),
  exportUrl: (id: string) => `${BASE}/admin/competitions/${id}/export`,
  importCompetition: async (file: File) => {
    const res = await fetch(`${BASE}/admin/competitions/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
    return body as { id: string; name: string; scoreCount: number };
  },
};

// ---------- Judge ----------
export interface JudgeSession {
  judge: { id: string; label: string };
  competition: { id: string; name: string; description?: string | null; status: string };
  criteria: Criterion[];
  competitors: Competitor[];
}
export const judgeApi = {
  session: (token: string) => req<JudgeSession>(`/judge/session?token=${encodeURIComponent(token)}`),
  getScores: (token: string) =>
    req<{ scores: { competitorId: string; criterionId: string; value: number }[] }>(
      `/judge/scores?token=${encodeURIComponent(token)}`
    ),
  saveScore: (token: string, data: { competitorId: string; criterionId: string; value: number }) =>
    req<{ competitorId: string; criterionId: string; value: number }>(
      `/judge/scores?token=${encodeURIComponent(token)}`,
      { method: 'PUT', body: JSON.stringify(data) }
    ),
};

/** Tipli API istemcisi. Sunucu tek otoritedir; istemci hiçbir sayı yazmaz. */
import type { Army, GearLineKey, Resources, StatKey } from '@lordlar/shared';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'lordlar_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* gizli sekmede localStorage kapalı olabilir; oturum yine de çalışır */
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(body?.error ?? 'Bilinmeyen bir hata oluştu.', res.status, body?.code);
  }
  return body as T;
}

const post = <T>(path: string, body?: unknown): Promise<T> =>
  request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

export interface LordState {
  id: string;
  name: string;
  level: number;
  xp: number;
  xpForNext: number;
  stats: Record<StatKey, number>;
  statPoints: number;
  resources: Resources;
  storageCapacity: number;
  hourlyIncome: Resources;
  upkeepPerHour: number;
  netErzakPerHour: number;
  starving: boolean;
  fame: number;
  elo: number;
  pvpWins: number;
  pvpLosses: number;
  homeArmy: Army;
  commandCapacity: number;
  usedSlots: number;
  maxRegions: number;
  regionCount: number;
  ownsThrone: boolean;
  generalSlots: number;
  equipmentPower: number;
  lordContribution: number;
  gearLines: Record<GearLineKey, number>;
  gearBonus: { saldiri: number; savunma: number; can: number };
  woundedUntil: string | null;
  protectionUntil: string | null;
  dailyAttacks: number;
}

export interface QueueItem {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  startedAt: string;
  finishAt: string;
}

export interface GameEvent {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface MeResponse {
  lord: LordState;
  queues: QueueItem[];
  events: GameEvent[];
  serverTime: string;
}

export const api = {
  register: (email: string, password: string, lordName: string) =>
    post<{ token: string }>('/auth/register', { email, password, lordName }),
  login: (email: string, password: string) =>
    post<{ token: string }>('/auth/login', { email, password }),
  me: () => request<MeResponse>('/me'),
  spendStats: (points: Partial<Record<StatKey, number>>) => post<LordState>('/me/stats', points),
};

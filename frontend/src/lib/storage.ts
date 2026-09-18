const NICKNAME_KEY = 'sketchsabotage:nickname';
const SESSION_KEY = 'sketchsabotage:session';

export function loadStoredNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveStoredNickname(value: string) {
  try {
    localStorage.setItem(NICKNAME_KEY, value);
  } catch {}
}

export interface StoredSession {
  code: string;
  playerId: string;
}

export function loadStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.code === 'string' && typeof parsed?.playerId === 'string') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveStoredSession(session: StoredSession) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {}
}

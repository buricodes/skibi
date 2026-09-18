// Thin wrapper around the native browser WebSocket — there's no Socket.io
// server on the Go side, so there's no socket.io-client here either (see
// PRD.md §10). One envelope shape in both directions: { type, payload }.

type Listener<T = unknown> = (payload: T) => void;

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

const RECONNECT_DELAY_MS = 1500;

class GameSocket {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private status: ConnectionStatus = 'closed';
  private shouldReconnect = false;

  connect() {
    if (this.ws) return;
    this.shouldReconnect = true;
    this.open();
  }

  private open() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${wsProtocol}://${window.location.host}/ws`;

    this.setStatus('connecting');
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.addEventListener('open', () => this.setStatus('open'));
    ws.addEventListener('close', () => {
      this.setStatus('closed');
      this.ws = null;
      if (this.shouldReconnect) setTimeout(() => this.open(), RECONNECT_DELAY_MS);
    });
    ws.addEventListener('error', () => {
      // 'close' fires right after in browsers; nothing extra to do here.
    });
    ws.addEventListener('message', (ev) => {
      const raw = typeof ev.data === 'string' ? ev.data : null;
      if (raw === null) return; // this app never sends binary frames
      let msg: { type: string; payload: unknown };
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      this.listeners.get(msg.type)?.forEach((fn) => fn(msg.payload));
    });
  }

  send(type: string, payload: unknown) {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn(`dropped "${type}" — socket not open`);
      return;
    }
    this.ws.send(JSON.stringify({ type, payload }));
  }

  on<T = unknown>(type: string, fn: Listener<T>): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    const set = this.listeners.get(type)!;
    set.add(fn as Listener);
    return () => set.delete(fn as Listener);
  }

  onStatusChange(fn: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => this.statusListeners.delete(fn);
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status;
    this.statusListeners.forEach((fn) => fn(status));
  }
}

// One connection for the whole app — a game session is one tab, one socket.
export const socket = new GameSocket();

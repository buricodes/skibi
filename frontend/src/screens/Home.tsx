import { useEffect, useState } from 'react';
import { Doodle } from '@/components/Doodle';
import { useGame } from '@/state/GameContext';

function Stat({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-4">
      {icon}
      <div>
        <div className="text-lg font-extrabold">{title}</div>
        <div className="text-sm text-muted-2">{subtitle}</div>
      </div>
    </div>
  );
}

function StepCard({
  n,
  color,
  title,
  seconds,
  desc,
}: {
  n: number;
  color: string;
  title: string;
  seconds?: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl bg-panel-alt p-5">
      <div className="flex items-center gap-3">
        <span
          className="flex h-8.5 w-8.5 items-center justify-center rounded-[10px] text-[17px] font-extrabold"
          style={{ background: color, boxShadow: `0 0 16px ${color}80` }}
        >
          {n}
        </span>
        <div className="text-lg font-extrabold">{title}</div>
        {seconds && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-panel-3 px-3.5 py-1.5 text-sm font-extrabold text-[#c9d0f0]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8892c4" strokeWidth="2.4">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l4 2" strokeLinecap="round" />
            </svg>
            {seconds}
          </span>
        )}
      </div>
      <p className="mt-3.5 text-sm leading-relaxed text-muted-2">{desc}</p>
    </div>
  );
}

export function Home() {
  const { status, createRoom, joinRoom, lastError, clearError } = useGame();
  const [nickname, setNickname] = useState('');
  const [mode, setMode] = useState<'none' | 'join'>('none');
  const [code, setCode] = useState('');

  // A Lobby invite link is `<origin>?code=XXXXX` — jump straight to the
  // Join form with the code prefilled instead of making someone type a
  // 5-character code by hand.
  useEffect(() => {
    const url = new URL(window.location.href);
    const invited = url.searchParams.get('code');
    if (invited) {
      setCode(invited.toUpperCase());
      setMode('join');
      url.searchParams.delete('code');
      window.history.replaceState({}, '', url);
    }
  }, []);

  const canPlay = status === 'open' && nickname.trim().length > 0;

  function handleCreate() {
    if (!canPlay) return;
    clearError();
    createRoom(nickname.trim());
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!canPlay || code.trim().length === 0) return;
    clearError();
    joinRoom(code.trim().toUpperCase(), nickname.trim());
  }

  return (
    <div className="relative z-1 mx-auto max-w-[1240px] px-6 py-6">
      <div className="relative overflow-hidden rounded-[22px] bg-[#0a0f2e] px-9 pb-10 pt-9">
        <div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(300px,1fr)_minmax(0,470px)]">
          <div className="min-w-0">
            <div className="relative">
              <svg
                className="absolute -left-[62px] -top-1.5"
                width="70"
                height="120"
                viewBox="0 0 70 120"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 96l22-64 16 6-22 64-18 8z" fill="#2a1f6b" stroke="#8b5cf6" strokeWidth="3" />
                <path d="M16 96l18-8" stroke="#8b5cf6" strokeWidth="3" />
              </svg>
              <svg className="absolute -top-[34px] left-3.5" width="62" height="40" viewBox="0 0 62 40" fill="#f8d84b">
                <path d="M4 34L8 8l12 12L31 2l11 18 12-12 4 26z" />
              </svg>
              <div className="font-display text-[clamp(40px,6.2vw,74px)] font-extrabold leading-[1.05] tracking-tight [filter:drop-shadow(0_0_26px_rgba(139,92,246,0.55))]">
                Tom
                <span className="bg-gradient-to-r from-[#c084fc] via-[#8b5cf6] to-[#a78bfa] bg-clip-text text-transparent">
                  Sheint
                </span>
              </div>
              <div className="mt-2 whitespace-nowrap font-display text-[clamp(20px,2.6vw,30px)] font-semibold">
                Draw. Guess. <span className="text-blue">Have Fun!</span>
              </div>
              <svg width="100%" height="14" viewBox="0 0 300 14" fill="none" preserveAspectRatio="none" className="mt-0.5 block max-w-[340px]">
                <path d="M6 9c60-5 140-6 288-4" stroke="#8b5cf6" strokeWidth="4" strokeLinecap="round" />
              </svg>
            </div>

            <div className="mt-6 flex max-w-[400px] flex-col gap-3.5">
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Your nickname"
                maxLength={20}
                className="w-full rounded-full bg-panel-2 px-5 py-3 text-center font-bold text-white outline-none focus:ring-2 focus:ring-accent"
              />

              {mode === 'none' && (
                <>
                  <button
                    onClick={handleCreate}
                    disabled={!canPlay}
                    className="flex items-center justify-center gap-3.5 rounded-full bg-gradient-to-r from-[#9b6bff] to-[#6d3bf5] px-6 py-4 text-[21px] font-extrabold shadow-[0_0_34px_rgba(139,92,246,0.5),inset_0_2px_0_rgba(255,255,255,0.25),inset_0_-3px_0_rgba(0,0,0,0.18)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/22">
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="#fff">
                        <path d="M4 2.2c3.2 1.7 6.2 3.7 9.2 5.8-3 2-6 3.9-9.2 5.6 0-3.9.2-7.5 0-11.4z" />
                      </svg>
                    </span>
                    Create Room
                  </button>
                  <button
                    onClick={() => setMode('join')}
                    disabled={!canPlay}
                    className="flex items-center justify-center gap-3 rounded-full border-2 border-violet bg-panel px-6 py-3.5 text-lg font-extrabold shadow-[0_0_22px_rgba(123,77,255,0.22)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#a78bfa">
                      <circle cx="9" cy="8" r="3.4" />
                      <circle cx="17" cy="9" r="2.6" />
                      <path d="M2 19c0-3.6 3-6 7-6s7 2.4 7 6z" />
                      <path d="M17 13c3 0 5 2 5 5h-5z" />
                    </svg>
                    Join Room
                  </button>
                </>
              )}

              {mode === 'join' && (
                <form onSubmit={handleJoin} className="flex flex-col gap-3.5">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Room code"
                    maxLength={5}
                    className="w-full rounded-full bg-panel-2 px-5 py-3 text-center font-bold uppercase tracking-widest text-white outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    type="submit"
                    disabled={!canPlay || code.trim().length === 0}
                    className="rounded-full bg-gradient-to-r from-[#9b6bff] to-[#6d3bf5] py-3.5 text-lg font-extrabold shadow-[0_0_34px_rgba(139,92,246,0.5)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Join
                  </button>
                  <button type="button" onClick={() => setMode('none')} className="text-sm text-muted hover:text-white/80">
                    Back
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="relative min-w-0 px-4 pb-2 pt-5">
            <div className="absolute inset-x-8 bottom-6 top-0 -rotate-6 rounded-[20px] bg-[#3d2aa8]" />
            <div className="absolute inset-x-5 bottom-4 top-2 rotate-[2.5deg] rounded-[20px] bg-[#5b3ff0]" />
            <div className="relative -rotate-2 rounded-[18px] bg-white p-3.5 shadow-[0_22px_46px_rgba(0,0,0,0.45)]">
              <div style={{ width: '100%', height: 240 }}>
                <Doodle />
              </div>
            </div>
            <div className="absolute bottom-5 right-1.5 rounded-2xl bg-violet px-4.5 py-3 font-display text-xl font-bold shadow-[0_0_26px_rgba(123,77,255,0.55)]">
              Let's play!
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl bg-panel-alt px-7 py-5 sm:grid-cols-3">
        <Stat
          icon={
            <span className="flex h-[50px] w-[50px] flex-none items-center justify-center rounded-full bg-gradient-to-br from-accent to-[#6d3bf5] shadow-[0_0_20px_rgba(139,92,246,0.45)]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff">
                <circle cx="9" cy="8" r="3.4" />
                <circle cx="17" cy="9" r="2.6" />
                <path d="M2 19c0-3.6 3-6 7-6s7 2.4 7 6z" />
                <path d="M17 13c3 0 5 2 5 5h-5z" />
              </svg>
            </span>
          }
          title="2 - 10 Players"
          subtitle="Join with friends"
        />
        <Stat
          icon={
            <span className="flex h-[50px] w-[50px] flex-none items-center justify-center rounded-full bg-gradient-to-br from-[#a855f7] to-[#6d28d9] shadow-[0_0_20px_rgba(168,85,247,0.45)]">
              <svg width="22" height="26" viewBox="0 0 24 24" fill="#fff">
                <path d="M13 2L4 14h6l-1 8 9-12h-6z" />
              </svg>
            </span>
          }
          title="Real-time"
          subtitle="No waiting, just fun"
        />
        <Stat
          icon={
            <span className="flex h-[50px] w-[50px] flex-none items-center justify-center rounded-full bg-gradient-to-br from-green to-[#15803d] shadow-[0_0_20px_rgba(34,197,94,0.4)]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M9 10h.01M15 10h.01" />
                <path d="M8.5 14.5c2 2.2 5 2.2 7 0" />
              </svg>
            </span>
          }
          title="Live Drawing"
          subtitle="Watch it happen stroke by stroke"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StepCard
          n={1}
          color="#8b5cf6"
          title="Choose"
          seconds="10s"
          desc="The current drawer privately picks one of 3 words. Everyone else waits and gets ready to guess."
        />
        <StepCard
          n={2}
          color="#3b82f6"
          title="Draw"
          seconds="80s"
          desc="The drawer's canvas updates live for everyone, stroke by stroke. Guess the word in chat as it takes shape."
        />
        <StepCard
          n={3}
          color="#22c55e"
          title="Score"
          desc="Guess fast for the most points — the drawer scores too, for every correct guess. Turns rotate through everyone."
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 rounded-2xl bg-panel-alt px-7 py-5 sm:grid-cols-4">
        <Stat
          icon={
            <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full bg-violet">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff">
                <path d="M6 8h12a4 4 0 014 4v2a3 3 0 01-5.6 1.5L15 14H9l-1.4 1.5A3 3 0 012 14v-2a4 4 0 014-4z" />
              </svg>
            </span>
          }
          title="3"
          subtitle="Rounds per game"
        />
        <Stat
          icon={
            <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full bg-[#16a34a]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="13" r="7" />
                <circle cx="11" cy="13" r="2.6" />
                <path d="M16 8l5-5M18 3h3v3" />
              </svg>
            </span>
          }
          title="3 / 2 / 1"
          subtitle="Points by guess speed"
        />
        <Stat
          icon={
            <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full bg-[#2563eb]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="14" r="8" />
                <path d="M12 10v4l3 2M9 3h6M12 3v3" />
              </svg>
            </span>
          }
          title="~10 min"
          subtitle="Total game length"
        />
        <Stat
          icon={
            <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full bg-[#db2777]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff">
                <path d="M12 21C6 17 2 13.5 2 9.5A4.5 4.5 0 0112 7a4.5 4.5 0 0110 2.5C22 13.5 18 17 12 21z" />
              </svg>
            </span>
          }
          title="No app"
          subtitle="Share the room code and play"
        />
      </div>

      {status !== 'open' && (
        <p className="mt-4 text-center text-sm text-muted">
          {status === 'connecting' ? 'Connecting to server…' : 'Disconnected — retrying…'}
        </p>
      )}
      {lastError && <p className="mt-2 text-center text-sm text-rose-400">{lastError.message}</p>}
    </div>
  );
}

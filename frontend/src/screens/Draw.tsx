import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@/components/Canvas';
import type { CanvasHandle } from '@/components/Canvas';
import { Chat } from '@/components/Chat';
import { Face } from '@/components/Face';
import { GameHeader } from '@/components/GameHeader';
import { HelpToggle } from '@/components/HelpToggle';
import { PlayerList } from '@/components/PlayerList';
import { Toolbar, TOOL_SIZES } from '@/components/Toolbar';
import type { DrawTool } from '@/components/Toolbar';
import { playerColor } from '@/lib/playerColor';
import { socket } from '@/lib/socket';
import { TYPE_CANVAS_CLEAR, TYPE_STROKE_END, TYPE_STROKE_POINT, TYPE_STROKE_START } from '@/lib/types';
import type { StrokePoint, StrokeStart } from '@/lib/types';
import { useGame } from '@/state/GameContext';

// Handles both the Choosing and Drawing phases in one screen — the word
// picker/waiting message appears right where the canvas will be, in the
// same layout, instead of a separate full-screen interstitial.
export function Draw() {
  const {
    room,
    self,
    isDrawer,
    wordChoices,
    yourWord,
    chooseWord,
    sendChat,
    sendStrokeStart,
    sendStrokePoint,
    sendStrokeEnd,
    sendCanvasClear,
  } = useGame();
  const canvasRef = useRef<CanvasHandle>(null);
  const [tool, setTool] = useState<DrawTool>('pen');
  const [color, setColor] = useState('#e8453c');

  const isChoosing = room?.phase === 'choosing';
  const isTurnEnd = room?.phase === 'turnEnd';
  const isCentered = isChoosing || isTurnEnd;

  // Guessers only: replay whatever the current drawer broadcasts. The
  // drawer doesn't subscribe to these — they ARE the source, their own
  // Canvas already rendered their strokes locally as they drew them.
  useEffect(() => {
    if (isDrawer) return;
    const offs = [
      socket.on<StrokeStart>(TYPE_STROKE_START, (s) => canvasRef.current?.applyRemoteStrokeStart(s)),
      socket.on<StrokePoint>(TYPE_STROKE_POINT, (p) => canvasRef.current?.applyRemoteStrokePoint(p)),
      socket.on(TYPE_STROKE_END, () => canvasRef.current?.applyRemoteStrokeEnd()),
      socket.on(TYPE_CANVAS_CLEAR, () => canvasRef.current?.applyRemoteClear()),
    ];
    return () => offs.forEach((off) => off());
  }, [isDrawer]);

  if (!room) return null;

  const drawer = room.players.find((p) => p.id === room.drawerId);
  const effectiveColor = tool === 'eraser' ? '#ffffff' : color;
  const effectiveSize = TOOL_SIZES[tool];
  const revealDisplay = room.revealedWord
    ? room.revealedWord.split('').join(' ')
    : Array.from({ length: room.wordLength ?? 0 })
        .map(() => '_')
        .join(' ');

  return (
    <div className="relative z-1 mx-auto max-w-[1240px] px-6 py-6">
      <div className="flex justify-end pb-2">
        <HelpToggle />
      </div>
      <GameHeader phaseLabel={isChoosing ? 'Choosing' : isTurnEnd ? 'Turn Over' : 'Drawing'} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[200px_minmax(0,1fr)_minmax(0,340px)]">
        <div className="flex flex-col gap-4">
          <PlayerList
            players={room.players}
            hostId={room.hostId}
            selfId={self?.playerId ?? null}
            drawerId={isTurnEnd ? room.lastDrawerId : room.drawerId}
            scores={room.scores}
          />
          {!isCentered && isDrawer && (
            <Toolbar
              tool={tool}
              onToolChange={setTool}
              color={color}
              onColorChange={setColor}
              onUndo={() => canvasRef.current?.undo()}
              onClear={() => canvasRef.current?.clear()}
            />
          )}
        </div>

        <div
          className="rounded-2xl shadow-[0_0_0_1.5px_var(--color-ring),0_14px_40px_rgba(0,0,0,0.4)]"
          style={{
            background: isCentered ? 'var(--color-panel)' : '#fff',
            padding: isCentered ? 0 : 10,
            minHeight: 380,
            display: 'flex',
            alignItems: isCentered ? 'center' : undefined,
            justifyContent: isCentered ? 'center' : undefined,
          }}
        >
          {isChoosing ? (
            isDrawer && wordChoices ? (
              <div className="flex flex-col items-center gap-5 px-8 py-12 text-center">
                <h2 className="font-display text-2xl font-extrabold text-white">Pick a word to draw</h2>
                <div className="flex flex-wrap justify-center gap-3">
                  {wordChoices.map((w) => (
                    <button
                      key={w}
                      onClick={() => chooseWord(w)}
                      className="rounded-2xl bg-panel-2 px-6 py-3.5 text-lg font-extrabold transition hover:bg-[#3a2f8f]"
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 px-8 py-12 text-center">
                <h2 className="font-display text-2xl font-extrabold text-white">
                  {drawer?.nickname ?? 'Someone'} is choosing a word…
                </h2>
                <p className="text-muted-2">Get ready to guess!</p>
              </div>
            )
          ) : isTurnEnd ? (
            <div className="flex w-full flex-col items-center gap-5 px-8 py-10 text-center">
              <p className="text-sm font-bold text-muted-2">The word was</p>
              <h2 className="font-display text-4xl font-extrabold text-green">{room.lastWord}</h2>
              <p className="text-sm font-bold text-muted-2">
                {room.lastDrawerId === self?.playerId
                  ? 'You were drawing'
                  : `${room.players.find((p) => p.id === room.lastDrawerId)?.nickname ?? 'Someone'} was drawing`}
              </p>
              <div className="flex w-full max-w-[440px] flex-col gap-2">
                {room.players.map((p, i) => {
                  const gain = room.turnGains?.find((g) => g.playerId === p.id)?.score ?? 0;
                  const total = room.scores.find((s) => s.playerId === p.id)?.score ?? 0;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl px-3.5 py-2.5"
                      style={{ background: p.id === room.lastDrawerId ? '#131c56' : '#0e1540' }}
                    >
                      <Face color={playerColor(i)} size={28} />
                      <span className="text-sm font-extrabold">{p.nickname}</span>
                      <span className="ml-auto text-sm font-extrabold" style={{ color: gain ? '#4ade80' : '#5c6699' }}>
                        {gain ? `+${gain}` : '—'}
                      </span>
                      <span className="w-14 text-right text-xs font-bold text-muted">{total} pts</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs font-bold text-muted">Next turn starting…</p>
            </div>
          ) : (
            <Canvas
              ref={canvasRef}
              interactive={isDrawer}
              color={effectiveColor}
              size={effectiveSize}
              onStrokeStart={sendStrokeStart}
              onStrokePoint={sendStrokePoint}
              onStrokeEnd={sendStrokeEnd}
              onClear={sendCanvasClear}
            />
          )}
        </div>

        <div className="flex h-[500px] flex-col gap-3 lg:h-[640px]">
          {!isCentered && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-panel-2 px-4 py-3 shadow-[0_0_0_1.5px_#3a2f7a]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.4" strokeLinecap="round" className="flex-none">
                <path d="M17 3l4 4-11 11-5 1 1-5z" />
              </svg>
              {isDrawer ? (
                <span className="text-sm font-bold text-[#c9d0f0]">
                  Your word: <span className="font-extrabold text-white">{yourWord}</span>
                </span>
              ) : (
                <span className="font-mono text-sm font-bold tracking-widest text-white">{revealDisplay}</span>
              )}
            </div>
          )}
          <div className="min-h-0 flex-1">
            <Chat
              messages={room.chat}
              players={room.players}
              selfId={self?.playerId ?? null}
              onSend={sendChat}
              placeholder={!isCentered && !isDrawer ? 'Type your guess…' : 'Chat…'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

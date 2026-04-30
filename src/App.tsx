import { useEffect, useRef, useState } from 'react';

type Player = { id: string; name: string; score: number };
type State = {
  type: 'state';
  room: string;
  buzzedBy: string | null;
  players: Player[];
};

export default function App() {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [joined, setJoined] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'joined') {
        setJoined(true);
        setIsHost(!!msg.isHost);
        setPlayerId(msg.playerId);
        setRoomCode(msg.room);
      } else if (msg.type === 'state') {
        setState(msg);
      } else if (msg.type === 'error') {
        setError(msg.message);
      }
    };
    return () => ws.close();
  }, []);

  const send = (data: object) => wsRef.current?.send(JSON.stringify(data));

  if (!joined) {
    return (
      <div className="container">
        <h1>QuizBuzzer</h1>
        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="row">
          <button disabled={!name} onClick={() => send({ type: 'create', name })}>
            Create Room
          </button>
        </div>
        <div className="row">
          <input
            placeholder="Room code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          />
          <button
            disabled={!name || !roomCode}
            onClick={() => send({ type: 'join', name, room: roomCode })}
          >
            Join Room
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    );
  }

  const buzzedPlayer = state?.players.find((p) => p.id === state.buzzedBy);
  const iAmBuzzed = state?.buzzedBy === playerId;

  return (
    <div className="container">
      <header>
        <h1>Room {roomCode}</h1>
        <span>{isHost ? 'Host' : 'Player'}</span>
      </header>

      <button
        className={`buzzer ${iAmBuzzed ? 'buzzed' : ''}`}
        disabled={!!state?.buzzedBy}
        onClick={() => send({ type: 'buzz' })}
      >
        {state?.buzzedBy
          ? buzzedPlayer
            ? `${buzzedPlayer.name} buzzed!`
            : 'Locked'
          : 'BUZZ'}
      </button>

      {isHost && (
        <button className="reset" onClick={() => send({ type: 'reset' })}>
          Reset Buzzer
        </button>
      )}

      <h2>Scores</h2>
      <ul className="players">
        {state?.players.map((p) => (
          <li key={p.id}>
            <span>
              {p.name} {p.id === playerId && '(you)'}
            </span>
            <span>{p.score}</span>
            {isHost && (
              <span className="controls">
                <button onClick={() => send({ type: 'score', playerId: p.id, delta: 1 })}>
                  +1
                </button>
                <button onClick={() => send({ type: 'score', playerId: p.id, delta: -1 })}>
                  -1
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

import { WebSocketServer, WebSocket } from 'ws';

type Player = {
  id: string;
  name: string;
  score: number;
  ws: WebSocket;
};

type Room = {
  code: string;
  hostId: string | null;
  players: Map<string, Player>;
  buzzedBy: string | null;
};

const rooms = new Map<string, Room>();

const wss = new WebSocketServer({ port: 8080, path: '/ws' });
console.log('[server] WebSocket server listening on ws://localhost:8080/ws');

function broadcast(room: Room, payload: unknown) {
  const data = JSON.stringify(payload);
  for (const p of room.players.values()) {
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(data);
  }
}

function roomState(room: Room) {
  return {
    type: 'state',
    room: room.code,
    buzzedBy: room.buzzedBy,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
    })),
  };
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

wss.on('connection', (ws) => {
  let playerId: string | null = null;
  let currentRoom: Room | null = null;

  ws.on('message', (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case 'create': {
        const code = makeRoomCode();
        playerId = makeId();
        const room: Room = {
          code,
          hostId: playerId,
          players: new Map(),
          buzzedBy: null,
        };
        room.players.set(playerId, {
          id: playerId,
          name: msg.name || 'Host',
          score: 0,
          ws,
        });
        rooms.set(code, room);
        currentRoom = room;
        ws.send(JSON.stringify({ type: 'joined', room: code, playerId, isHost: true }));
        broadcast(room, roomState(room));
        break;
      }
      case 'join': {
        const room = rooms.get((msg.room || '').toUpperCase());
        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
          return;
        }
        playerId = makeId();
        room.players.set(playerId, {
          id: playerId,
          name: msg.name || 'Player',
          score: 0,
          ws,
        });
        currentRoom = room;
        ws.send(JSON.stringify({ type: 'joined', room: room.code, playerId, isHost: false }));
        broadcast(room, roomState(room));
        break;
      }
      case 'buzz': {
        if (!currentRoom || !playerId) return;
        if (currentRoom.buzzedBy === null) {
          currentRoom.buzzedBy = playerId;
          broadcast(currentRoom, roomState(currentRoom));
        }
        break;
      }
      case 'reset': {
        if (!currentRoom || playerId !== currentRoom.hostId) return;
        currentRoom.buzzedBy = null;
        broadcast(currentRoom, roomState(currentRoom));
        break;
      }
      case 'score': {
        if (!currentRoom || playerId !== currentRoom.hostId) return;
        const target = currentRoom.players.get(msg.playerId);
        if (target) {
          target.score += Number(msg.delta) || 0;
          broadcast(currentRoom, roomState(currentRoom));
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    if (currentRoom && playerId) {
      currentRoom.players.delete(playerId);
      if (currentRoom.buzzedBy === playerId) currentRoom.buzzedBy = null;
      if (currentRoom.players.size === 0) {
        rooms.delete(currentRoom.code);
      } else {
        broadcast(currentRoom, roomState(currentRoom));
      }
    }
  });
});

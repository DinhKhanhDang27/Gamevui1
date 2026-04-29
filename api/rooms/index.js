import { kv } from '@vercel/kv';

const ROOM_TTL_SECONDS = 60 * 60 * 6;

const roomKey = (roomId) => `room:${roomId}`;
const actionsKey = (roomId) => `room:${roomId}:actions`;
const actionSeqKey = (roomId) => `room:${roomId}:actionSeq`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { roomId, hostId, status, playersMeta, game } = req.body || {};
  if (!roomId || !hostId || !Array.isArray(playersMeta) || !game) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  const now = new Date().toISOString();
  const room = {
    roomId,
    hostId,
    status: status || 'waiting',
    playersMeta,
    game,
    createdAt: now,
    updatedAt: now
  };

  const setResult = await kv.set(roomKey(roomId), room, {
    nx: true,
    ex: ROOM_TTL_SECONDS
  });

  if (setResult !== 'OK') {
    res.status(409).json({ error: 'Room exists' });
    return;
  }

  await kv.expire(actionsKey(roomId), ROOM_TTL_SECONDS);
  await kv.expire(actionSeqKey(roomId), ROOM_TTL_SECONDS);

  res.status(201).json(room);
}

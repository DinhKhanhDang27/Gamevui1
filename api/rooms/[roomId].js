import { kv } from '@vercel/kv';

const ROOM_TTL_SECONDS = 60 * 60 * 6;

const roomKey = (roomId) => `room:${roomId}`;

export default async function handler(req, res) {
  const { roomId } = req.query || {};
  if (!roomId) {
    res.status(400).json({ error: 'Missing roomId' });
    return;
  }

  if (req.method === 'GET') {
    const room = await kv.get(roomKey(roomId));
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }
    res.status(200).json(room);
    return;
  }

  if (req.method === 'PUT') {
    const room = await kv.get(roomKey(roomId));
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const { playersMeta, game, status } = req.body || {};
    const nextRoom = {
      ...room,
      updatedAt: new Date().toISOString()
    };

    if (Array.isArray(playersMeta)) nextRoom.playersMeta = playersMeta;
    if (game) nextRoom.game = game;
    if (status) nextRoom.status = status;

    await kv.set(roomKey(roomId), nextRoom, { ex: ROOM_TTL_SECONDS });
    res.status(200).json(nextRoom);
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}

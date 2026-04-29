import { getRedis } from '../../lib/redis.js';

const ROOM_TTL_SECONDS = 60 * 60 * 6;

const roomKey = (roomId) => `room:${roomId}`;
const actionsKey = (roomId) => `room:${roomId}:actions`;
const actionSeqKey = (roomId) => `room:${roomId}:actionSeq`;

const parseSince = (raw, total) => {
  if (raw === 'latest') return total;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.min(parsed, total);
};

export default async function handler(req, res) {
  const { roomId } = req.query || {};
  if (!roomId) {
    res.status(400).json({ error: 'Missing roomId' });
    return;
  }

  if (req.method === 'GET') {
    const redis = await getRedis();
    const total = await redis.lLen(actionsKey(roomId));
    const startIndex = parseSince(req.query?.since ?? '0', total);

    if (startIndex >= total) {
      res.status(200).json({ actions: [], nextIndex: total });
      return;
    }

    const rawActions = await redis.lRange(actionsKey(roomId), startIndex, total - 1);
    const actions = rawActions
      .map(action => {
        if (typeof action === 'string') {
          try {
            return JSON.parse(action);
          } catch (err) {
            return null;
          }
        }
        return action;
      })
      .filter(Boolean);

    res.status(200).json({ actions, nextIndex: total });
    return;
  }

  if (req.method === 'POST') {
    const redis = await getRedis();
    const roomRaw = await redis.get(roomKey(roomId));
    if (!roomRaw) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const { type, playerId, clientId } = req.body || {};
    if (!type || typeof playerId !== 'number' || !clientId) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const seq = await redis.incr(actionSeqKey(roomId));
    const action = {
      id: String(seq),
      type,
      playerId,
      clientId,
      createdAt: new Date().toISOString()
    };

    await redis.rPush(actionsKey(roomId), JSON.stringify(action));
    await redis.expire(actionsKey(roomId), ROOM_TTL_SECONDS);
    await redis.expire(actionSeqKey(roomId), ROOM_TTL_SECONDS);
    await redis.expire(roomKey(roomId), ROOM_TTL_SECONDS);

    res.status(201).json(action);
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}

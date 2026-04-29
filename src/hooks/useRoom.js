import { useCallback, useEffect, useMemo, useState } from 'react';
import { getInitialGameState, INITIAL_PLAYERS } from '../data/initialGameState';

const CLIENT_ID_KEY = 'monopoly_client_id';

const getClientId = () => {
  if (typeof window === 'undefined') return 'server-client';
  const stored = window.localStorage.getItem(CLIENT_ID_KEY);
  if (stored) return stored;
  const id = window.crypto?.randomUUID?.() || `client_${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(CLIENT_ID_KEY, id);
  return id;
};

const generateRoomId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i += 1) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
};

const ROOM_POLL_MS = 900;
const ACTION_POLL_MS = 700;
const MAX_CREATE_ATTEMPTS = 5;

const apiFetch = async (url, options = {}) => {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Phan hoi khong hop le.');
  }

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error || 'Request failed';
    throw new Error(message);
  }

  return data;
};

export function useRoom() {
  const clientId = useMemo(() => getClientId(), []);
  const [roomId, setRoomId] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [role, setRole] = useState(null);
  const [playerId, setPlayerId] = useState(null);

  useEffect(() => {
    if (!roomId) return undefined;
    let isActive = true;

    const pollRoom = async () => {
      try {
        const data = await apiFetch(`/api/rooms/${roomId}`);
        if (!isActive) return;
        setRoomData(data);
        setGameState(data.game || null);
        if (!role && data.hostId === clientId) {
          setRole('host');
          setPlayerId(0);
        }
      } catch (err) {
        if (!isActive) return;
        setError('Không thể tải dữ liệu phòng.');
      }
    };

    pollRoom();
    const timer = setInterval(pollRoom, ROOM_POLL_MS);
    return () => {
      isActive = false;
      clearInterval(timer);
    };
  }, [roomId, clientId, role]);

  const createRoom = useCallback(async (playerName) => {
    setStatus('creating');
    setError('');
    const cleanedName = playerName?.trim();

    for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
      const newId = generateRoomId();
      const game = getInitialGameState();
      if (cleanedName) {
        game.players = game.players.map(player => (
          player.id === 0 ? { ...player, name: cleanedName } : player
        ));
      }
      const playersMeta = INITIAL_PLAYERS.map(player => ({
        id: player.id,
        name: player.name,
        type: player.type,
        clientId: null,
        connected: player.type === 'bot'
      }));

      playersMeta[0] = {
        ...playersMeta[0],
        name: cleanedName || playersMeta[0].name,
        clientId,
        connected: true
      };

      try {
        const data = await apiFetch('/api/rooms', {
          method: 'POST',
          body: JSON.stringify({
            roomId: newId,
            hostId: clientId,
            status: 'waiting',
            playersMeta,
            game
          })
        });

        setRole('host');
        setPlayerId(0);
        setRoomId(newId);
        setRoomData(data);
        setGameState(data.game || null);
        setStatus('connected');
        return true;
      } catch (err) {
        if (err.message === 'Room exists') {
          continue;
        }
        setError('Không thể tạo phòng.');
        setStatus('idle');
        return false;
      }
    }

    setError('Không thể tạo phòng.');
    setStatus('idle');
    return false;
  }, [clientId]);

  const joinRoom = useCallback(async (roomCode, playerName) => {
    setStatus('joining');
    setError('');

    const cleaned = roomCode.trim().toUpperCase();
    const cleanedName = playerName?.trim();
    if (!cleaned) {
      setError('Vui lòng nhập mã phòng.');
      setStatus('idle');
      return false;
    }
    let data;
    try {
      data = await apiFetch(`/api/rooms/${cleaned}`);
    } catch (err) {
      if (err.message === 'Room not found') {
        setError('Phòng không tồn tại.');
      } else {
        setError('Không thể tải dữ liệu phòng.');
      }
      setStatus('idle');
      return false;
    }

    const game = data.game ? { ...data.game } : getInitialGameState();
    const playersMeta = Array.isArray(data.playersMeta) ? data.playersMeta : [];
    if (playersMeta.length < 2) {
      setError('Dữ liệu phòng bị lỗi.');
      setStatus('idle');
      return false;
    }

    if (playersMeta[1]?.clientId && playersMeta[1].clientId !== clientId) {
      setError('Phòng đã đủ 2 người chơi.');
      setStatus('idle');
      return false;
    }

    const updatedPlayers = playersMeta.map(player => ({ ...player }));
    updatedPlayers[1] = {
      ...updatedPlayers[1],
      name: cleanedName || updatedPlayers[1].name,
      clientId,
      connected: true
    };

    game.players = (game.players || []).map(player => (
      player.id === 1 ? { ...player, name: cleanedName || player.name } : player
    ));

    try {
      const updated = await apiFetch(`/api/rooms/${cleaned}`, {
        method: 'PUT',
        body: JSON.stringify({
          playersMeta: updatedPlayers,
          game,
          status: 'active'
        })
      });

      setRole('guest');
      setPlayerId(1);
      setRoomId(cleaned);
      setRoomData(updated);
      setGameState(updated.game || null);
      setStatus('connected');
      return true;
    } catch (err) {
      setError('Không thể cập nhật phòng.');
      setStatus('idle');
      return false;
    }
  }, [clientId]);

  const updateGameState = useCallback(async (game) => {
    if (!roomId) return;
    try {
      await apiFetch(`/api/rooms/${roomId}`, {
        method: 'PUT',
        body: JSON.stringify({ game })
      });
    } catch (err) {
      setError('Không thể đồng bộ dữ liệu game.');
    }
  }, [roomId]);

  const sendAction = useCallback(async (type, actionPlayerId) => {
    if (!roomId) return;
    try {
      await apiFetch(`/api/rooms/${roomId}/actions`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          playerId: actionPlayerId,
          clientId
        })
      });
    } catch (err) {
      setError('Không thể gửi hành động.');
    }
  }, [roomId, clientId]);

  const subscribeToActions = useCallback((onAction) => {
    if (!roomId) return () => {};
    let isActive = true;
    let cursor = 'latest';

    const pollActions = async () => {
      if (!isActive) return;
      try {
        const data = await apiFetch(`/api/rooms/${roomId}/actions?since=${cursor}`);
        if (!isActive) return;
        cursor = data.nextIndex;
        data.actions.forEach(action => {
          if (!action) return;
          onAction(action.id, action);
        });
      } catch (err) {
        if (!isActive) return;
      }
    };

    pollActions();
    const timer = setInterval(pollActions, ACTION_POLL_MS);
    return () => {
      isActive = false;
      clearInterval(timer);
    };
  }, [roomId]);

  const removeAction = useCallback(() => {}, []);

  return {
    clientId,
    roomId,
    roomData,
    gameState,
    status,
    error,
    role,
    playerId,
    isHost: role === 'host',
    createRoom,
    joinRoom,
    updateGameState,
    sendAction,
    subscribeToActions,
    removeAction
  };
}

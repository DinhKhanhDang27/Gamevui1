import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
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

export function useRoom() {
  const clientId = useMemo(() => getClientId(), []);
  const [roomId, setRoomId] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [role, setRole] = useState(null);
  const [playerId, setPlayerId] = useState(null);

  const roomRef = useMemo(() => (roomId ? doc(db, 'rooms', roomId) : null), [roomId]);

  useEffect(() => {
    if (!roomRef) return undefined;
    const unsubscribe = onSnapshot(roomRef, snapshot => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      setRoomData(data);
      setGameState(data.game || null);
      if (!role && data.hostId === clientId) {
        setRole('host');
        setPlayerId(0);
      }
    });
    return unsubscribe;
  }, [roomRef, clientId, role]);

  const createRoom = useCallback(async (playerName) => {
    setStatus('creating');
    setError('');

    const newId = generateRoomId();
    const nextRoomRef = doc(db, 'rooms', newId);
    const game = getInitialGameState();
    const cleanedName = playerName?.trim();
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

    await setDoc(nextRoomRef, {
      roomId: newId,
      hostId: clientId,
      status: 'waiting',
      playersMeta,
      game,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    setRole('host');
    setPlayerId(0);
    setRoomId(newId);
    setStatus('connected');
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
    const nextRoomRef = doc(db, 'rooms', cleaned);
    const snapshot = await getDoc(nextRoomRef);
    if (!snapshot.exists()) {
      setError('Phòng không tồn tại.');
      setStatus('idle');
      return false;
    }

    const data = snapshot.data();
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

    await updateDoc(nextRoomRef, {
      playersMeta: updatedPlayers,
      game,
      status: 'active',
      updatedAt: serverTimestamp()
    });

    setRole('guest');
    setPlayerId(1);
    setRoomId(cleaned);
    setStatus('connected');
    return true;
  }, [clientId]);

  const updateGameState = useCallback(async (game) => {
    if (!roomRef) return;
    await updateDoc(roomRef, {
      game,
      updatedAt: serverTimestamp()
    });
  }, [roomRef]);

  const sendAction = useCallback(async (type, actionPlayerId) => {
    if (!roomRef) return;
    const actionsRef = collection(roomRef, 'actions');
    await addDoc(actionsRef, {
      type,
      playerId: actionPlayerId,
      clientId,
      createdAt: serverTimestamp()
    });
  }, [roomRef, clientId]);

  const subscribeToActions = useCallback((onAction) => {
    if (!roomRef) return () => {};
    const actionsRef = collection(roomRef, 'actions');
    const actionsQuery = query(actionsRef, orderBy('createdAt', 'asc'));
    return onSnapshot(actionsQuery, snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          onAction(change.doc.id, change.doc.data());
        }
      });
    });
  }, [roomRef]);

  const removeAction = useCallback(async (actionId) => {
    if (!roomRef) return;
    await deleteDoc(doc(roomRef, 'actions', actionId));
  }, [roomRef]);

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

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BOARD_SPACES } from '../data/board';
import { getInitialGameState } from '../data/initialGameState';

export function useGame(options = {}) {
  const {
    readOnly = false,
    externalState = null,
    onActionRequest,
    onStateChange,
    disableBots = false
  } = options;

  const initialStateRef = useRef(getInitialGameState());
  const initialState = initialStateRef.current;

  const [players, setPlayers] = useState(initialState.players);
  const [turn, setTurn] = useState(initialState.turn); // Player index
  const [phase, setPhase] = useState(initialState.phase); // 'ROLL' | 'ROLLING' | 'READY_TO_MOVE' | 'MOVING' | 'ACTION'
  const [properties, setProperties] = useState(initialState.properties); // { spaceId: { ownerId: 0, level: 0 } }
  const [logs, setLogs] = useState(initialState.logs);
  const [latestLog, setLatestLog] = useState(initialState.latestLog);
  const [dice, setDice] = useState(initialState.dice);
  const [actionUsed, setActionUsed] = useState(initialState.actionUsed);
  const [actionResolved, setActionResolved] = useState(initialState.actionResolved);
  const [pendingSteps, setPendingSteps] = useState(initialState.pendingSteps);
  const [movingPlayerId, setMovingPlayerId] = useState(initialState.movingPlayerId);
  const rollTimerRef = useRef(null);
  const moveTimerRef = useRef(null);

  const addLog = useCallback((msg) => {
    setLatestLog(msg);
    setLogs(prev => [msg, ...prev].slice(0, 50));
  }, []);

  const safeExternalState = useMemo(() => externalState ?? getInitialGameState(), [externalState]);
  const liveState = useMemo(() => ({
    players,
    turn,
    phase,
    properties,
    logs,
    latestLog,
    dice,
    actionUsed,
    actionResolved,
    pendingSteps,
    movingPlayerId
  }), [
    players,
    turn,
    phase,
    properties,
    logs,
    latestLog,
    dice,
    actionUsed,
    actionResolved,
    pendingSteps,
    movingPlayerId
  ]);
  const gameState = readOnly ? safeExternalState : liveState;

  const currentPlayer = gameState.players[gameState.turn];
  const currentSpace = BOARD_SPACES[currentPlayer.position];
  const currentProperty = gameState.properties[currentSpace.id];

  const getRentForSpace = useCallback((space, level = 0) => {
    if (!space || !space.rent) return 0;
    if (space.type === 'property') {
      const multipliers = [1, 5, 15, 45, 80];
      const idx = Math.max(0, Math.min(level, multipliers.length - 1));
      return space.rent * multipliers[idx];
    }
    return space.rent;
  }, []);

  const nextTurn = useCallback(() => {
    setTurn(prev => (prev + 1) % players.length);
    setPhase('ROLL');
    setActionUsed(false);
    setActionResolved(false);
    setPendingSteps(0);
    setMovingPlayerId(null);
  }, [players.length]);

  const endTurn = useCallback(() => {
    if (readOnly) {
      if (onActionRequest && gameState.phase === 'ACTION') onActionRequest('END_TURN');
      return;
    }

    addLog(`➡️ ${currentPlayer.name} kết thúc lượt.`);
    nextTurn();
  }, [readOnly, onActionRequest, gameState.phase, currentPlayer.name, addLog, nextTurn]);

  const modifyMoney = useCallback((playerId, amount, reason) => {
    setPlayers(prev => prev.map(p => {
      if (p.id === playerId) {
        if (amount < 0 && p.money + amount < 0) {
           // Phá sản (đơn giản hóa: về $0)
           return { ...p, money: 0 };
        }
        return { ...p, money: p.money + amount };
      }
      return p;
    }));
  }, []);

  const syncPlayerNames = useCallback((nameMap) => {
    if (readOnly || !nameMap) return;
    setPlayers(prev => prev.map(player => {
      const nextName = nameMap[player.id];
      if (!nextName || nextName === player.name) return player;
      return { ...player, name: nextName };
    }));
  }, [readOnly]);

  const rollDice = useCallback(() => {
    if (readOnly) {
      if (onActionRequest && gameState.phase === 'ROLL') onActionRequest('ROLL');
      return;
    }

    if (phase !== 'ROLL') return;

    setPhase('ROLLING');
    setActionResolved(false);
    setPendingSteps(0);

    if (rollTimerRef.current) clearInterval(rollTimerRef.current);
    let ticks = 0;

    rollTimerRef.current = setInterval(() => {
      ticks += 1;
      const r1 = Math.floor(Math.random() * 6) + 1;
      const r2 = Math.floor(Math.random() * 6) + 1;
      setDice([r1, r2]);

      if (ticks >= 16) {
        clearInterval(rollTimerRef.current);
        rollTimerRef.current = null;

        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        setDice([d1, d2]);
        const steps = d1 + d2;
        addLog(`🎲 ${currentPlayer.name} đổ xúc xắc được ${steps} (${d1} + ${d2}).`);
        setPendingSteps(steps);
        setPhase('READY_TO_MOVE');
      }
    }, 150);
  }, [readOnly, onActionRequest, gameState.phase, phase, turn, currentPlayer.id, currentPlayer.name, addLog]);

  const startMove = useCallback(() => {
    if (readOnly) {
      if (onActionRequest && gameState.phase === 'READY_TO_MOVE') onActionRequest('MOVE');
      return;
    }

    if (phase !== 'READY_TO_MOVE' || pendingSteps <= 0) return;

    const playerIndex = turn;
    const playerId = currentPlayer.id;
    setPhase('MOVING');
    setMovingPlayerId(playerId);

    if (moveTimerRef.current) clearInterval(moveTimerRef.current);
    let remaining = pendingSteps;

    moveTimerRef.current = setInterval(() => {
      setPlayers(prev => prev.map((p, idx) => {
        if (idx !== playerIndex) return p;
        const nextPos = (p.position + 1) % 40;
        const passStartMoney = p.position + 1 >= 40 ? 200 : 0;
        if (passStartMoney > 0) {
          addLog(`💰 ${p.name} đi qua vạch Bắt Đầu, nhận $200.`);
        }
        return { ...p, position: nextPos, money: p.money + passStartMoney };
      }));

      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(moveTimerRef.current);
        moveTimerRef.current = null;
        setMovingPlayerId(null);
        setPendingSteps(0);
        setPhase('ACTION');
      }
    }, 420);
  }, [
    readOnly,
    onActionRequest,
    gameState.phase,
    phase,
    pendingSteps,
    turn,
    currentPlayer.id,
    addLog
  ]);

  // Xử lý hiệu ứng của ô ngay khi Phase chuyển sang ACTION
  useEffect(() => {
    if (readOnly) return;
    if (phase === 'ACTION' && !actionResolved) {
      const p = players[turn];
      const space = BOARD_SPACES[p.position];
      const prop = properties[space.id];

      if (space.type === 'tax') {
        addLog(`💸 ${p.name} dính Thuế phải nộp $${space.price}.`);
        modifyMoney(p.id, -space.price, 'Thuế');
      } else if (space.type === 'go_to_jail') {
        addLog(`🚓 ${p.name} BỊ BẮT VÀO TÙ!`);
        setPlayers(prev => prev.map(pl => pl.id === p.id ? { ...pl, position: 10, inJail: 3 } : pl));
        setActionResolved(true);
        endTurn();
        return; // Dừng lại vì đã end turn
      } else if (space.type === 'chance' || space.type === 'chest') {
        const bonus = Math.random() > 0.5 ? 50 : -50;
        if (bonus > 0) addLog(`🍀 ${p.name} nhận Cơ hội/Khí vận, được thưởng $${bonus}`);
        else addLog(`⚠️ ${p.name} dính Cơ hội/Khí vận xui, mất $${Math.abs(bonus)}`);
        modifyMoney(p.id, bonus, 'Event');
      } else if (['property', 'station', 'utility'].includes(space.type)) {
        if (prop && prop.ownerId !== p.id) {
          // Trả tiền thuê
          const owner = players.find(x => x.id === prop.ownerId);
          // Đơn giản hóa: Thuê = rent cơ bản * (level + 1)
          const rentToPay = getRentForSpace(space, prop.level);
          if(owner) {
             addLog(`💰 ${p.name} phải trả $${rentToPay} tiền thuê cho ${owner.name} tại ${space.name}.`);
             modifyMoney(p.id, -rentToPay);
             modifyMoney(owner.id, rentToPay);
          }
        }
      }

      setActionResolved(true);
    }
  }, [readOnly, phase, actionResolved, turn, players, properties, addLog, modifyMoney, endTurn]); // Chỉ handle hiệu ứng cơ bản

  const buyProperty = useCallback(() => {
    if (readOnly) {
      if (onActionRequest && gameState.phase === 'ACTION') onActionRequest('BUY');
      return;
    }

    if (phase !== 'ACTION') return;
    if (actionUsed) {
      addLog(`⛔ ${currentPlayer.name} đã dùng hành động trong lượt này.`);
      return;
    }
    if (['property', 'station', 'utility'].includes(currentSpace.type) && !currentProperty) {
      if (currentPlayer.money >= currentSpace.price) {
        modifyMoney(currentPlayer.id, -currentSpace.price);
        setProperties(prev => ({
          ...prev,
          [currentSpace.id]: { ownerId: currentPlayer.id, level: 0 }
        }));
        setActionUsed(true);
        addLog(`🏠 ${currentPlayer.name} đã mua ${currentSpace.name} với giá $${currentSpace.price}.`);
      } else {
         addLog(`❌ ${currentPlayer.name} không đủ tiền mua ${currentSpace.name}.`);
      }
    }
  }, [
    readOnly,
    onActionRequest,
    gameState.phase,
    phase,
    actionUsed,
    currentPlayer,
    currentSpace,
    currentProperty,
    modifyMoney,
    addLog
  ]);

  const upgradeProperty = useCallback(() => {
    if (readOnly) {
      if (onActionRequest && gameState.phase === 'ACTION') onActionRequest('UPGRADE');
      return;
    }

    if (phase !== 'ACTION') return;
    if (actionUsed) {
      addLog(`⛔ ${currentPlayer.name} đã dùng hành động trong lượt này.`);
      return;
    }
    if (currentSpace.type === 'property' && currentProperty && currentProperty.ownerId === currentPlayer.id) {
      if (currentProperty.level >= 4) {
        addLog(`🏢 ${currentSpace.name} đã đạt cấp tối đa!`);
        return;
      }
      if (currentPlayer.money >= currentSpace.housePrice) {
        modifyMoney(currentPlayer.id, -currentSpace.housePrice);
        setProperties(prev => ({
          ...prev,
          [currentSpace.id]: { ...prev[currentSpace.id], level: prev[currentSpace.id].level + 1 }
        }));
        setActionUsed(true);
        addLog(`⬆️ ${currentPlayer.name} đã nâng cấp ${currentSpace.name} lên cấp ${currentProperty.level + 1} ($${currentSpace.housePrice}).`);
      }
    }
  }, [
    readOnly,
    onActionRequest,
    gameState.phase,
    phase,
    actionUsed,
    currentPlayer,
    currentSpace,
    currentProperty,
    modifyMoney,
    addLog
  ]);

  // --- BOT LOGIC ---
  useEffect(() => {
    if (readOnly || disableBots) return undefined;
    let timer1, timer2;
    if (currentPlayer.type === 'bot') {
      if (phase === 'ROLL') {
        timer1 = setTimeout(() => {
          rollDice();
        }, 1000);
      } else if (phase === 'READY_TO_MOVE') {
        timer1 = setTimeout(() => {
          startMove();
        }, 1200);
      } else if (phase === 'ACTION') {
        timer2 = setTimeout(() => {
          const space = BOARD_SPACES[currentPlayer.position];
          const prop = properties[space.id];

          // Bot quyết định sau khi roll
          if (!actionUsed && ['property', 'station', 'utility'].includes(space.type)) {
            if (!prop) {
              // Mua nếu tiền dư nhiều hơn 300
              if (currentPlayer.money - space.price >= 300) {
                buyProperty();
              }
            } else if (prop.ownerId === currentPlayer.id && space.type === 'property') {
              // Nâng cấp nếu tiền dư nhiều hơn 300 và chưa max level
              if (prop.level < 4 && currentPlayer.money - space.housePrice >= 300) {
                upgradeProperty();
              }
            }
          }
          
          // Sau khi quyết định xong, tự động end turn
          setTimeout(() => endTurn(), 800);
        }, 1200);
      }
    }
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [
    readOnly,
    disableBots,
    phase,
    turn,
    actionUsed,
    currentPlayer,
    properties,
    buyProperty,
    upgradeProperty,
    endTurn,
    rollDice,
    startMove
  ]);

  useEffect(() => {
    return () => {
      if (rollTimerRef.current) clearInterval(rollTimerRef.current);
      if (moveTimerRef.current) clearInterval(moveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (readOnly || !onStateChange) return;
    onStateChange(liveState);
  }, [readOnly, onStateChange, liveState]);

  return {
    players: gameState.players,
    turn: gameState.turn,
    phase: gameState.phase,
    properties: gameState.properties,
    logs: gameState.logs,
    latestLog: gameState.latestLog,
    dice: gameState.dice,
    currentPlayer,
    currentSpace,
    currentProperty,
    actionUsed: gameState.actionUsed,
    pendingSteps: gameState.pendingSteps,
    movingPlayerId: gameState.movingPlayerId,
    rollDice,
    startMove,
    buyProperty,
    upgradeProperty,
    endTurn,
    syncPlayerNames
  };
}

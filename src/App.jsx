import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGame } from './hooks/useGame';
import { useRoom } from './hooks/useRoom';
import { BOARD_SPACES, getGridClasses } from './data/board';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function App() {
  const [roomInput, setRoomInput] = useState('');
  const [playerName, setPlayerName] = useState('');

  const {
    roomId,
    roomData,
    gameState,
    status,
    error,
    role,
    playerId,
    isHost,
    createRoom,
    joinRoom,
    updateGameState,
    sendAction,
    subscribeToActions,
    removeAction
  } = useRoom();

  const handleActionRequest = useCallback((type) => {
    if (!roomId || playerId == null) return;
    sendAction(type, playerId);
  }, [roomId, playerId, sendAction]);

  const handleStateChange = useCallback((nextState) => {
    if (!isHost || !roomId) return;
    updateGameState(nextState);
  }, [isHost, roomId, updateGameState]);

  const game = useGame({
    readOnly: !isHost,
    externalState: !isHost ? gameState : null,
    onActionRequest: handleActionRequest,
    onStateChange: handleStateChange,
    disableBots: !isHost
  });

  const {
    players,
    turn,
    phase,
    properties,
    logs,
    dice,
    currentPlayer,
    currentSpace,
    currentProperty,
    actionUsed,
    pendingSteps,
    movingPlayerId,
    rollDice,
    startMove,
    buyProperty,
    upgradeProperty,
    endTurn,
    syncPlayerNames
  } = game;

  const isMultiplayer = Boolean(roomId);
  const isMyTurn = isMultiplayer
    ? currentPlayer.type === 'human' && currentPlayer.id === playerId
    : currentPlayer.type === 'human';
  const isRolling = phase === 'ROLLING';
  const isMoving = phase === 'MOVING';

  const localPlayerName = useMemo(() => {
    if (!roomData || playerId == null) return '';
    return roomData.playersMeta?.[playerId]?.name || '';
  }, [roomData, playerId]);

  const playerTextById = {
    0: 'text-blue-600',
    1: 'text-red-500',
    2: 'text-green-600',
    3: 'text-yellow-600'
  };

  const playerNameClassMap = players.reduce((acc, player) => {
    acc[player.name] = playerTextById[player.id] || 'text-emerald-700';
    return acc;
  }, {});

  const spaceNameSet = new Set(BOARD_SPACES.map(space => space.name));

  const highlightLog = (text) => {
    if (!text) return text;
    const nameTokens = [
      ...Object.keys(playerNameClassMap),
      ...spaceNameSet
    ].filter(Boolean).sort((a, b) => b.length - a.length);
    const tokenPatterns = nameTokens.map(escapeRegExp);
    const tokenRegex = tokenPatterns.length > 0
      ? new RegExp(`(${tokenPatterns.join('|')}|\\$\\d+)`, 'g')
      : /(\$\d+)/g;

    const parts = text.split(tokenRegex).filter(part => part !== '');

    return parts.map((part, idx) => {
      if (/^\$\d+$/.test(part)) {
        return <span key={`${idx}-${part}`} className="text-emerald-700 font-bold">{part}</span>;
      }
      if (playerNameClassMap[part]) {
        return <span key={`${idx}-${part}`} className={`${playerNameClassMap[part]} font-semibold`}>{part}</span>;
      }
      if (spaceNameSet.has(part)) {
        return <span key={`${idx}-${part}`} className="text-amber-700 font-semibold">{part}</span>;
      }
      return <span key={`${idx}-${part}`}>{part}</span>;
    });
  };

  const handleIncomingAction = useCallback((actionId, action) => {
    if (!isHost || !action) return;
    if (!roomData?.playersMeta) return;
    const { type, playerId: actionPlayerId, clientId } = action;
    const expectedClientId = roomData?.playersMeta?.[actionPlayerId]?.clientId;
    if (!expectedClientId || expectedClientId !== clientId) {
      removeAction(actionId);
      return;
    }

    if (currentPlayer.id !== actionPlayerId || currentPlayer.type !== 'human') {
      removeAction(actionId);
      return;
    }

    switch (type) {
      case 'ROLL':
        rollDice();
        break;
      case 'MOVE':
        startMove();
        break;
      case 'BUY':
        buyProperty();
        break;
      case 'UPGRADE':
        upgradeProperty();
        break;
      case 'END_TURN':
        endTurn();
        break;
      default:
        break;
    }

    removeAction(actionId);
  }, [
    isHost,
    roomData,
    currentPlayer.id,
    currentPlayer.type,
    rollDice,
    startMove,
    buyProperty,
    upgradeProperty,
    endTurn,
    removeAction
  ]);

  useEffect(() => {
    if (!isHost || !roomId) return undefined;
    return subscribeToActions(handleIncomingAction);
  }, [isHost, roomId, subscribeToActions, handleIncomingAction]);

  useEffect(() => {
    if (!isHost || !roomData?.playersMeta) return;
    const nameMap = roomData.playersMeta.reduce((acc, player) => {
      if (player?.name) acc[player.id] = player.name;
      return acc;
    }, {});
    syncPlayerNames(nameMap);
  }, [isHost, roomData, syncPlayerNames]);

  if (!roomId) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8">
          <div className="text-center">
            <div className="text-xs uppercase tracking-[0.3em] text-emerald-600 font-semibold">Multiplayer</div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mt-2">Monopoly VN - Chơi 2 người</h1>
            <p className="text-sm text-slate-500 mt-2">Tạo phòng trên Vercel KV, mời 1 bạn vào bằng mã phòng.</p>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 font-semibold">Tên của bạn</label>
              <input
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                placeholder="Ví dụ: Khoa"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => createRoom(playerName)}
                disabled={status === 'creating' || status === 'joining'}
                className="flex-1 rounded-xl bg-emerald-600 text-white font-semibold py-3 px-4 shadow hover:bg-emerald-500 disabled:opacity-60"
              >
                {status === 'creating' ? 'Đang tạo phòng...' : 'Tạo phòng (Bạn là chủ phòng)'}
              </button>
              <div className="flex-1">
                <input
                  value={roomInput}
                  onChange={(event) => setRoomInput(event.target.value)}
                  placeholder="Nhập mã phòng"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
                <button
                  type="button"
                  onClick={() => joinRoom(roomInput, playerName)}
                  disabled={status === 'creating' || status === 'joining'}
                  className="mt-2 w-full rounded-xl bg-slate-800 text-white font-semibold py-3 px-4 shadow hover:bg-slate-700 disabled:opacity-60"
                >
                  {status === 'joining' ? 'Đang vào phòng...' : 'Vào phòng'}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</div>
            )}

            <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              Mẹo: Chủ phòng sẽ điều khiển 2 bot. Người thứ 2 chỉ cần nhập mã phòng và chơi đến lượt mình.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const recentLogs = logs.slice(0, 3);

  const roleLabel = isHost ? 'Chủ phòng' : 'Khách';
  const roomStatusLabel = roomData?.status === 'waiting'
    ? 'Đang chờ người thứ 2 vào'
    : roomData?.status === 'active'
      ? 'Đang chơi'
      : '';

  const phaseLabel = phase === 'ROLL'
    ? '🎲 Lượt Đổ'
    : phase === 'ROLLING'
      ? '🎲 Đang lắc'
      : phase === 'READY_TO_MOVE'
        ? '🧭 Sẵn sàng di chuyển'
        : phase === 'MOVING'
          ? '🚶 Đang di chuyển'
          : '⚙️ Hành Động';

  const rollLabel = isRolling ? '🎲 Đang lắc...' : '🎲 Đổ Xúc Xắc';
  const moveLabel = pendingSteps > 0 ? `🚶 Di Chuyển (${pendingSteps} ô)` : '🚶 Di Chuyển';

  const typeLabelByType = {
    property: 'Đất',
    station: 'Bến xe',
    utility: 'Tiện ích',
    chance: 'Cơ hội',
    chest: 'Khí vận',
    tax: 'Thuế',
    jail: 'Thăm/Vào tù',
    go_to_jail: 'Tới tù',
    parking: 'Đỗ xe',
    start: 'Bắt đầu'
  };
  const currentTypeLabel = typeLabelByType[currentSpace.type] || 'Ô đặc biệt';

  const spaceBgByType = {
    property: 'bg-emerald-50',
    station: 'bg-sky-50',
    utility: 'bg-cyan-50',
    chance: 'bg-rose-50',
    chest: 'bg-violet-50',
    tax: 'bg-orange-50',
    jail: 'bg-slate-100',
    go_to_jail: 'bg-amber-50',
    parking: 'bg-teal-50',
    start: 'bg-green-50'
  };

  const isOwnableSpace = ['property', 'station', 'utility'].includes(currentSpace.type);
  const mortgageValue = currentSpace.price ? Math.floor(currentSpace.price * 0.5) : null;
  const housePriceValue = currentSpace.housePrice ?? null;
  const hotelPriceValue = housePriceValue ? housePriceValue * 5 : null;
  const currentOwner = currentProperty ? players.find(p => p.id === currentProperty.ownerId) : null;

  const rentTable = (() => {
    if (!currentSpace.rent) return [];
    if (currentSpace.type === 'property') {
      const multipliers = [1, 5, 15, 45, 80, 125];
      const labels = ['0 nhà', '1 nhà', '2 nhà', '3 nhà', '4 nhà', 'Biệt thự'];
      return labels.map((label, idx) => ({ label, value: currentSpace.rent * multipliers[idx] }));
    }
    return [{ label: 'Thuê cơ bản', value: currentSpace.rent }];
  })();

  const ownershipByPlayer = players.reduce((acc, p) => {
    acc[p.id] = [];
    return acc;
  }, {});

  Object.entries(properties).forEach(([spaceId, prop]) => {
    const space = BOARD_SPACES.find(s => s.id === Number(spaceId));
    if (!space) return;
    if (!ownershipByPlayer[prop.ownerId]) ownershipByPlayer[prop.ownerId] = [];
    ownershipByPlayer[prop.ownerId].push(space);
  });

  // Lắp logic render Board thay vì chỗ rỗng
  const renderBoard = () => {
    return (
        <div 
          className="grid gap-[2px] bg-emerald-950 p-[2px] w-full h-full"
          style={{ gridTemplateColumns: 'repeat(11, minmax(0, 1fr))', gridTemplateRows: 'repeat(11, minmax(0, 1fr))' }}
        >
          {/* Vùng rỗng giữa bàn cờ - Render thông tin xúc xắc */}
          <div className="col-start-2 col-end-11 row-start-2 row-end-11 bg-emerald-100 flex flex-col justify-center items-center rounded-sm relative overflow-hidden">
            <h1 className="text-[1.5rem] sm:text-4xl md:text-6xl font-black text-emerald-800/10 rotate-[-45deg] tracking-tighter drop-shadow-lg select-none whitespace-nowrap absolute w-[150%] text-center">
              MONOPOLY VN
            </h1>
            
            <div className="z-10 flex flex-col items-center gap-4 w-[90%] max-w-[420px]">
              <div className="text-xl sm:text-2xl font-bold bg-white/90 px-6 py-3 rounded-xl shadow-md text-center border-2 border-emerald-500 w-full">
                <span className="text-xs sm:text-sm text-gray-500 uppercase tracking-wider">Lượt hiện tại</span><br/>
                <span className={`text-3xl sm:text-4xl font-extrabold ${currentPlayer.type === 'human' ? 'text-blue-600' : 'text-red-500'} block my-2`}>{currentPlayer.name}</span>
                <span className="text-sm sm:text-base text-gray-500 bg-gray-100 px-3 py-1 rounded-full uppercase tracking-wider">
                  {phaseLabel}
                </span>
              </div>

              <div className="w-full bg-white/95 backdrop-blur-md border border-emerald-200 text-emerald-900 shadow-lg rounded-xl px-4 py-3">
                <div className="text-[10px] sm:text-xs uppercase tracking-wider text-emerald-700 mb-1">Nhật ký nhanh (3 gần nhất)</div>
                <div className="flex flex-col gap-1 text-[12px] sm:text-sm font-semibold leading-snug">
                  {recentLogs.length === 0 ? (
                    <span className="text-gray-500">Chưa có log.</span>
                  ) : (
                    recentLogs.map((log, index) => (
                      <div
                        key={`${index}-${log}`}
                        className="bg-emerald-50/70 border border-emerald-100 rounded-md px-2 py-1"
                      >
                        {highlightLog(log)}
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              {(phase === 'ACTION' || isRolling || isMoving || phase === 'READY_TO_MOVE') && (
                <div className={`flex gap-4 text-4xl sm:text-5xl bg-white/95 p-4 sm:p-5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-b-4 border-gray-200 ${isRolling ? 'dice-roll' : ''}`}>
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center bg-gradient-to-br from-red-50 to-white rounded-xl shadow-inner border border-red-100/50 transform ${dice[0] % 2 === 0 ? 'rotate-6' : '-rotate-6'}`}>
                    <span className="text-red-600 textShadow font-black">{dice[0]}</span>
                  </div>
                  <div className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center bg-gradient-to-br from-blue-50 to-white rounded-xl shadow-inner border border-blue-100/50 transform ${dice[1] % 2 === 0 ? 'rotate-12' : '-rotate-6'}`}>
                    <span className="text-blue-600 textShadow font-black">{dice[1]}</span>
                  </div>
                </div>
              )}

              {isMyTurn && phase === 'ROLL' && (
                <button
                  onClick={rollDice}
                  className="w-full py-4 text-xl font-bold rounded-xl shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-blue-300 bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 text-white transform hover:-translate-y-1 shadow-[0_6px_0_#1d4ed8] active:shadow-none active:translate-y-1"
                >
                  {rollLabel}
                </button>
              )}

              {isMyTurn && phase === 'READY_TO_MOVE' && (
                <button
                  onClick={startMove}
                  className="w-full py-4 text-xl font-bold rounded-xl shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-emerald-300 bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white transform hover:-translate-y-1 shadow-[0_6px_0_#047857] active:shadow-none active:translate-y-1"
                >
                  {moveLabel}
                </button>
              )}

              {phase === 'ACTION' && isMyTurn && currentSpace.type === 'property' && (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 text-center shadow-inner relative overflow-hidden w-full">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-200 rounded-bl-full -z-10 opacity-50"></div>
                  
                  <div className="mb-4">
                     <p className="text-xs text-yellow-600 font-bold uppercase tracking-wider mb-1">Đang ở ô</p>
                     <p className="font-extrabold text-yellow-900 text-2xl">{currentSpace.name}</p>
                     {currentProperty && (
                       <p className="text-xs text-gray-500 mt-1 font-mono">
                         Chủ: {players.find(p => p.id === currentProperty.ownerId)?.name || 'Không rõ'}
                       </p>
                     )}
                  </div>

                  {!currentProperty && (
                    <button 
                      onClick={buyProperty}
                      disabled={actionUsed || currentPlayer.money < currentSpace.price}
                      className="w-full bg-gradient-to-b from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white font-bold py-3 px-4 rounded-lg mb-2 shadow-[0_4px_0_#166534] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-1"
                    >
                      Mua Nhanh (${currentSpace.price})
                    </button>
                  )}

                  {currentProperty && currentProperty.ownerId === currentPlayer.id && currentProperty.level < 4 && (
                    <button 
                      onClick={upgradeProperty}
                      disabled={actionUsed || currentPlayer.money < currentSpace.housePrice}
                      className="w-full bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-bold py-3 px-4 rounded-lg mb-2 shadow-[0_4px_0_#b45309] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-1"
                    >
                      Xây Nhà / Nâng Cấp (${currentSpace.housePrice})
                    </button>
                  )}

                  {actionUsed && (
                    <p className="text-xs text-gray-500 font-semibold">Bạn đã dùng 1 hành động trong lượt này.</p>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* 40 Ô Cờ */}
          {BOARD_SPACES.map(space => {
            const { col, row } = getGridClasses(space.id);
            const isCorner = [0, 10, 20, 30].includes(space.id);
            const spaceBg = spaceBgByType[space.type] || 'bg-emerald-50';
            
            // Tìm xem có player nào đang đứng ở ô này không
            const playersHere = players.filter(p => p.position === space.id);
            const propData = properties[space.id];
            let ownerPlayer = null;
            if (propData) {
               ownerPlayer = players.find(p => p.id === propData.ownerId);
            }

            return (
              <div 
                key={space.id} 
                className={`relative flex flex-col ${spaceBg} outline outline-[1px] outline-emerald-900 overflow-hidden ${isCorner ? 'p-1' : ''}`}
                style={{ gridColumn: col, gridRow: row }}
              >
                  {/* Nhãn màu cho ô đất */}
                  {space.color && (
                    <div className={`h-[30%] w-full ${space.color} border-b border-black/20 flex justify-center items-end`}>
                      {propData && (
                        <div className="absolute top-0 right-0 p-1 flex gap-[2px]">
                          {Array.from({length: propData.level}).map((_, i) => (
                             <span key={i} className="text-[10px] sm:text-xs">🏠</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tên ô và Giá */}
                  <div className={`flex-1 flex flex-col items-center p-2 leading-tight justify-center text-center bg-white/75 backdrop-blur-sm rounded-md border border-white/80 shadow-inner`}>
                    <span className={`font-bold ${isCorner ? 'text-[9px]' : 'text-[9px] sm:text-[12px]'} lg:text-sm text-emerald-950 uppercase break-words`}>
                      {space.name}
                    </span>
                    {space.price && <span className="text-[10px] sm:text-[11px] lg:text-sm font-semibold font-mono text-gray-800 border-t border-gray-200 w-full pt-[2px] mt-auto">${space.price}</span>}
                  </div>
                  
                  {/* Highlight owner color ở viền dưới */}
                  {ownerPlayer && (
                     <div className={`absolute bottom-0 w-full h-[5px] sm:h-2 ${ownerPlayer.color} shadow-[0_-2px_4px_rgba(0,0,0,0.1)]`} title={`Sở hữu bởi ${ownerPlayer.name}`} />
                  )}

                  {/* Chủ sở hữu */}
                  {ownerPlayer && (
                    <div className="absolute top-0 left-0 bg-white/85 text-[8px] sm:text-[10px] px-1 py-[1px] rounded-br shadow">
                      <span className="mr-[2px]">{ownerPlayer.icon}</span>
                      <span className="hidden sm:inline">{ownerPlayer.name}</span>
                    </div>
                  )}

                  {/* Icon Người chơi */}
                  {playersHere.length > 0 && (
                    <div className="absolute inset-0 flex justify-center items-center flex-wrap gap-1 bg-black/5 z-10 p-1">
                      {playersHere.map(p => (
                        <div 
                          key={p.id} 
                          title={p.name}
                          className={`w-4 h-4 sm:w-6 sm:h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-sm shadow-lg border-2 bg-gradient-to-b from-white to-gray-200 transform transition-all duration-300 ${turn === p.id ? 'scale-125 z-20 ring-4 ring-yellow-400' : 'scale-100'} ${p.id === movingPlayerId ? 'token-moving' : ''} ${p.color}`}
                        >
                          <span className="drop-shadow-md pb-[2px]">{p.icon}</span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            );
          })}
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white border-b border-slate-200 px-4 py-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2 text-slate-700 font-semibold">
          <span>Phòng:</span>
          <span className="font-mono bg-slate-100 px-2 py-1 rounded-md">{roomId}</span>
        </div>
        <div className="flex items-center gap-3 text-slate-500">
          <span>Vai trò: {roleLabel}</span>
          {localPlayerName && <span>Bạn: {localPlayerName}</span>}
          {roomStatusLabel && <span className="text-emerald-600 font-semibold">{roomStatusLabel}</span>}
        </div>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(roomId)}
          className="rounded-lg border border-slate-200 px-3 py-1 text-slate-600 hover:text-slate-900 hover:border-slate-300"
        >
          Copy mã phòng
        </button>
      </div>

      <div className="xl:h-[calc(100vh-48px)] flex flex-col xl:flex-row bg-slate-100 p-0 font-sans text-sm gap-0">
      
      {/* CỘT TRÁI: Dữ liệu Player */}
      <div className="w-full xl:w-[280px] shrink-0 flex flex-col h-auto xl:h-screen">
        <div className="bg-white p-4 border-r border-gray-200 h-full">
           <h2 className="text-xl font-bold text-center text-blue-900 uppercase tracking-widest border-b pb-3 mb-3 shrink-0">👥 Người chơi</h2>
           <div className="flex flex-col gap-3 xl:overflow-y-auto xl:max-h-[calc(100vh-100px)]">
             {players.map((p, idx) => (
                <div key={p.id} className={`p-3 relative border-2 rounded-xl transition-all shadow-sm flex flex-col gap-1 ${turn === idx ? 'border-amber-500 bg-amber-50 scale-105 z-10' : 'border-gray-100 bg-white'}`}>
                  
                  {/* Indicator current turn */}
                  {turn === idx && (
                    <span className="absolute -top-3 -right-2 w-8 h-8 flex items-center justify-center bg-amber-500 text-white rounded-full font-bold shadow-lg animate-bounce z-20">Lượt</span>
                  )}
                  
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-inner border-2 ${p.color} border-white`}>{p.icon}</div>
                    <div>
                      <h3 className="font-bold text-gray-800 leading-tight">{p.name}</h3>
                      <p className="text-[10px] text-gray-400 uppercase font-semibold">{p.type === 'human' ? 'Người thật' : 'Máy (AI)'}</p>
                    </div>
                  </div>
                  
                  <div className="bg-white/50 rounded p-2 mt-1 border border-black/5 flex justify-between items-center">
                    <span className="text-gray-500 text-xs font-semibold">Tài sản</span>
                    <span className={`text-xl font-black ${p.money <= 0 ? 'text-red-500' : 'text-green-600'} font-mono`}>
                      ${p.money}
                    </span>
                  </div>

                  <div className="mt-2">
                    <p className="text-[10px] uppercase text-gray-400 font-semibold mb-1">Đang sở hữu ({ownershipByPlayer[p.id]?.length || 0})</p>
                    <div className="flex flex-wrap gap-1">
                      {(ownershipByPlayer[p.id] || []).length === 0 && (
                        <span className="text-[10px] text-gray-400">Chưa có tài sản</span>
                      )}
                      {(ownershipByPlayer[p.id] || []).map(space => (
                        <span key={`${p.id}-${space.id}`} className="text-[10px] px-2 py-[2px] rounded-full bg-slate-100 border border-slate-200 text-slate-600">
                          {space.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Túi đồ nhỏ nếu bị ngồi tù */}
                  {p.inJail > 0 && <div className="text-xs text-red-600 bg-red-100 rounded px-2 py-1 mt-1 text-center font-bold border border-red-200">⛓️ Bị giam ({p.inJail} lượt)</div>}
                </div>
             ))}
           </div>
        </div>
      </div>

      {/* CỘT GIỮA: Bàn cờ */}
      <div className="flex-1 flex justify-center items-center overflow-hidden bg-emerald-700">
        <div className="w-full h-full max-w-full max-h-full aspect-square">
           {renderBoard()}
        </div>
      </div>

      {/* CỘT PHẢI: Lệnh điều khiển */}
      <div className="w-full xl:w-[320px] shrink-0 flex flex-col h-auto xl:h-screen">
        
        {/* Nút hành động */}
        <div className="bg-white p-4 border-l border-gray-200 flex flex-col gap-3">
          <h2 className="text-xl font-bold text-center text-orange-600 uppercase tracking-widest border-b pb-3 shrink-0 mb-1">🎮 Điều Khiển</h2>
          
          <button 
            disabled={!isMyTurn || phase !== 'ACTION'} 
            onClick={endTurn}
            className={`w-full py-4 text-lg font-bold rounded-xl shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-gray-300 mt-2 ${(!isMyTurn || phase !== 'ACTION') ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' : 'bg-gradient-to-b from-slate-700 to-slate-900 hover:from-slate-600 hover:to-slate-800 text-white transform hover:-translate-y-1 shadow-[0_6px_0_#334155] active:shadow-none active:translate-y-1'}`}
          >
            ⏭️ Qua Lượt
          </button>
        </div>

        {/* Chi tiết ô hiện tại */}
        <div className="bg-white border-l border-gray-200 flex-1 flex flex-col overflow-hidden min-h-[300px]">
          <h3 className="font-bold text-slate-700 p-3 bg-slate-100 text-center uppercase tracking-wider text-sm border-b border-gray-200 shrink-0">📌 Chi Tiết Ô</h3>
          <div className="overflow-y-auto p-4 flex-1 space-y-3 bg-slate-50/50">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="text-[10px] sm:text-xs uppercase tracking-wider text-slate-500">{currentTypeLabel}</div>
              <div className="text-lg sm:text-xl font-extrabold text-slate-800">{currentSpace.name}</div>

              {currentOwner && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Chủ sở hữu:</span>
                  <span className="font-bold">{currentOwner.name}</span>
                  <span>{currentOwner.icon}</span>
                </div>
              )}

              {currentProperty && typeof currentProperty.level === 'number' && (
                <div className="mt-1 text-sm text-slate-600">Cấp nhà: {currentProperty.level}</div>
              )}

              {isOwnableSpace && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:text-sm">
                  {currentSpace.price != null && (
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-2 py-1">
                      <span>Giá mua</span>
                      <span className="font-bold">${currentSpace.price}</span>
                    </div>
                  )}
                  {mortgageValue != null && (
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-2 py-1">
                      <span>Cầm cố</span>
                      <span className="font-bold">${mortgageValue}</span>
                    </div>
                  )}
                  {housePriceValue != null && (
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-2 py-1">
                      <span>Giá nhà</span>
                      <span className="font-bold">${housePriceValue}</span>
                    </div>
                  )}
                  {hotelPriceValue != null && (
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-2 py-1">
                      <span>Giá biệt thự</span>
                      <span className="font-bold">${hotelPriceValue}</span>
                    </div>
                  )}
                </div>
              )}

              {!isOwnableSpace && currentSpace.price != null && (
                <div className="mt-2 text-sm text-slate-600">Phí: ${currentSpace.price}</div>
              )}

              {rentTable.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] sm:text-xs uppercase tracking-wider text-slate-500 mb-1">Bảng tiền thuê</div>
                  <div className="grid grid-cols-2 gap-1 text-[10px] sm:text-xs">
                    {rentTable.map(item => (
                      <div key={item.label} className="bg-emerald-50 border border-emerald-200 rounded px-2 py-1 text-emerald-800">
                        <span className="font-semibold">{item.label}:</span> ${item.value}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentSpace.type === 'chance' && (
                <div className="mt-2 text-sm text-rose-700">Nhận thưởng hoặc mất tiền ngẫu nhiên.</div>
              )}
              {currentSpace.type === 'chest' && (
                <div className="mt-2 text-sm text-violet-700">Sự kiện bất ngờ có thể lợi/hại.</div>
              )}
            </div>
          </div>
        </div>

      </div>

      </div>
    </div>
  );
}

export default App;

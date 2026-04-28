export const INITIAL_PLAYERS = [
  { id: 0, name: 'Người thật 1', type: 'human', money: 1500, position: 0, color: 'bg-blue-600', icon: '👤', inJail: 0 },
  { id: 1, name: 'Người thật 2', type: 'human', money: 1500, position: 0, color: 'bg-red-500', icon: '👩', inJail: 0 },
  { id: 2, name: 'Bot AI 1', type: 'bot', money: 1500, position: 0, color: 'bg-green-500', icon: '🤖', inJail: 0 },
  { id: 3, name: 'Bot AI 2', type: 'bot', money: 1500, position: 0, color: 'bg-yellow-500', icon: '👾', inJail: 0 }
];

export const getInitialGameState = () => ({
  players: INITIAL_PLAYERS.map(player => ({ ...player })),
  turn: 0,
  phase: 'ROLL',
  properties: {},
  logs: ['🎮 Game bắt đầu!'],
  latestLog: '🎮 Game bắt đầu!',
  dice: [1, 1],
  actionUsed: false,
  actionResolved: false,
  pendingSteps: 0,
  movingPlayerId: null
});

import React, { useEffect } from 'react';
import { useGameStore } from './stores/gameStore';
import { GamePhase } from './core/game';
import Tile from './components/Tile';
import Hand from './components/Hand';
import DiscardPile from './components/DiscardPile';
import Board from './components/Board';
import { Tile as TileType, Suit } from './core/tile';

function App() {
  const {
    state,
    difficulty,
    aiMode,
    startNewGame,
    drawTile,
    selectTile,
    discardTile,
    passAction,
  } = useGameStore();

  const selectedTileId = useGameStore((s) => s.selectedTileId);
  const isAITurn = useGameStore((s) => s.isAITurn);

  const humanIndex = 0;
  const isHumanTurn = state.currentPlayer === humanIndex;
  const isHumanDrawPhase = isHumanTurn && state.turnAction === 'draw';
  const isHumanDiscardPhase = isHumanTurn && state.turnAction === 'discard';

  const handleTileClick = (tile: TileType) => {
    if (isHumanDiscardPhase) {
      selectTile(tile.id);
    }
  };

  const handleTileDoubleClick = (tile: TileType) => {
    if (isHumanDiscardPhase) {
      discardTile(tile.id);
    }
  };

  const handleDrawClick = () => {
    if (isHumanDrawPhase) {
      drawTile();
    }
  };

  const handleDiscardClick = () => {
    if (selectedTileId && isHumanDiscardPhase) {
      discardTile(selectedTileId);
    }
  };

  const handlePass = () => {
    passAction();
  };

  const handleStartGame = () => {
    startNewGame();
  };

  // Show start screen
  if (state.phase === GamePhase.INIT) {
    return (
      <div className="min-h-screen bg-green-800 flex flex-col items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-4">🀄 台灣16張麻將</h1>
          <p className="text-green-200 mb-8">單機版 · 練牌好幫手</p>

          {/* Start Button */}
          <button
            onClick={handleStartGame}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-4 px-12 rounded-xl text-2xl shadow-lg transition-all hover:scale-105"
          >
            開始遊戲
          </button>
        </div>
      </div>
    );
  }

  // Show game over screen
  if (state.phase === GamePhase.GAME_OVER || state.winner !== null) {
    const winner = state.winner !== null ? state.players[state.winner] : null;
    const isHumanWinner = state.winner === humanIndex;

    return (
      <div className="min-h-screen bg-green-800 flex flex-col items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-yellow-400 mb-4">
            {isHumanWinner ? '🏆 恭喜，你贏了！' : '💀 遊戲結束'}
          </h1>

          {/* Score display */}
          <div className="mb-8 bg-green-900 rounded-lg p-6">
            <h3 className="text-white mb-4">結算</h3>
            <div className="grid grid-cols-4 gap-4">
              {state.players.map((player, index) => (
                <div key={index} className="text-center">
                  <div className={`text-sm mb-1 ${player.isHuman ? 'text-yellow-400' : 'text-green-300'}`}>
                    {player.isHuman ? '👤 你' : player.id}
                  </div>
                  <div className="text-xl font-bold text-white">
                    {player.score || 0} 台
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleStartGame}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-8 rounded-lg text-xl"
          >
            再來一局
          </button>
        </div>
      </div>
    );
  }

  // Show game screen
  const humanPlayer = state.players[humanIndex];

  // Get players in display order (human at bottom)
  const displayPlayers = [
    { player: state.players[2], position: 'top' as const, isHuman: false },
    { player: state.players[1], position: 'right' as const, isHuman: false },
    { player: state.players[0], position: 'bottom' as const, isHuman: true },
    { player: state.players[3], position: 'left' as const, isHuman: false },
  ];

  const remainingTiles = state.wall.tiles.length - state.wall.position;

  // Determine turn indicator
  const getTurnText = () => {
    if (isHumanDrawPhase) return '🎯 輪到你了 — 點擊摸牌';
    if (isHumanDiscardPhase) return '👤 輪到你了 — 請出牌';
    return '🤖 AI 思考中...';
  };

  return (
    <div className="min-h-screen bg-green-700 flex flex-col">
      {/* Header */}
      <div className="bg-green-900 p-3 flex justify-between items-center text-white text-sm">
        <span className="font-bold">🀄 台灣16張麻將</span>
        <div className="flex gap-4">
          <span>牌牆：{remainingTiles} 張</span>
          <span>難度：{difficulty === 'easy' ? '簡單' : difficulty === 'normal' ? '普通' : '困難'}</span>
          <span>AI：{aiMode === 'llm' ? '🤖 LLM' : '🧮 演算法'}</span>
        </div>
      </div>

      {/* Game Area */}
      <div className="flex-1 flex flex-col">
        {/* Top player (North) */}
        <div className="flex justify-center p-2 bg-green-800/50">
          <div className="text-center">
            <div className="text-white text-xs mb-1">北 {state.players[2].hand.length}張</div>
            <div className="flex gap-0.5 justify-center">
              {state.players[2].hand.slice(0, 9).map((_, i) => (
                <div key={i} className="w-5 h-6 bg-blue-800 rounded-sm border border-blue-600" />
              ))}
              {state.players[2].hand.length > 9 && (
                <span className="text-white text-xs ml-1">+{state.players[2].hand.length - 9}</span>
              )}
            </div>
          </div>
        </div>

        {/* Middle row */}
        <div className="flex-1 flex">
          {/* Left player (West) */}
          <div className="w-24 p-2 bg-green-800/50 flex flex-col items-center">
            <div className="text-white text-xs mb-1">西 {state.players[3].hand.length}張</div>
            <div className="flex flex-col gap-0.5">
              {state.players[3].hand.slice(0, 6).map((_, i) => (
                <div key={i} className="w-5 h-7 bg-blue-800 rounded-sm border border-blue-600" />
              ))}
            </div>
          </div>

          {/* Center */}
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            {/* Turn indicator */}
            <div className={`text-lg font-bold ${isHumanTurn ? 'text-yellow-400' : 'text-white'}`}>
              {getTurnText()}
            </div>

            {/* Last discard */}
            {state.lastDiscard && (
              <div className="text-center">
                <div className="text-white text-xs mb-1">最後捨牌</div>
                <Tile tile={state.lastDiscard} size="lg" />
              </div>
            )}

            {/* Wall indicator */}
            <div className="text-white text-center opacity-50">
              <div className="text-2xl">🀫</div>
              <div className="text-xs">{remainingTiles} 張</div>
            </div>
          </div>

          {/* Right player (East) */}
          <div className="w-24 p-2 bg-green-800/50 flex flex-col items-center">
            <div className="text-white text-xs mb-1">東 {state.players[1].hand.length}張</div>
            <div className="flex flex-col gap-0.5">
              {state.players[1].hand.slice(0, 6).map((_, i) => (
                <div key={i} className="w-5 h-7 bg-blue-800 rounded-sm border border-blue-600" />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom player (Human) */}
        <div className="p-4 bg-green-900/50">
          {/* Human's hand */}
          <div className="text-center mb-4">
            <div className="text-white text-sm mb-2">
              👤 你的手牌（南）— {humanPlayer.hand.length} 張
            </div>

            <div className="flex flex-wrap gap-1 justify-center">
              {humanPlayer.hand
                .sort((a, b) => {
                  if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
                  return a.value - b.value;
                })
                .map((tile) => (
                  <Tile
                    key={tile.id}
                    tile={tile}
                    size="md"
                    selected={selectedTileId === tile.id}
                    onClick={() => handleTileClick(tile)}
                  />
                ))}
            </div>

            {/* Instructions */}
            <div className="text-white/50 text-xs mt-2">
              {isHumanDrawPhase
                ? '🎯 點擊下方「摸牌」按鈕'
                : isHumanDiscardPhase
                  ? '👆 點擊選牌，雙擊直接出牌'
                  : '⏳ 等待 AI...'}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-center gap-3">
            {isHumanDrawPhase ? (
              <button
                onClick={handleDrawClick}
                className="px-6 py-2 rounded-lg font-bold text-black bg-yellow-500 hover:bg-yellow-600 transition-all cursor-pointer"
              >
                摸牌
              </button>
            ) : (
              <>
                <button
                  onClick={handleDiscardClick}
                  disabled={!selectedTileId || !isHumanDiscardPhase}
                  className={`
                    px-6 py-2 rounded-lg font-bold text-white
                    transition-all
                    ${selectedTileId && isHumanDiscardPhase
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-black cursor-pointer'
                      : 'bg-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  打出所選麻將
                </button>

                <button
                  onClick={handlePass}
                  disabled={!isHumanDiscardPhase}
                  className={`
                    px-6 py-2 rounded-lg font-bold text-white
                    transition-all
                    ${isHumanDiscardPhase
                      ? 'bg-gray-600 hover:bg-gray-700 cursor-pointer'
                      : 'bg-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  過（pass）
                </button>
              </>
            )}
          </div>

          {/* Human's discard pile */}
          <div className="mt-4">
            <div className="text-white text-xs mb-1">你的捨牌</div>
            <DiscardPile tiles={humanPlayer.discards} />
          </div>
        </div>
      </div>

      {/* Discard piles for other players */}
      <div className="bg-green-800/30 p-2 flex justify-around">
        <div className="text-center">
          <div className="text-white text-xs mb-1">東</div>
          <div className="flex flex-wrap gap-0.5 justify-center max-w-24">
            {state.players[1].discards.slice(-6).map((t, i) => (
              <Tile key={`${t.id}-${i}`} tile={t} size="sm" />
            ))}
          </div>
        </div>
        <div className="text-center">
          <div className="text-white text-xs mb-1">南</div>
          <div className="flex flex-wrap gap-0.5 justify-center max-w-24">
            {state.players[2].discards.slice(-6).map((t, i) => (
              <Tile key={`${t.id}-${i}`} tile={t} size="sm" />
            ))}
          </div>
        </div>
        <div className="text-center">
          <div className="text-white text-xs mb-1">西</div>
          <div className="flex flex-wrap gap-0.5 justify-center max-w-24">
            {state.players[3].discards.slice(-6).map((t, i) => (
              <Tile key={`${t.id}-${i}`} tile={t} size="sm" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

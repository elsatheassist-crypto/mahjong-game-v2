import React, { useState, useMemo, useCallback } from 'react';
import { useGameStore } from './stores/gameStore';
import { GamePhase } from './core/game';
import Tile from './components/Tile';
import DiscardPile from './components/DiscardPile';
import GameSettings from './components/GameSettings';
import { Tile as TileType } from './core/tile';
import { canChi, canPeng, getChiOptions, getPengOption } from './core/meld';

function App() {
  // ========== HOOKS - MUST BE AT TOP, NO CONDITIONAL ==========
  const {
    state,
    difficulty,
    aiMode,
    llmConfig,
    startNewGame,
    drawTile,
    selectTile,
    discardTile,
    passAction,
    setDifficulty,
    setAIMode,
    setLLMConfig,
  } = useGameStore();

  const selectedTileId = useGameStore((s) => s.selectedTileId);
  const lastDrawnTileId = useGameStore((s) => s.lastDrawnTileId);
  const isAITurn = useGameStore((s) => s.isAITurn);

  const [showSettings, setShowSettings] = useState(false);

  // Pre-compute values that are always needed (no hooks here)
  const humanIndex = 0;
  const humanPlayer = state.players[humanIndex];
  const isHumanTurn = state.currentPlayer === humanIndex;
  const isHumanDrawPhase = isHumanTurn && state.turnAction === 'draw';
  const isHumanDiscardPhase = isHumanTurn && state.turnAction === 'discard';
  const remainingTiles = state.wall.tiles.length - state.wall.position;

  // Only compute chi/peng when in PLAYING phase and there's a discard to consider
  const canChiPeng = useMemo(() => {
    if (state.phase !== GamePhase.PLAYING) {
      return { canChi: false, canPeng: false, chiOptions: [], pengOption: null };
    }
    if (!state.lastDiscard || state.lastDiscardPlayer === null || state.lastDiscardPlayer === humanIndex) {
      return { canChi: false, canPeng: false, chiOptions: [], pengOption: null };
    }

    const discarderSeat = state.players[state.lastDiscardPlayer].id;
    const humanSeat = humanPlayer.id;

    const canChiResult = canChi(humanPlayer, state.lastDiscard, discarderSeat, humanSeat);
    const chiOptions = canChiResult ? getChiOptions(humanPlayer, state.lastDiscard) : [];

    const canPengResult = canPeng(humanPlayer, state.lastDiscard);
    const pengOption = canPengResult ? getPengOption(humanPlayer, state.lastDiscard) : null;

    return {
      canChi: canChiResult,
      canPeng: canPengResult,
      chiOptions,
      pengOption,
    };
  }, [state.phase, state.lastDiscard, state.lastDiscardPlayer, humanPlayer, humanIndex]);

  // ========== CALLBACKS ==========
  const handleTileClick = useCallback((tile: TileType) => {
    if (isHumanDiscardPhase) {
      selectTile(tile.id);
    }
  }, [isHumanDiscardPhase, selectTile]);

  const handleTileDoubleClick = useCallback((tile: TileType) => {
    if (isHumanDiscardPhase) {
      discardTile(tile.id);
    }
  }, [isHumanDiscardPhase, discardTile]);

  const handleDrawClick = useCallback(() => {
    if (isHumanDrawPhase) {
      drawTile();
    }
  }, [isHumanDrawPhase, drawTile]);

  const handleDiscardClick = useCallback(() => {
    if (selectedTileId && isHumanDiscardPhase) {
      discardTile(selectedTileId);
    }
  }, [selectedTileId, isHumanDiscardPhase, discardTile]);

  const handlePass = useCallback(() => {
    passAction();
  }, [passAction]);

  const handleStartGame = useCallback(() => {
    startNewGame();
  }, [startNewGame]);

  // ========== RENDER ==========

  // Show start screen
  if (state.phase === GamePhase.INIT) {
    return (
      <div className="min-h-screen bg-green-800 flex flex-col items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-4">🀄 台灣16張麻將</h1>
          <p className="text-green-200 mb-8">單機版 · 練牌好幫手</p>

          <button
            onClick={() => setShowSettings(true)}
            className="mb-6 px-6 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white"
          >
            ⚙️ 遊戲設定
          </button>

          <button
            onClick={handleStartGame}
            className="block w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-4 px-12 rounded-xl text-2xl shadow-lg transition-all hover:scale-105"
          >
            開始遊戲
          </button>
        </div>

        {showSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-96 max-w-full mx-4">
              <h2 className="text-xl font-bold mb-4">⚙️ 遊戲設定</h2>
              <GameSettings
                difficulty={difficulty}
                onDifficultyChange={setDifficulty}
                aiMode={aiMode}
                onAIModeChange={setAIMode}
                llmConfig={llmConfig}
                onLLMConfigChange={setLLMConfig}
              />
              <button
                onClick={() => setShowSettings(false)}
                className="mt-4 w-full py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
              >
                關閉
              </button>
            </div>
          </div>
        )}
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

  // ========== GAME SCREEN ==========
  const getTurnText = () => {
    if (isAITurn) return '🤖 AI 思考中...';
    if (isHumanDrawPhase) return '🎯 輪到你了 — 點擊摸牌';
    if (isHumanDiscardPhase) return '👤 輪到你了 — 請出牌';
    return '⏳ 等待中...';
  };

  return (
    <div className="min-h-screen bg-green-700 flex flex-col">
      {/* Header */}
      <div className="bg-green-900 p-3 flex justify-between items-center text-white text-sm">
        <span className="font-bold">🀄 台灣16張麻將</span>
        <div className="flex gap-4 items-center">
          <span>牌牆：{remainingTiles} 張</span>
          <span>難度：{difficulty === 'easy' ? '簡單' : difficulty === 'normal' ? '普通' : '困難'}</span>
          <span>AI：{aiMode === 'llm' ? '🤖 LLM' : aiMode === 'hybrid' ? '🔀 混合' : '🧮 演算法'}</span>
          <button
            onClick={() => setShowSettings(true)}
            className="p-1 hover:bg-green-800 rounded"
          >
            ⚙️
          </button>
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
            <div className="flex gap-0.5 justify-center mt-1 flex-wrap">
              {state.players[2].discards.slice(-12).map((t) => (
                <Tile key={`n-${t.id}`} tile={t} size="sm" showLabel={false} />
              ))}
            </div>
          </div>
        </div>

        {/* Middle row */}
        <div className="flex-1 flex">
          {/* Left player (West) */}
          <div className="w-32 p-2 bg-green-800/50 flex flex-col items-center">
            <div className="text-white text-xs mb-1">西 {state.players[3].hand.length}張</div>
            <div className="flex flex-col gap-0.5">
              {state.players[3].hand.slice(0, 6).map((_, i) => (
                <div key={i} className="w-5 h-7 bg-blue-800 rounded-sm border border-blue-600" />
              ))}
            </div>
            <div className="flex gap-0.5 justify-center mt-1 flex-wrap max-w-full">
              {state.players[3].discards.slice(-8).map((t) => (
                <Tile key={`w-${t.id}`} tile={t} size="sm" showLabel={false} />
              ))}
            </div>
          </div>

          {/* Center */}
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className={`text-lg font-bold ${isHumanTurn ? 'text-yellow-400' : 'text-white'}`}>
              {getTurnText()}
            </div>

            {state.lastDiscard && (
              <div className="text-center">
                <div className="text-white text-xs mb-1">最後捨牌</div>
                <Tile tile={state.lastDiscard} size="lg" />
              </div>
            )}

            <div className="text-white text-center opacity-50">
              <div className="text-2xl">🀫</div>
              <div className="text-xs">{remainingTiles} 張</div>
            </div>
          </div>

          {/* Right player (East) */}
          <div className="w-32 p-2 bg-green-800/50 flex flex-col items-center">
            <div className="text-white text-xs mb-1">東 {state.players[1].hand.length}張</div>
            <div className="flex flex-col gap-0.5">
              {state.players[1].hand.slice(0, 6).map((_, i) => (
                <div key={i} className="w-5 h-7 bg-blue-800 rounded-sm border border-blue-600" />
              ))}
            </div>
            <div className="flex gap-0.5 justify-center mt-1 flex-wrap max-w-full">
              {state.players[1].discards.slice(-8).map((t) => (
                <Tile key={`e-${t.id}`} tile={t} size="sm" showLabel={false} />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom player (Human) */}
        <div className="p-4 bg-green-900/50">
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
                    highlighted={lastDrawnTileId === tile.id}
                    onClick={() => handleTileClick(tile)}
                    onDoubleClick={() => handleTileDoubleClick(tile)}
                    showLabel={false}
                  />
                ))}
            </div>

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
                disabled={isAITurn}
                className="px-6 py-2 rounded-lg font-bold text-black bg-yellow-500 hover:bg-yellow-600 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                摸牌
              </button>
            ) : (
              <>
                {(canChiPeng.canPeng || canChiPeng.canChi) && (
                  <>
                    {canChiPeng.canPeng && (
                      <button
                        className="px-6 py-2 rounded-lg font-bold text-white bg-blue-500 hover:bg-blue-600 cursor-pointer"
                      >
                        碰
                      </button>
                    )}
                    {canChiPeng.canChi && (
                      <button
                        className="px-6 py-2 rounded-lg font-bold text-white bg-orange-500 hover:bg-orange-600 cursor-pointer"
                      >
                        吃
                      </button>
                    )}
                  </>
                )}
                <button
                  onClick={handleDiscardClick}
                  disabled={!selectedTileId || !isHumanDiscardPhase || isAITurn}
                  className={`
                    px-6 py-2 rounded-lg font-bold text-white
                    transition-all
                    ${selectedTileId && isHumanDiscardPhase && !isAITurn
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-black cursor-pointer'
                      : 'bg-gray-500 cursor-not-allowed opacity-50'
                    }
                  `}
                >
                  打出所選麻將
                </button>

                <button
                  onClick={handlePass}
                  disabled={!isHumanDiscardPhase || isAITurn}
                  className="px-6 py-2 rounded-lg font-bold text-white bg-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  過
                </button>
              </>
            )}
          </div>

          <div className="mt-4">
            <div className="text-white text-xs mb-1">你的捨牌</div>
            <DiscardPile tiles={humanPlayer.discards} />
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96 max-w-full mx-4">
            <h2 className="text-xl font-bold mb-4">⚙️ 遊戲設定</h2>
            <GameSettings
              difficulty={difficulty}
              onDifficultyChange={setDifficulty}
              aiMode={aiMode}
              onAIModeChange={setAIMode}
              llmConfig={llmConfig}
              onLLMConfigChange={setLLMConfig}
            />
            <button
              onClick={() => setShowSettings(false)}
              className="mt-4 w-full py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

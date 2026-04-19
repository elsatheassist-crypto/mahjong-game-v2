import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useGameStore } from './stores/gameStore';
import { GamePhase } from './core/game';
import Tile, { TileSize, getResponsiveTileSize, getDiscardTileSize } from './components/Tile';
import MeldArea from './components/MeldArea';
import DiscardPile from './components/DiscardPile';
import FlowerArea from './components/FlowerArea';
import GameSettings from './components/GameSettings';
import { Tile as TileType, TILE_DISPLAY, Suit } from './core/tile';
import { canChi, canPeng, canGang, getChiOptions, getPengOption, getGangOption } from './core/meld';
import { canWinByClaimingDiscard, checkWin } from './core/win';

interface MeldAndFlowerAreaProps {
  melds: React.ComponentProps<typeof MeldArea>['melds'];
  flowers: TileType[];
  flowerSize: TileSize;
  isHuman?: boolean;
  compact?: boolean;
  forceReveal?: boolean;
  className?: string;
}

const MeldAndFlowerArea: React.FC<MeldAndFlowerAreaProps> = ({
  melds,
  flowers,
  flowerSize,
  isHuman = false,
  compact = false,
  forceReveal = false,
  className = '',
}) => {
  if (melds.length === 0 && flowers.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-start justify-center gap-2 flex-wrap ${className}`}>
      {melds.length > 0 && (
        <MeldArea melds={melds} isHuman={isHuman} compact={compact} forceReveal={forceReveal} />
      )}
      <FlowerArea tiles={flowers} size={flowerSize} compact={compact} />
    </div>
  );
};

function App() {
  const {
    state,
    difficulty,
    aiMode,
    llmConfig,
    hybridConfig,
    tileSize,
    startNewGame,
    drawTile,
    selectTile,
    discardTile,
    passAction,
    chiAction,
    chiActionWithOption,
    pengAction,
    gangAction,
    winAction,
    confirmReveal,
    setDifficulty,
    setAIMode,
    setLLMConfig,
    setHybridConfig,
    setTileSize,
  } = useGameStore();

  const selectedTileId = useGameStore((s) => s.selectedTileId);
  const lastDrawnTileId = useGameStore((s) => s.lastDrawnTileId);
  const isAITurn = useGameStore((s) => s.isAITurn);
  const chiOptionSelect = useGameStore((s) => s.chiOptionSelect);

  const effectiveTileSize = tileSize === 'auto' ? getResponsiveTileSize() : tileSize;
  const discardTileSize = getDiscardTileSize(effectiveTileSize);

  const [showSettings, setShowSettings] = useState(false);

  // Pre-compute values that are always needed (no hooks here)
  const humanIndex = 0;
  const humanPlayer = state.players[humanIndex];
  const isHumanTurn = state.currentPlayer === humanIndex;
  const isHumanDrawPhase = isHumanTurn && state.turnAction === 'draw';
  const isHumanDiscardPhase = isHumanTurn && state.turnAction === 'discard';
  const isHumanWaitingPhase = isHumanTurn && state.turnAction === 'waiting';
  const remainingTiles = state.wall.tiles.length - state.wall.position;

  const SEAT_ID_TO_LABEL: Record<string, string> = {
    east: '東家',
    south: '南家',
    west: '西家',
    north: '北家',
  };

  // Compute canChi, canPeng, canWin when there's a discard to consider
  const canChiPeng = useMemo(() => {
    if (state.phase !== GamePhase.PLAYING) {
      return { canChi: false, canPeng: false, canWin: false, chiOptions: [], pengOption: null };
    }
    if (!state.lastDiscard || state.lastDiscardPlayer === null || state.lastDiscardPlayer === humanIndex) {
      return { canChi: false, canPeng: false, canWin: false, chiOptions: [], pengOption: null };
    }

    const discarderSeat = state.players[state.lastDiscardPlayer].id;
    const humanSeat = humanPlayer.id;

    const canChiResult = canChi(humanPlayer, state.lastDiscard, discarderSeat, humanSeat);
    const chiOptions = canChiResult ? getChiOptions(humanPlayer, state.lastDiscard) : [];

    const canPengResult = canPeng(humanPlayer, state.lastDiscard);
    const pengOption = canPengResult ? getPengOption(humanPlayer, state.lastDiscard) : null;

    const canGangResult = canGang(humanPlayer, state.lastDiscard);
    const gangOption = canGangResult ? getGangOption(humanPlayer, state.lastDiscard) : null;

    const canWinResult = canWinByClaimingDiscard(humanPlayer.hand, humanPlayer.melds, state.lastDiscard);

    return {
      canChi: canChiResult,
      canPeng: canPengResult,
      canGang: canGangResult,
      canWin: canWinResult,
      chiOptions,
      pengOption,
      gangOption,
    };
  }, [state.phase, state.lastDiscard, state.lastDiscardPlayer, humanPlayer, humanIndex]);

  // Check if human can win by self-draw (after drawing a tile)
  const canZimo = useMemo(() => {
    if (state.phase !== GamePhase.PLAYING) return false;
    if (!isHumanDiscardPhase) return false;

    const meldTiles = humanPlayer.melds.reduce((sum, m) => sum + m.tiles.length, 0);
    const totalTiles = humanPlayer.hand.length + meldTiles;

    if (totalTiles === 17) {
      return checkWin(humanPlayer.hand, humanPlayer.melds).isWin;
    }
    if (totalTiles === 18) {
      for (const tile of humanPlayer.hand) {
        const testHand = humanPlayer.hand.filter(t => t.id !== tile.id);
        if (checkWin(testHand, humanPlayer.melds).isWin) return true;
      }
    }
    return false;
  }, [state.phase, isHumanDiscardPhase, humanPlayer.hand, humanPlayer.melds]);

  // Auto-pass when human cannot act on discard
  useEffect(() => {
    if (!isHumanWaitingPhase) return;
    if (!state.lastDiscard) return;
    if (canChiPeng.canWin || canChiPeng.canPeng || canChiPeng.canGang || canChiPeng.canChi) return;
    const timer = setTimeout(() => passAction(), 500);
    return () => clearTimeout(timer);
  }, [isHumanWaitingPhase, state.lastDiscard, canChiPeng.canWin, canChiPeng.canPeng, canChiPeng.canGang, canChiPeng.canChi, passAction]);

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

  const handleChi = useCallback(() => {
    chiAction();
  }, [chiAction]);

  const handlePeng = useCallback(() => {
    pengAction();
  }, [pengAction]);

  const handleGang = useCallback(() => {
    gangAction();
  }, [gangAction]);

  const handleHu = useCallback(() => {
    winAction();
  }, [winAction]);

  const handleZimo = useCallback(() => {
    winAction();
  }, [winAction]);

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
                hybridConfig={hybridConfig}
                onHybridConfigChange={setHybridConfig}
                tileSize={tileSize}
                onTileSizeChange={setTileSize}
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
  // Show reveal screen
  if (state.phase === GamePhase.REVEAL) {
    const winner = state.winner !== null ? state.players[state.winner] : null;
    const isHumanWinner = state.winner === humanIndex;

    return (
      <div className="min-h-screen bg-green-700 flex flex-col">
        {/* Header */}
        <div className="bg-green-900 p-3 flex justify-between items-center text-white text-sm">
          <span className="font-bold">🀄 台灣16張麻將</span>
          <div className="flex gap-4 items-center">
            <span>牌牆：{remainingTiles} 張</span>
            <span>難度：{difficulty === 'easy' ? '簡單' : difficulty === 'normal' ? '普通' : '困難'}</span>
            <span>AI：{aiMode === 'llm' ? '🤖 LLM' : aiMode === 'hybrid' ? '🔀 混合' : '🧮 演算法'}</span>
          </div>
        </div>

        {/* Game Area */}
        <div className="flex-1 flex flex-col">
          {/* Top player (North) */}
          <div className="flex justify-center p-2 bg-green-800/50">
            <div className="text-center">
              <div className="text-white text-xs mb-1">
                北 {state.players[2].hand.length}張
              </div>
              <div className="flex gap-0.5 justify-center flex-wrap">
                {state.players[2].hand.map((tile) => (
                  <Tile key={tile.id} tile={tile} size={effectiveTileSize} showLabel={false} />
                ))}
              </div>
              <MeldAndFlowerArea
                melds={state.players[2].melds}
                flowers={state.players[2].flowers}
                flowerSize="sm"
                compact={true}
                forceReveal={true}
                className="mt-1"
              />
            </div>
          </div>

          {/* Middle row */}
          <div className="flex-1 flex">
            {/* Left player (West) */}
            <div className="w-32 p-2 bg-green-800/50 flex flex-col items-center">
              <div className="text-white text-xs mb-1">
                西 {state.players[3].hand.length}張
              </div>
              <div className="flex flex-col gap-0.5">
                {state.players[3].hand.map((tile) => (
                  <Tile key={tile.id} tile={tile} size={effectiveTileSize} showLabel={false} />
                ))}
              </div>
              <MeldAndFlowerArea
                melds={state.players[3].melds}
                flowers={state.players[3].flowers}
                flowerSize="sm"
                compact={true}
                forceReveal={true}
                className="mt-1"
              />
            </div>

            {/* Center */}
            <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
              <div className="text-2xl font-bold text-yellow-400">
                {winner ? '🀄 胡牌！' : '🀄 流局'}
              </div>
              {winner && (
                <div className="text-white text-lg">
                  {isHumanWinner ? '🏆 恭喜，你贏了！' : `💀 ${SEAT_ID_TO_LABEL[winner.id] || winner.id} 胡牌`}
                </div>
              )}

              <div className="mt-4 p-3 bg-green-900/30 rounded-lg w-full max-w-2xl min-h-[100px]">
                <div className="flex flex-wrap gap-1 justify-start content-start">
                {state.discardSequence.map((tile) => (
                  <Tile key={tile.id} tile={tile} size={discardTileSize} showLabel={false} />
                ))}
                </div>
                {state.discardSequence.length === 0 && (
                  <div className="text-white/30 text-xs text-center py-4">尚無捨牌</div>
                )}
              </div>

              <button
                onClick={confirmReveal}
                className="mt-4 px-6 py-2 rounded-lg font-bold text-black bg-yellow-500 hover:bg-yellow-600 transition-all cursor-pointer"
              >
                查看結算
              </button>
            </div>

            {/* Right player (East) */}
            <div className="w-32 p-2 bg-green-800/50 flex flex-col items-center">
              <div className="text-white text-xs mb-1">
                東 {state.players[1].hand.length}張
              </div>
              <div className="flex flex-col gap-0.5">
                {state.players[1].hand.map((tile) => (
                  <Tile key={tile.id} tile={tile} size={effectiveTileSize} showLabel={false} />
                ))}
              </div>
              <MeldAndFlowerArea
                melds={state.players[1].melds}
                flowers={state.players[1].flowers}
                flowerSize="sm"
                compact={true}
                forceReveal={true}
                className="mt-1"
              />
            </div>
          </div>

          {/* Bottom player (Human) */}
          <div className="p-4 bg-green-900/50">
            <MeldAndFlowerArea
              melds={humanPlayer.melds}
              flowers={humanPlayer.flowers}
              flowerSize="md"
              isHuman={true}
              forceReveal={true}
              className="mb-3"
            />
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
                      size={effectiveTileSize}
                      showLabel={false}
                    />
                  ))}
              </div>
            </div>
          </div>
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

          {state.winner !== null && state.winScoreBreakdown && (
            <div className="mt-6 bg-green-900 rounded-lg p-6">
              <h3 className="text-white mb-4 text-xl">🏆 台數明細</h3>
              <div className="flex flex-col gap-2 max-w-sm mx-auto">
                {state.winScoreBreakdown.details.map((detail, idx) => (
                  <div key={idx} className="flex justify-between items-center text-lg">
                    <span className="text-gray-300">{detail.name}</span>
                    <span className="text-yellow-300 font-bold">{detail.tai} 台</span>
                  </div>
                ))}
                <div className="flex justify-between items-center text-2xl mt-4 pt-2 border-t border-green-700">
                  <span className="text-white font-bold">總計</span>
                  <span className="text-yellow-400 font-extrabold">{state.winScoreBreakdown.total} 台</span>
                </div>
              </div>
            </div>
          )}

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
    if (isHumanDiscardPhase) {
      if (canZimo) return '🎉 恭喜！可以自摸！';
      return '👤 輪到你了 — 請出牌';
    }
    if (isHumanWaitingPhase) {
      if (canChiPeng.canWin) return '🎊 可以胡牌！';
      if (canChiPeng.canGang) return '👤 可以槓';
      if (canChiPeng.canPeng) return '👤 可以碰';
      if (canChiPeng.canChi) return '👤 可以吃';
    }
    return '⏳ 等待中...';
  };

  const SEAT_LABELS: Record<number, string> = {
    0: '東家',
    1: '南家',
    2: '西家',
    3: '北家',
  };

  const getTileLabel = (tile: TileType) => {
    if (tile.suit === Suit.FENG) {
      const fengLabels: Record<number, string> = { 1: '東', 2: '南', 3: '西', 4: '北' };
      return fengLabels[tile.value] || '';
    }
    if (tile.suit === Suit.JIAN) {
      const jianLabels: Record<number, string> = { 1: '中', 2: '發', 3: '白' };
      return jianLabels[tile.value] || '';
    }
    return TILE_DISPLAY[tile.suit as Suit]?.[tile.value] || '';
  };

  const getCurrentPlayerIndicator = (playerIndex: number) => {
    if (state.phase !== GamePhase.PLAYING) return null;
    if (state.currentPlayer !== playerIndex) return null;
    if (state.turnAction === 'waiting' && playerIndex === 0) return null;
    if (state.turnAction === 'waiting') return null;
    if (state.turnAction === 'draw') return '🔵';
    if (state.turnAction === 'discard') return '🔴';
    return null;
  };

  const getLastActionText = () => {
    const meld = state.lastMeldAction;
    if (!meld) {
      if (state.lastDiscard && state.lastDiscardPlayer !== null) {
        return `${SEAT_LABELS[state.lastDiscardPlayer]}打出${getTileLabel(state.lastDiscard)}`;
      }
      return null;
    }
    const playerLabel = SEAT_LABELS[meld.player];
    const actionLabel = meld.type === 'chi' ? '吃' : meld.type === 'peng' ? '碰' : meld.type === 'gang' ? '槓' : '胡';
    if (meld.discardedTile) {
      return `${playerLabel}${actionLabel}${getTileLabel(meld.tile)}，打出${getTileLabel(meld.discardedTile)}`;
    }
    return `${playerLabel}${actionLabel}${getTileLabel(meld.tile)}`;
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
            <div className="text-white text-xs mb-1">
              {getCurrentPlayerIndicator(2) && <span className="mr-1">{getCurrentPlayerIndicator(2)}</span>}
              北 {state.players[2].hand.length}張
            </div>
            <div className="flex gap-0.5 justify-center">
              {state.players[2].hand.slice(0, 9).map((_, i) => (
                <div key={i} className="w-5 h-6 bg-blue-800 rounded-sm border border-blue-600" />
              ))}
              {state.players[2].hand.length > 9 && (
                <span className="text-white text-xs ml-1">+{state.players[2].hand.length - 9}</span>
              )}
            </div>
            <MeldAndFlowerArea
              melds={state.players[2].melds}
              flowers={state.players[2].flowers}
              flowerSize="sm"
              compact={true}
              className="mt-1"
            />
          </div>
        </div>

        {/* Middle row */}
        <div className="flex-1 flex">
          {/* Left player (West) */}
          <div className="w-32 p-2 bg-green-800/50 flex flex-col items-center">
            <div className="text-white text-xs mb-1">
              {getCurrentPlayerIndicator(3) && <span className="mr-1">{getCurrentPlayerIndicator(3)}</span>}
              西 {state.players[3].hand.length}張
            </div>
            <div className="flex flex-col gap-0.5">
              {state.players[3].hand.slice(0, 6).map((_, i) => (
                <div key={i} className="w-5 h-7 bg-blue-800 rounded-sm border border-blue-600" />
              ))}
            </div>
            <MeldAndFlowerArea
              melds={state.players[3].melds}
              flowers={state.players[3].flowers}
              flowerSize="sm"
              compact={true}
              className="mt-1"
            />
          </div>

          {/* Center */}
          <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
            <div className={`text-lg font-bold ${isHumanTurn ? 'text-yellow-400' : 'text-white'}`}>
              {getTurnText()}
            </div>
            {getLastActionText() && (
              <div className="text-white/80 text-sm">{getLastActionText()}</div>
            )}

            <div className="mt-2 p-3 bg-green-900/30 rounded-lg w-full max-w-2xl min-h-[100px]">
              <div className="flex flex-wrap gap-1 justify-start content-start">
                {state.discardSequence.map((tile) => (
                  <Tile key={tile.id} tile={tile} size={discardTileSize} showLabel={false} />
                ))}
              </div>
              {state.discardSequence.length === 0 && (
                <div className="text-white/30 text-xs text-center py-4">尚無捨牌</div>
              )}
            </div>
          </div>

          {/* Right player (East) */}
          <div className="w-32 p-2 bg-green-800/50 flex flex-col items-center">
            <div className="text-white text-xs mb-1">
              {getCurrentPlayerIndicator(1) && <span className="mr-1">{getCurrentPlayerIndicator(1)}</span>}
              東 {state.players[1].hand.length}張
            </div>
            <div className="flex flex-col gap-0.5">
              {state.players[1].hand.slice(0, 6).map((_, i) => (
                <div key={i} className="w-5 h-7 bg-blue-800 rounded-sm border border-blue-600" />
              ))}
            </div>
            <MeldAndFlowerArea
              melds={state.players[1].melds}
              flowers={state.players[1].flowers}
              flowerSize="sm"
              compact={true}
              className="mt-1"
            />
          </div>
        </div>

        {/* Bottom player (Human) */}
        <div className="p-4 bg-green-900/50">
          <MeldAndFlowerArea
            melds={humanPlayer.melds}
            flowers={humanPlayer.flowers}
            flowerSize="md"
            isHuman={true}
            className="mb-3"
          />
          <div className="text-center mb-4">
            <div className="text-white text-sm mb-2">
              {getCurrentPlayerIndicator(0) && <span className="mr-1">{getCurrentPlayerIndicator(0)}</span>}
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
                    size={effectiveTileSize}
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

          {chiOptionSelect.length > 0 && (
            <div className="flex flex-col items-center gap-2 mb-3">
              <div className="text-white text-sm">請選擇吃法：</div>
              <div className="flex gap-2">
                {chiOptionSelect.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => chiActionWithOption(option)}
                    className="px-4 py-2 rounded-lg font-bold text-white bg-orange-500 hover:bg-orange-600 cursor-pointer flex items-center gap-1"
                  >
                    吃
                    {option.meld.tiles.map(t => (
                      <span key={t.id} className="text-lg">{getTileLabel(t)}</span>
                    ))}
                  </button>
                ))}
              </div>
            </div>
          )}

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
            ) : state.turnAction === 'waiting' && state.lastDiscard ? (
              <>
                {canChiPeng.canWin && (
                  <button
                    onClick={handleHu}
                    className="px-6 py-2 rounded-lg font-bold text-white bg-green-500 hover:bg-green-600 cursor-pointer"
                  >
                    胡牌
                  </button>
                )}
                {canChiPeng.canGang && (
                  <button
                    onClick={handleGang}
                    className="px-6 py-2 rounded-lg font-bold text-white bg-purple-500 hover:bg-purple-600 cursor-pointer"
                  >
                    槓
                  </button>
                )}
                {canChiPeng.canPeng && (
                  <button
                    onClick={handlePeng}
                    className="px-6 py-2 rounded-lg font-bold text-white bg-blue-500 hover:bg-blue-600 cursor-pointer"
                  >
                    碰
                  </button>
                )}
                {canChiPeng.canChi && (
                  <button
                    onClick={handleChi}
                    className="px-6 py-2 rounded-lg font-bold text-white bg-orange-500 hover:bg-orange-600 cursor-pointer"
                  >
                    吃
                  </button>
                )}
                {(canChiPeng.canWin || canChiPeng.canGang || canChiPeng.canPeng || canChiPeng.canChi) && (
                  <button
                    onClick={handlePass}
                    disabled={isAITurn}
                    className="px-6 py-2 rounded-lg font-bold text-white bg-gray-600 hover:bg-gray-700 disabled:opacity50 disabled:cursor-not-allowed"
                  >
                    過
                  </button>
                )}
              </>
            ) : isHumanDiscardPhase && canZimo ? (
              <>
                <button
                  onClick={handleZimo}
                  className="px-6 py-2 rounded-lg font-bold text-white bg-green-500 hover:bg-green-600 cursor-pointer"
                >
                  自摸胡
                </button>
                <button
                  onClick={handlePass}
                  disabled={isAITurn}
                  className="px-6 py-2 rounded-lg font-bold text-white bg-gray-600 hover:bg-gray-700 disabled:opacity50 disabled:cursor-not-allowed"
                >
                  過
                </button>
              </>
            ) : (
              <div className="text-white/50 text-sm">等待中...</div>
            )}
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
              hybridConfig={hybridConfig}
              onHybridConfigChange={setHybridConfig}
              tileSize={tileSize}
              onTileSizeChange={setTileSize}
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

import React, { useState } from 'react';
import { Tile as TileType } from '../core/tile';
import { Player } from '../core/player';
import Hand from './Hand';
import DiscardPile from './DiscardPile';
import ActionBar, { ActionType } from './ActionBar';
import GameSettings, { AIDifficulty, AIMode } from './GameSettings';

interface PlayerInfo {
  player: Player;
  position: 'top' | 'right' | 'bottom' | 'left';
}

interface BoardProps {
  players: PlayerInfo[];
  currentPlayerIndex: number;
  lastDiscardTile?: TileType | null;
  availableActions: { type: ActionType; label: string; enabled: boolean }[];
  onPlayerAction: (playerIndex: number, action: ActionType, tile?: TileType) => void;
  onTileSelect: (playerIndex: number, tile: TileType) => void;
  selectedTileId?: string | null;
  remainingTiles: number;
}

const positionClasses = {
  top: 'justify-center',
  right: 'justify-end',
  bottom: 'justify-center',
  left: 'justify-start',
};

const positionLabels = {
  east: '東',
  south: '南',
  west: '西',
  north: '北',
};

const Board: React.FC<BoardProps> = ({
  players,
  currentPlayerIndex,
  lastDiscardTile,
  availableActions,
  onPlayerAction,
  onTileSelect,
  selectedTileId,
  remainingTiles,
}) => {
  const [difficulty, setDifficulty] = useState<AIDifficulty>('normal');
  const [aiMode, setAIMode] = useState<AIMode>('algorithm');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Find human player
  const humanPlayer = players.find((p) => p.player.isHuman);
  const humanIndex = players.findIndex((p) => p.player.isHuman);

  // Reorder players so human is always at bottom
  const orderedPlayers = React.useMemo(() => {
    if (humanIndex === -1) return players;
    const reordered = [...players];
    const human = reordered.splice(humanIndex, 1)[0];
    // Rotate so human is at bottom
    const rotations = 3; // Keep rotation fixed for now
    for (let i = 0; i < rotations; i++) {
      const first = reordered.shift()!;
      reordered.push(first);
    }
    return reordered;
  }, [players, humanIndex]);

  const handleAction = (action: ActionType) => {
    if (humanIndex !== -1) {
      onPlayerAction(humanIndex, action);
    }
  };

  return (
    <div className="relative w-full h-full min-h-screen bg-green-700 p-4">
      {/* Settings */}
      <div className="absolute top-4 right-4 z-10">
        <GameSettings
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          aiMode={aiMode}
          onAIModeChange={setAIMode}
          soundEnabled={soundEnabled}
          onSoundChange={setSoundEnabled}
        />
      </div>

      {/* Info Bar */}
      <div className="absolute top-4 left-4 flex gap-4 text-white text-sm">
        <div className="bg-black/30 px-3 py-1 rounded">
          牌牆剩餘: {remainingTiles}
        </div>
      </div>

      {/* Game Board Layout */}
      <div className="flex flex-col h-full gap-2">
        {/* Top Player (North) */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-1">
            <span className="text-white text-xs">
              {positionLabels[orderedPlayers[0].player.id]}
            </span>
            <Hand
              tiles={orderedPlayers[0].player.hand}
              isHuman={false}
              faceDown={true}
              maxVisible={17}
            />
            <DiscardPile tiles={orderedPlayers[0].player.discards} />
          </div>
        </div>

        {/* Middle Row (West, Center, East) */}
        <div className="flex justify-between items-center flex-1">
          {/* Left Player (West) */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-white text-xs">
              {positionLabels[orderedPlayers[3].player.id]}
            </span>
            <Hand
              tiles={orderedPlayers[3].player.hand}
              isHuman={false}
              faceDown={true}
              maxVisible={9}
            />
            <DiscardPile tiles={orderedPlayers[3].player.discards} />
          </div>

          {/* Center Area */}
          <div className="flex flex-col items-center gap-4">
            {/* Wall indicator */}
            <div className="text-white text-center">
              <div className="text-2xl">🀫</div>
              <div className="text-xs">牌牆</div>
            </div>

            {/* Last Discard */}
            {lastDiscardTile && (
              <div className="text-white text-center">
                <div className="text-xs mb-1">最後捨牌</div>
              </div>
            )}

            {/* Current Turn Indicator */}
            <div className="text-yellow-300 text-sm">
              {orderedPlayers[1]?.player.id === 'south' ? '👤 輪到你了' : 'AI 思考中...'}
            </div>
          </div>

          {/* Right Player (East) */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-white text-xs">
              {positionLabels[orderedPlayers[1].player.id]}
            </span>
            <Hand
              tiles={orderedPlayers[1].player.hand}
              isHuman={false}
              faceDown={true}
              maxVisible={9}
            />
            <DiscardPile tiles={orderedPlayers[1].player.discards} />
          </div>
        </div>

        {/* Bottom Player (South - Human) */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-white text-xs font-bold">
            👤 你（{humanPlayer ? positionLabels[humanPlayer.player.id] : ''}）
          </span>

          {/* Human's Hand */}
          {humanPlayer && (
            <>
              <Hand
                tiles={humanPlayer.player.hand}
                selectedTileId={selectedTileId}
                onTileClick={(tile) => humanIndex !== -1 && onTileSelect(humanIndex, tile)}
                onTileDoubleClick={(tile) => {
                  if (humanIndex !== -1) {
                    onPlayerAction(humanIndex, 'discard', tile);
                  }
                }}
                isHuman={true}
              />

              {/* Action Bar */}
              <ActionBar
                availableActions={availableActions}
                onAction={handleAction}
                countdownSeconds={10}
              />
            </>
          )}

          {/* Human's Discard Pile */}
          {humanPlayer && <DiscardPile tiles={humanPlayer.player.discards} isHuman={true} />}
        </div>
      </div>
    </div>
  );
};

export default Board;

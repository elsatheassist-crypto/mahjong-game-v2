import React, { useState, useRef } from 'react';
import { Tile as TileType, compareTiles } from '../core/tile';
import Tile, { TileSize } from './Tile';

interface HandProps {
  tiles: TileType[];
  selectedTileId?: string | null;
  onTileClick?: (tile: TileType) => void;
  onTileDoubleClick?: (tile: TileType) => void;
  onTileDrag?: (tile: TileType) => void;
  isHuman?: boolean;
  faceDown?: boolean;
  maxVisible?: number;
  onDragStart?: (tile: TileType, e: React.MouseEvent) => void;
  size?: TileSize;
}

const Hand: React.FC<HandProps> = ({
  tiles,
  selectedTileId,
  onTileClick,
  onTileDoubleClick,
  onTileDrag,
  isHuman = false,
  faceDown = false,
  maxVisible,
  onDragStart,
  size = 'md',
}) => {
  const [dragState, setDragState] = useState<{
    tile: TileType | null;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isDragging: boolean;
  }>({
    tile: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    isDragging: false,
  });

  const [draggedTileId, setDraggedTileId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sort tiles for display
  const sortedTiles = [...tiles].sort(compareTiles);
  const visibleTiles = maxVisible ? sortedTiles.slice(0, maxVisible) : sortedTiles;

  const handleMouseDown = (tile: TileType, e: React.MouseEvent) => {
    if (!isHuman) return;
    e.preventDefault();
    setDragState({
      tile,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      isDragging: false,
    });
    setDraggedTileId(tile.id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.tile) return;

    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;

    // Start dragging after 5px movement
    if (!dragState.isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      setDragState((prev) => ({ ...prev, isDragging: true }));
    }

    if (dragState.isDragging) {
      setDragState((prev) => ({
        ...prev,
        currentX: e.clientX,
        currentY: e.clientY,
      }));
      onDragStart?.(dragState.tile, e);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (dragState.isDragging && dragState.tile) {
      // Drag completed - simulate discard
      onTileDoubleClick?.(dragState.tile);
    } else if (dragState.tile) {
      // Just a click
      onTileClick?.(dragState.tile);
    }

    setDragState({
      tile: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      isDragging: false,
    });
    setDraggedTileId(null);
  };

  const handleMouseLeave = () => {
    if (dragState.isDragging && dragState.tile) {
      // If dragging out of hand area, trigger discard
      onTileDoubleClick?.(dragState.tile);
    }
    setDragState({
      tile: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      isDragging: false,
    });
    setDraggedTileId(null);
  };

  if (!isHuman) {
    // Non-human players: show face-down tiles (count only)
    return (
      <div className="flex items-center gap-1">
        <span className="text-sm text-gray-400 mr-2">
          {faceDown ? '???' : `${tiles.length}張`}
        </span>
        {faceDown && (
          <div className="flex gap-0.5">
            {Array.from({ length: Math.min(tiles.length, 17) }).map((_, i) => (
              <div
                key={i}
                className="w-4 h-6 bg-gradient-to-br from-blue-800 to-blue-900 rounded border border-blue-600"
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Calculate drag offset for the currently dragged tile
  const getDragOffset = (tileId: string) => {
    if (draggedTileId === tileId && dragState.isDragging) {
      return {
        transform: `translate(${dragState.currentX - dragState.startX}px, ${dragState.currentY - dragState.startY}px)`,
        opacity: 0.8,
        zIndex: 1000,
      };
    }
    return {};
  };

  // Human player: show actual tiles with drag support
  return (
    <div
      ref={containerRef}
      className="flex flex-wrap gap-1 justify-center max-w-full select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {visibleTiles.map((tile) => (
        <div
          key={tile.id}
          style={{
            ...getDragOffset(tile.id),
            transition: dragState.isDragging ? 'none' : 'all 0.15s',
          }}
          className={`
            ${selectedTileId === tile.id && !dragState.isDragging ? '-translate-y-2' : ''}
            ${draggedTileId === tile.id ? 'cursor-grabbing' : 'cursor-grab'}
          `}
          onMouseDown={(e) => handleMouseDown(tile, e)}
        >
          <Tile
            tile={tile}
            size={size}
            selected={selectedTileId === tile.id && !dragState.isDragging}
            onClick={() => {}}
          />
        </div>
      ))}

      {/* Drag instruction hint */}
      {isHuman && tiles.length > 0 && (
        <div className="w-full text-center text-xs text-white/50 mt-1">
          點擊選牌 · 拖曳出牌 · 雙擊直接出牌
        </div>
      )}
    </div>
  );
};

export default Hand;

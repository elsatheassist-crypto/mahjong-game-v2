import React from 'react';
import { Tile as TileType, compareTiles } from '../core/tile';
import Tile from './Tile';

interface DiscardPileProps {
  tiles: TileType[];
  isHuman?: boolean;
}

const TILES_PER_ROW = 16;

const DiscardPile: React.FC<DiscardPileProps> = ({ tiles, isHuman = false }) => {
  const sortedTiles = [...tiles].sort(compareTiles);

  if (tiles.length === 0) {
    return (
      <div className="min-h-[60px] flex items-center justify-center text-gray-500 text-sm border border-dashed border-gray-300 rounded">
        尚無捨牌
      </div>
    );
  }

  // Group tiles into rows of 16
  const rows: TileType[][] = [];
  for (let i = 0; i < sortedTiles.length; i += TILES_PER_ROW) {
    rows.push(sortedTiles.slice(i, i + TILES_PER_ROW));
  }

  return (
    <div className="space-y-1">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-0.5 flex-wrap">
          {row.map((tile) => (
            <Tile
              key={tile.id}
              tile={tile}
              size="sm"
              selected={false}
            />
          ))}
        </div>
      ))}
      {!isHuman && (
        <div className="text-xs text-gray-400 mt-1">
          {tiles.length} 張
        </div>
      )}
    </div>
  );
};

export default DiscardPile;

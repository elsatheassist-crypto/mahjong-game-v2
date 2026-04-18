import React from 'react';
import { Tile } from '../core/tile';
import TileComponent, { TileSize } from './Tile';

interface FlowerAreaProps {
  tiles: Tile[];
  size?: TileSize;
  compact?: boolean;
}

const FlowerArea: React.FC<FlowerAreaProps> = ({ tiles, size = 'md', compact = false }) => {
  if (tiles.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-col items-center border-2 rounded-lg border-yellow-400 bg-yellow-50 ${compact ? 'p-1' : 'p-2'}`}>
      <div className="flex gap-0.5">
        {tiles.map((tile) => (
          <TileComponent key={tile.id} tile={tile} size={size} showLabel={false} />
        ))}
      </div>
    </div>
  );
};

export default FlowerArea;

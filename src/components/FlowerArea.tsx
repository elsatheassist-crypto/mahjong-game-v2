import React from 'react';
import { Tile } from '../core/tile';
import TileComponent, { TileSize } from './Tile';

interface FlowerAreaProps {
  tiles: Tile[];
  size?: TileSize;
}

const FlowerArea: React.FC<FlowerAreaProps> = ({ tiles, size = 'md' }) => {
  if (tiles.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      <span className="text-xs text-yellow-300 mr-1">花牌:</span>
      {tiles.map((tile) => (
        <TileComponent key={tile.id} tile={tile} size={size} showLabel={false} />
      ))}
    </div>
  );
};

export default FlowerArea;
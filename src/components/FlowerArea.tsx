import React from 'react';
import { Tile } from '../core/tile';
import TileComponent, { TileSize } from './Tile';

interface FlowerAreaProps {
  tiles: Tile[];
  size?: TileSize;
}

const FlowerArea: React.FC<FlowerAreaProps> = ({ tiles, size = 'md' }) => {
  console.log('FlowerArea receiving tiles:', tiles);
  if (tiles.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 mt-1 p-2 border-2 border-yellow-500 bg-black/50">
      <span className="text-xs text-yellow-300 mr-1">花牌:</span>
      {tiles.map((tile) => (
        <TileComponent key={tile.id} tile={tile} size={size} showLabel={false} />
      ))}
    </div>
  );
};

export default FlowerArea;
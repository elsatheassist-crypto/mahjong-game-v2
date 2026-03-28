import React from 'react';
import { Meld, MeldType } from '../core/player';
import TileComponent from './Tile';

interface MeldAreaProps {
  melds: Meld[];
  isHuman?: boolean;
  compact?: boolean;
}

const MELD_COLORS: Record<MeldType, string> = {
  chi: 'border-orange-400 bg-orange-50',
  peng: 'border-blue-400 bg-blue-50',
  gang: 'border-purple-400 bg-purple-50',
  angang: 'border-gray-400 bg-gray-50',
};

function MeldArea({ melds, isHuman = false, compact = false }: MeldAreaProps) {
  if (melds.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? 'gap-1' : 'gap-2'}`}>
      {melds.map((meld, index) => (
        <div
          key={index}
          className={`
            flex flex-col items-center
            border-2 rounded-lg
            ${MELD_COLORS[meld.type]}
            ${compact ? 'p-1' : 'p-2'}
          `}
        >
          <div className="flex gap-0.5">
            {meld.type === 'chi' && meld.source !== 'self' ? (
              <>
                <TileComponent
                  key={`${meld.tiles[1].id}`}
                  tile={meld.tiles[1]}
                  size={compact ? 'sm' : 'md'}
                  showLabel={!compact}
                />
                <TileComponent
                  key={`${meld.tiles[0].id}`}
                  tile={meld.tiles[0]}
                  size={compact ? 'sm' : 'md'}
                  showLabel={!compact}
                />
                <TileComponent
                  key={`${meld.tiles[2].id}`}
                  tile={meld.tiles[2]}
                  size={compact ? 'sm' : 'md'}
                  showLabel={!compact}
                />
              </>
            ) : (
              meld.tiles.map((tile, tileIndex) => (
                <TileComponent
                  key={`${tile.id}-${tileIndex}`}
                  tile={tile}
                  size={compact ? 'sm' : 'md'}
                  faceDown={meld.type === 'angang' && meld.source === 'self' && !isHuman}
                  showLabel={!compact}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default MeldArea;

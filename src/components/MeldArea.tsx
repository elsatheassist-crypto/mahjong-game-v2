import React from 'react';
import { Meld, MeldType } from '../core/player';
import { Tile } from '../core/tile';
import TileComponent from './Tile';

interface MeldAreaProps {
  melds: Meld[];
  isHuman?: boolean;
  compact?: boolean;
  /** Override faceDown for angang melds when game has ended (for reveal/game-over). */
  forceReveal?: boolean;
}

const MELD_COLORS: Record<MeldType, string> = {
  chi: 'border-orange-400 bg-orange-50',
  peng: 'border-blue-400 bg-blue-50',
  gang: 'border-purple-400 bg-purple-50',
  angang: 'border-gray-400 bg-gray-50',
};

function getChiDisplayTiles(meld: Meld): Tile[] {
  if (meld.type !== 'chi' || meld.source === 'self') {
    return meld.tiles;
  }
  const claimed = meld.source;
  const handTiles = meld.tiles.filter(t => t.id !== claimed.id);
  return [handTiles[0], claimed, handTiles[1]];
}

function MeldArea({ melds, isHuman = false, compact = false, forceReveal = false }: MeldAreaProps) {
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
            {getChiDisplayTiles(meld).map((tile, tileIndex) => (
              <TileComponent
                key={`${tile.id}-${tileIndex}`}
                tile={tile}
                size={compact ? 'sm' : 'md'}
                faceDown={meld.type === 'angang' && meld.source === 'self' && !isHuman && !forceReveal}
                showLabel={false}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default MeldArea;

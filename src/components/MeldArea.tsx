import React from 'react';
import { Meld, MeldType } from '../core/player';
import TileComponent from './Tile';

interface MeldAreaProps {
  melds: Meld[];
  isHuman?: boolean;
  compact?: boolean;
}

const MELD_LABELS: Record<MeldType, string> = {
  chi: '吃',
  peng: '碰',
  gang: '槓',
  angang: '暗槓',
};

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
          <span className={`
            text-xs font-medium mb-1
            ${meld.type === 'chi' ? 'text-orange-600' : ''}
            ${meld.type === 'peng' ? 'text-blue-600' : ''}
            ${meld.type === 'gang' ? 'text-purple-600' : ''}
            ${meld.type === 'angang' ? 'text-gray-600' : ''}
          `}>
            {MELD_LABELS[meld.type]}
          </span>

          <div className="flex gap-0.5">
            {meld.tiles.map((tile, tileIndex) => (
              <TileComponent
                key={`${tile.id}-${tileIndex}`}
                tile={tile}
                size={compact ? 'sm' : 'md'}
                faceDown={meld.type === 'angang' && meld.source === 'self' && !isHuman}
                showLabel={!compact}
              />
            ))}
          </div>

          {meld.source !== 'self' && (
            <span className="text-[10px] text-gray-400 mt-1">
              {meld.type === 'chi' ? '←上家' : '←他家'}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default MeldArea;

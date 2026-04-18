import React from 'react';
import { Tile as TileType, getTileUnicode, getTileDisplay, Suit } from '../core/tile';

export type TileSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface TileProps {
  tile: TileType;
  size?: TileSize;
  selected?: boolean;
  highlighted?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  faceDown?: boolean;
  disabled?: boolean;
  showLabel?: boolean;
}

export const sizeClasses: Record<TileSize, string> = {
  xs: 'w-8 h-10 text-2xl',
  sm: 'w-9 h-11 text-3xl',
  md: 'w-11 h-14 text-4xl',
  lg: 'w-14 h-[4.5rem] text-5xl',
  xl: 'w-16 h-24 text-6xl',
};

export const labelSizeClasses: Record<TileSize, string> = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
};

export function getResponsiveTileSize(): TileSize {
  if (typeof window === 'undefined') return 'md';
  const width = window.innerWidth;
  const height = window.innerHeight;
  const minDimension = Math.min(width, height);

  if (minDimension < 375) return 'xs';
  if (minDimension < 400) return 'sm';
  if (minDimension < 768) return 'md';
  if (minDimension < 1024) return 'lg';
  return 'xl';
}

const sizeOrder: TileSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];

export function getDiscardTileSize(handSize: TileSize): TileSize {
  const index = sizeOrder.indexOf(handSize);
  const discardIndex = Math.max(0, index - 2);
  return sizeOrder[discardIndex];
}

function getTileColorClass(tile: TileType): string {
  switch (tile.suit) {
    case Suit.WAN:
      return 'text-red-600';
    case Suit.TIAO:
      return 'text-green-600';
    case Suit.TONG:
      return 'text-blue-600';
    case Suit.FENG:
      return 'text-gray-700';
    case Suit.FLOWER:
      return 'text-pink-600';
    case Suit.JIAN:
      switch (tile.value) {
        case 1: return 'text-red-600';
        case 2: return 'text-green-600';
        case 3: return 'text-gray-500';
        default: return 'text-gray-700';
      }
    default:
      return 'text-gray-800';
  }
}

function getTileBgAccent(tile: TileType): string {
  if (tile.suit === Suit.JIAN && tile.value === 1) {
    return 'bg-red-50';
  }
  return 'bg-white';
}

const TileComponent: React.FC<TileProps> = ({
  tile,
  size = 'md',
  selected = false,
  highlighted = false,
  onClick,
  onDoubleClick,
  faceDown = false,
  disabled = false,
  showLabel = true,
}) => {
  const colorClass = getTileColorClass(tile);
  const bgAccent = getTileBgAccent(tile);

  if (faceDown) {
    return (
      <div
        className={`
          ${sizeClasses[size]}
          rounded-md border-2 border-emerald-600
          bg-gradient-to-br from-emerald-700 to-emerald-900
          flex items-center justify-center
          shadow-md
        `}
      >
        <div className="w-3/4 h-3/4 rounded bg-emerald-600/50 border border-emerald-500/30" />
      </div>
    );
  }

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onDoubleClick={disabled ? undefined : onDoubleClick}
      disabled={disabled}
       className={`
          ${sizeClasses[size]}
          rounded-md border-2 
          relative p-0 box-border
          transition-all duration-150
          ${highlighted
            ? 'border-yellow-400 bg-yellow-200 shadow-lg shadow-yellow-400/50 -translate-y-1 animate-pulse'
            : selected
              ? 'border-yellow-400 bg-yellow-100 shadow-lg -translate-y-2'
              : `${bgAccent} border-gray-300 shadow hover:shadow-lg hover:-translate-y-1`
          }
          ${disabled
            ? 'opacity-50 cursor-not-allowed'
            : onClick
              ? 'cursor-pointer'
              : 'cursor-default'
          }
        `}
    >
        <span className={`absolute inset-0 flex items-center justify-center font-bold ${colorClass} leading-[1] -translate-y-[12%]`} style={{ fontFamily: '"Segoe UI Symbol", "Noto Sans Symbols", sans-serif' }}>
          {getTileUnicode(tile)}
        </span>

        {showLabel && (
          <span className={`${labelSizeClasses[size]} ${colorClass} leading-tight opacity-80 absolute bottom-0.5 right-1`}>
            {getTileDisplay(tile)}
          </span>
        )}
    </button>
  );
};

export default TileComponent;
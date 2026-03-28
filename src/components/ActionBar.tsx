import React, { useState, useEffect } from 'react';

export type ActionType = 'chi' | 'peng' | 'gang' | 'hu' | 'pass' | 'discard';

interface ActionButton {
  type: ActionType;
  label: string;
  color?: string;
  enabled: boolean;
}

interface ActionBarProps {
  availableActions: ActionButton[];
  onAction: (action: ActionType) => void;
  countdownSeconds?: number;
}

const ActionBar: React.FC<ActionBarProps> = ({
  availableActions,
  onAction,
  countdownSeconds = 10,
}) => {
  const [remaining, setRemaining] = useState(countdownSeconds);

  useEffect(() => {
    setRemaining(countdownSeconds);
    const timer = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdownSeconds]);

  const colorMap: Record<string, string> = {
    chi: 'bg-orange-500 hover:bg-orange-600',
    peng: 'bg-blue-500 hover:bg-blue-600',
    gang: 'bg-purple-500 hover:bg-purple-600',
    hu: 'bg-green-500 hover:bg-green-600',
    pass: 'bg-gray-500 hover:bg-gray-600',
  };

  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-gray-100 rounded-lg">
      {/* Countdown */}
      <div className="flex items-center gap-2">
        <div className="text-sm text-gray-600">剩餘時間</div>
        <div
          className={`
            w-8 h-8 rounded-full flex items-center justify-center
            font-bold text-white text-sm
            ${remaining <= 3 ? 'bg-red-500' : remaining <= 6 ? 'bg-yellow-500' : 'bg-green-500'}
          `}
        >
          {remaining}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap justify-center">
        {availableActions.map((action) => (
          <button
            key={action.type}
            onClick={() => onAction(action.type)}
            disabled={!action.enabled}
            className={`
              px-4 py-2 rounded-lg font-medium text-white text-sm
              transition-all duration-150
              ${colorMap[action.type]}
              ${action.enabled
                ? 'opacity-100 cursor-pointer shadow hover:shadow-md'
                : 'opacity-40 cursor-not-allowed'
              }
            `}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ActionBar;

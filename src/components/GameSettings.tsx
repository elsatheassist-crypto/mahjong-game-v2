import React, { useState } from 'react';

export type AIDifficulty = 'easy' | 'normal' | 'hard';
export type AIMode = 'algorithm' | 'llm';

interface GameSettingsProps {
  difficulty: AIDifficulty;
  onDifficultyChange: (d: AIDifficulty) => void;
  aiMode: AIMode;
  onAIModeChange: (m: AIMode) => void;
  soundEnabled: boolean;
  onSoundChange: (enabled: boolean) => void;
}

const GameSettings: React.FC<GameSettingsProps> = ({
  difficulty,
  onDifficultyChange,
  aiMode,
  onAIModeChange,
  soundEnabled,
  onSoundChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const difficulties: { value: AIDifficulty; label: string; desc: string }[] = [
    { value: 'easy', label: '簡單', desc: '隨機出牌，新手友好' },
    { value: 'normal', label: '普通', desc: '基本策略，適合一般玩家' },
    { value: 'hard', label: '困難', desc: '攻防兼備，具備讀牌能力' },
  ];

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
        title="遊戲設定"
      >
        ⚙️
      </button>

      {/* Settings Panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50">
          <h3 className="text-lg font-bold text-gray-800 mb-4">🎮 遊戲設定</h3>

          {/* AI Mode */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI 模式
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => onAIModeChange('algorithm')}
                className={`
                  flex-1 py-2 px-3 rounded-lg text-sm font-medium
                  transition-colors
                  ${aiMode === 'algorithm'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                `}
              >
                演算法
              </button>
              <button
                onClick={() => onAIModeChange('llm')}
                className={`
                  flex-1 py-2 px-3 rounded-lg text-sm font-medium
                  transition-colors
                  ${aiMode === 'llm'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                `}
              >
                LLM AI
              </button>
            </div>
          </div>

          {/* Difficulty */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI 難度
            </label>
            <div className="space-y-2">
              {difficulties.map((d) => (
                <button
                  key={d.value}
                  onClick={() => onDifficultyChange(d.value)}
                  className={`
                    w-full py-2 px-3 rounded-lg text-left
                    transition-colors
                    ${difficulty === d.value
                      ? 'bg-blue-100 border-2 border-blue-500'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                    }
                  `}
                >
                  <div className="text-sm font-medium">{d.label}</div>
                  <div className="text-xs text-gray-500">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Sound */}
          <div className="mb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => onSoundChange(e.target.checked)}
                className="w-4 h-4 text-blue-500 rounded"
              />
              <span className="text-sm text-gray-700">🔊 開啟音效</span>
            </label>
          </div>

          {/* Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="w-full mt-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium text-gray-700"
          >
            關閉
          </button>
        </div>
      )}
    </div>
  );
};

export default GameSettings;

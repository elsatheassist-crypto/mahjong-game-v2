import React, { useState } from 'react';

export type AIDifficulty = 'easy' | 'normal' | 'hard';
export type AIMode = 'algorithm' | 'llm' | 'hybrid';

interface LLMConfigData {
  provider: 'minimax' | 'openrouter' | 'gemini';
  apiKey: string;
  model: string;
}

interface GameSettingsProps {
  difficulty: AIDifficulty;
  onDifficultyChange: (d: AIDifficulty) => void;
  aiMode: AIMode;
  onAIModeChange: (m: AIMode) => void;
  llmConfig: LLMConfigData | null;
  onLLMConfigChange: (c: LLMConfigData | null) => void;
}

const GameSettings: React.FC<GameSettingsProps> = ({
  difficulty,
  onDifficultyChange,
  aiMode,
  onAIModeChange,
  llmConfig,
  onLLMConfigChange,
}) => {
  const [apiKey, setApiKey] = useState(llmConfig?.apiKey || '');
  const [model, setModel] = useState(llmConfig?.model || '');
  const [provider, setProvider] = useState<'minimax' | 'openrouter' | 'gemini'>(llmConfig?.provider || 'openrouter');

  const difficulties: { value: AIDifficulty; label: string; desc: string }[] = [
    { value: 'easy', label: '簡單', desc: '隨機出牌，新手友好' },
    { value: 'normal', label: '普通', desc: '基本策略，適合一般玩家' },
    { value: 'hard', label: '困難', desc: '攻防兼備，具備讀牌能力' },
  ];

  const aiModes: { value: AIMode; label: string; desc: string }[] = [
    { value: 'algorithm', label: '演算法', desc: '本地計算，快速免費' },
    { value: 'llm', label: 'LLM AI', desc: '使用 LLM 模型決策' },
    { value: 'hybrid', label: '混合模式', desc: '演算法 + LLM 混合' },
  ];

  const models: Record<string, { label: string; defaultModel: string }> = {
    minimax: { label: 'MiniMax', defaultModel: 'MiniMax-M2.7' },
    openrouter: { label: 'OpenRouter', defaultModel: 'anthropic/claude-3-haiku-20240307' },
    gemini: { label: 'Gemini', defaultModel: 'gemini-2.0-flash' },
  };

  const handleSave = () => {
    const newConfig: LLMConfigData = {
      provider,
      apiKey: apiKey || 'YOUR_API_KEY',
      model: model || models[provider].defaultModel,
    };
    onLLMConfigChange(newConfig);
    onAIModeChange(aiMode);
  };

  const handleProviderChange = (newProvider: 'minimax' | 'openrouter' | 'gemini') => {
    setProvider(newProvider);
    setModel(models[newProvider].defaultModel);
  };

  return (
    <div className="space-y-4">
      {/* AI Mode */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          AI 模式
        </label>
        <div className="flex gap-2">
          {aiModes.map((mode) => (
            <button
              key={mode.value}
              onClick={() => onAIModeChange(mode.value)}
              className={`
                flex-1 py-2 px-3 rounded-lg text-sm font-medium
                transition-colors
                ${aiMode === mode.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
              `}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {aiModes.find((m) => m.value === aiMode)?.desc}
        </p>
      </div>

      {/* Difficulty */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          演算法 AI 難度
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

      {/* LLM Settings (only show when LLM or Hybrid mode) */}
      {(aiMode === 'llm' || aiMode === 'hybrid') && (
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">LLM 設定</h3>

          {/* Provider */}
          <div className="mb-3">
            <label className="block text-xs text-gray-600 mb-1">Provider</label>
            <div className="flex gap-2">
              {Object.entries(models).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() => handleProviderChange(key as 'minimax' | 'openrouter' | 'gemini')}
                  className={`
                    flex-1 py-1.5 px-2 rounded text-xs
                    ${provider === key
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }
                  `}
                >
                  {info.label}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div className="mb-3">
            <label className="block text-xs text-gray-600 mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="輸入你的 API Key"
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          {/* Model */}
          <div className="mb-3">
            <label className="block text-xs text-gray-600 mb-1">模型</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={models[provider].defaultModel}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          <button
            onClick={handleSave}
            className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium"
          >
            儲存 LLM 設定
          </button>
        </div>
      )}

      {/* LLM Info */}
      {(aiMode === 'llm' || aiMode === 'hybrid') && (
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          <p>• MiniMax: https://api.minimax.io</p>
          <p>• OpenRouter: https://openrouter.ai</p>
          <p>• Gemini: https://ai.google.dev</p>
        </div>
      )}
    </div>
  );
};

export default GameSettings;

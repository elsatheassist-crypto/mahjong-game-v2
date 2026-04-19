import React, { useState } from 'react';
import { callLLM } from '../ai/llm/providers';
import { LLMConfig } from '../ai/llm/index';
import { HybridConfig, TileSize, AssistMode, HumanAiMode } from '../stores/gameStore';

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
  hybridConfig: HybridConfig;
  onHybridConfigChange: (c: Partial<HybridConfig>) => void;
  tileSize: TileSize;
  onTileSizeChange: (s: TileSize) => void;
  assistMode: AssistMode;
  onAssistModeChange: (mode: AssistMode) => void;
  humanAiMode: HumanAiMode;
  onHumanAiModeChange: (mode: HumanAiMode) => void;
  autoPlayDelay: number;
  onAutoPlayDelayChange: (delay: number) => void;
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

const GameSettings: React.FC<GameSettingsProps> = ({
  difficulty,
  onDifficultyChange,
  aiMode,
  onAIModeChange,
  llmConfig,
  onLLMConfigChange,
  hybridConfig,
  onHybridConfigChange,
  tileSize,
  onTileSizeChange,
  assistMode,
  onAssistModeChange,
  humanAiMode,
  onHumanAiModeChange,
  autoPlayDelay,
  onAutoPlayDelayChange,
}) => {
  const [apiKey, setApiKey] = useState(llmConfig?.apiKey || '');
  const [model, setModel] = useState(llmConfig?.model || '');
  const [provider, setProvider] = useState<'minimax' | 'openrouter' | 'gemini'>(llmConfig?.provider || 'openrouter');
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');

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

  const tileSizes: { value: TileSize; label: string; desc: string }[] = [
    { value: 'auto', label: '自動', desc: '根據裝置自動調整' },
    { value: 'xs', label: '超小', desc: 'iPhone SE/Mini' },
    { value: 'sm', label: '小', desc: 'iPhone' },
    { value: 'md', label: '中', desc: 'iPhone Plus/iPad Mini' },
    { value: 'lg', label: '大', desc: 'iPad' },
    { value: 'xl', label: '超大', desc: 'iPad Pro/桌機' },
  ];

  const assistModes: { value: AssistMode; label: string; desc: string }[] = [
    { value: 'none', label: '關閉', desc: '無輔助' },
    { value: 'hint', label: '僅提示', desc: '顯示建議操作' },
    { value: 'auto', label: '自動託管', desc: '自動進行遊戲' },
  ];

  const humanAiModes: { value: HumanAiMode; label: string; desc: string }[] = [
    { value: 'algorithm', label: '本地演算法', desc: '快速免費' },
    { value: 'llm', label: 'LLM 模型', desc: '更聰明的決策' },
  ];

  const autoPlayDelays: { value: number; label: string; desc: string }[] = [
    { value: 1000, label: '1秒', desc: '快速' },
    { value: 1500, label: '1.5秒', desc: '適中' },
    { value: 2000, label: '2秒', desc: '慢速' },
  ];

  const models: Record<string, { label: string; defaultModel: string }> = {
    minimax: { label: 'MiniMax', defaultModel: 'MiniMax-M2.7' },
    openrouter: { label: 'OpenRouter', defaultModel: 'google/gemini-2.0-flash-exp' },
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

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');

    const testConfig: LLMConfig = {
      provider,
      apiKey: apiKey || 'YOUR_API_KEY',
      model: model || models[provider].defaultModel,
    };

    const testPrompt = '請回覆"連線成功"四個字。';

    try {
      const response = await callLLM(testPrompt, testConfig);
      if (response.content && response.content.length > 0) {
        setTestStatus('success');
        setTestMessage(`✓ 連線成功！回應: "${response.content.slice(0, 50)}${response.content.length > 50 ? '...' : ''}"`);
      } else {
        setTestStatus('error');
        setTestMessage('✗ 回應為空，請檢查模型名稱是否正確');
      }
    } catch (error) {
      setTestStatus('error');
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      setTestMessage(`✗ 連線失敗: ${errorMessage.slice(0, 100)}`);
    }
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

      {/* Hybrid Config Toggles */}
      {aiMode === 'hybrid' && (
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">混合模式設定</h3>
          <div className="space-y-3">
            {[
              { key: 'discard' as const, label: '出牌' },
              { key: 'meld' as const, label: '吃碰槓' },
              { key: 'hu' as const, label: '胡牌' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{label}</span>
                <div className="flex gap-1">
                  {(['algorithm', 'llm'] as const).map((value) => (
                    <button
                      key={value}
                      onClick={() => onHybridConfigChange({ [key]: value })}
                      className={`
                        px-3 py-1 rounded text-xs font-medium
                        transition-colors
                        ${hybridConfig[key] === value
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }
                      `}
                    >
                      {value === 'algorithm' ? '演算法' : 'LLM'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Tile Size */}
      <div className="border-t pt-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          麻將大小
        </label>
        <div className="grid grid-cols-3 gap-2">
          {tileSizes.map((size) => (
            <button
              key={size.value}
              onClick={() => onTileSizeChange(size.value)}
              className={`
                py-2 px-2 rounded-lg text-center
                transition-colors
                ${tileSize === size.value
                  ? 'bg-amber-100 border-2 border-amber-500'
                  : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                }
              `}
            >
              <div className="text-sm font-medium">{size.label}</div>
              <div className="text-xs text-gray-500">{size.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Player Assist Settings */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">👤 玩家輔助設定</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-600 mb-2">輔助模式</label>
            <div className="grid grid-cols-3 gap-2">
              {assistModes.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => onAssistModeChange(mode.value)}
                  className={`
                    py-2 px-2 rounded-lg text-center
                    transition-colors
                    ${assistMode === mode.value
                      ? 'bg-blue-100 border-2 border-blue-500'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                    }
                  `}
                >
                  <div className="text-sm font-medium">{mode.label}</div>
                  <div className="text-xs text-gray-500">{mode.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-2">輔助 AI 引擎</label>
            <div className="grid grid-cols-2 gap-2">
              {humanAiModes.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => onHumanAiModeChange(mode.value)}
                  className={`
                    py-2 px-2 rounded-lg text-center
                    transition-colors
                    ${humanAiMode === mode.value
                      ? 'bg-blue-100 border-2 border-blue-500'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                    }
                  `}
                >
                  <div className="text-sm font-medium">{mode.label}</div>
                  <div className="text-xs text-gray-500">{mode.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-2">託管延遲時間</label>
            <div className="grid grid-cols-3 gap-2">
              {autoPlayDelays.map((delay) => (
                <button
                  key={delay.value}
                  onClick={() => onAutoPlayDelayChange(delay.value)}
                  className={`
                    py-2 px-2 rounded-lg text-center
                    transition-colors
                    ${autoPlayDelay === delay.value
                      ? 'bg-blue-100 border-2 border-blue-500'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                    }
                  `}
                >
                  <div className="text-sm font-medium">{delay.label}</div>
                  <div className="text-xs text-gray-500">{delay.desc}</div>
                </button>
              ))}
            </div>
          </div>
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
            className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium mb-2"
          >
            儲存 LLM 設定
          </button>

          <button
            onClick={handleTestConnection}
            disabled={testStatus === 'testing' || !apiKey}
            className={`
              w-full py-2 rounded-lg text-sm font-medium
              transition-colors
              ${testStatus === 'testing'
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : testStatus === 'success'
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : testStatus === 'error'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
              }
            `}
          >
            {testStatus === 'testing' ? '⏳ 測試中...' : '🔍 測試 API 連線'}
          </button>

          {testMessage && (
            <div className={`mt-2 p-2 rounded text-xs ${
              testStatus === 'success' ? 'bg-green-50 text-green-700' :
              testStatus === 'error' ? 'bg-red-50 text-red-700' :
              'bg-gray-50 text-gray-700'
            }`}>
              {testMessage}
            </div>
          )}
        </div>
      )}

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

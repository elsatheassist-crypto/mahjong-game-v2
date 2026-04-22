import type React from 'react';
import type { AIDifficulty, AIMode, AssistMode, HumanAiMode, HybridConfig, TileSize } from '../stores/gameStore';

export type LLMProvider = 'minimax' | 'openrouter' | 'gemini';
export type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export interface LLMConfigDraft {
  provider: LLMProvider;
  apiKey: string;
  model: string;
}

export interface SettingsDraft {
  difficulty: AIDifficulty;
  aiMode: AIMode;
  hybridConfig: HybridConfig;
  tileSize: TileSize;
  assistMode: AssistMode;
  humanAiMode: HumanAiMode;
  autoPlayDelay: number;
  llmConfig: LLMConfigDraft;
}

interface GameSettingsProps {
  draft: SettingsDraft;
  onDraftChange: (update: Partial<SettingsDraft>) => void;
  onTestConnection: () => Promise<void>;
  testStatus: TestStatus;
  testMessage: string;
  activeTab: 'ai' | 'display' | 'assist';
}

const MODELS: Record<LLMProvider, { label: string; defaultModel: string }> = {
  minimax: { label: 'MiniMax', defaultModel: 'MiniMax-M2.7' },
  openrouter: { label: 'OpenRouter', defaultModel: 'google/gemini-2.0-flash-exp' },
  gemini: { label: 'Gemini', defaultModel: 'gemini-2.0-flash' },
};

const GameSettings: React.FC<GameSettingsProps> = ({ draft, onDraftChange, onTestConnection, testStatus, testMessage, activeTab }) => {
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

  const handleProviderChange = (provider: LLMProvider) => {
    onDraftChange({
      llmConfig: {
        ...draft.llmConfig,
        provider,
        model: MODELS[provider].defaultModel,
      },
    });
  };

  return (
    <div className="space-y-4">
      {activeTab === 'ai' && (
        <>
          <div>
            <div className="mb-2 block text-sm font-medium text-gray-700">AI 模式</div>
            <div className="flex gap-2">
              {aiModes.map((mode) => (
                <button key={mode.value} type="button" onClick={() => onDraftChange({ aiMode: mode.value })} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${draft.aiMode === mode.value ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {mode.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">{aiModes.find((mode) => mode.value === draft.aiMode)?.desc}</p>
          </div>

          {draft.aiMode === 'hybrid' && (
            <div className="border-t pt-4">
              <h3 className="mb-3 text-sm font-medium text-gray-700">混合模式設定</h3>
              <div className="space-y-3">
                {[{ key: 'discard' as const, label: '出牌' }, { key: 'meld' as const, label: '吃碰槓' }, { key: 'hu' as const, label: '胡牌' }].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{label}</span>
                    <div className="flex gap-1">
                      {(['algorithm', 'llm'] as const).map((value) => (
                        <button key={value} type="button" onClick={() => onDraftChange({ hybridConfig: { ...draft.hybridConfig, [key]: value } })} className={`rounded px-3 py-1 text-xs font-medium transition-colors ${draft.hybridConfig[key] === value ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                          {value === 'algorithm' ? '演算法' : 'LLM'}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-3">💡 提示：如需修改 API Key 或演算法難度，請先點選上方按鈕切換至對應模式進行設定，混合模式將自動套用其參數。</p>
            </div>
          )}

          {draft.aiMode === 'algorithm' && (
            <div>
              <div className="mb-2 block text-sm font-medium text-gray-700">演算法 AI 難度</div>
              <div className="space-y-2">
                {difficulties.map((difficulty) => (
                  <button key={difficulty.value} type="button" onClick={() => onDraftChange({ difficulty: difficulty.value })} className={`w-full rounded-lg border-2 px-3 py-2 text-left transition-colors ${draft.difficulty === difficulty.value ? 'border-blue-500 bg-blue-100' : 'border-transparent bg-gray-50 hover:bg-gray-100'}`}>
                    <div className="text-sm font-medium">{difficulty.label}</div>
                    <div className="text-xs text-gray-500">{difficulty.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {draft.aiMode === 'llm' && (
            <div className="border-t pt-4">
              <h3 className="mb-3 text-sm font-medium text-gray-700">LLM 設定</h3>
              <div className="mb-3">
                <div className="mb-1 block text-xs text-gray-600">Provider</div>
                <div className="flex gap-2">
                  {Object.entries(MODELS).map(([key, info]) => (
                    <button key={key} type="button" onClick={() => handleProviderChange(key as LLMProvider)} className={`flex-1 rounded px-2 py-1.5 text-xs ${draft.llmConfig.provider === key ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {info.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <div className="mb-1 block text-xs text-gray-600">API Key</div>
                <input type="password" value={draft.llmConfig.apiKey} onChange={(event) => onDraftChange({ llmConfig: { ...draft.llmConfig, apiKey: event.target.value } })} placeholder="輸入你的 API Key" className="w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
              <div className="mb-3">
                <div className="mb-1 block text-xs text-gray-600">模型</div>
                <input type="text" value={draft.llmConfig.model} onChange={(event) => onDraftChange({ llmConfig: { ...draft.llmConfig, model: event.target.value } })} placeholder={MODELS[draft.llmConfig.provider].defaultModel} className="w-full rounded-lg border px-3 py-2 text-sm" />
              </div>
              <button type="button" onClick={() => void onTestConnection()} disabled={testStatus === 'testing' || !draft.llmConfig.apiKey} className={`w-full rounded-lg py-2 text-sm font-medium transition-colors ${testStatus === 'testing' ? 'cursor-not-allowed bg-gray-300 text-gray-500' : testStatus === 'success' ? 'bg-blue-500 text-white hover:bg-blue-600' : testStatus === 'error' ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
                {testStatus === 'testing' ? '⏳ 測試中...' : '🔍 測試 API 連線'}
              </button>
              {testMessage && <div className={`mt-2 rounded p-2 text-xs ${testStatus === 'success' ? 'bg-green-50 text-green-700' : testStatus === 'error' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700'}`}>{testMessage}</div>}
            </div>
          )}

          {draft.aiMode === 'llm' && (
            <div className="rounded bg-gray-50 p-2 text-xs text-gray-500">
              <p>• MiniMax: https://api.minimax.io</p>
              <p>• OpenRouter: https://openrouter.ai</p>
              <p>• Gemini: https://ai.google.dev</p>
            </div>
          )}
        </>
      )}

      {activeTab === 'display' && (
        <div className="border-t pt-4">
          <div className="mb-2 block text-sm font-medium text-gray-700">麻將大小</div>
          <div className="grid grid-cols-3 gap-2">
            {tileSizes.map((size) => (
              <button key={size.value} type="button" onClick={() => onDraftChange({ tileSize: size.value })} className={`rounded-lg border-2 px-2 py-2 text-center transition-colors ${draft.tileSize === size.value ? 'border-amber-500 bg-amber-100' : 'border-transparent bg-gray-50 hover:bg-gray-100'}`}>
                <div className="text-sm font-medium">{size.label}</div>
                <div className="text-xs text-gray-500">{size.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'assist' && (
        <div className="border-t pt-4">
          <h3 className="mb-3 text-sm font-medium text-gray-700">👤 玩家輔助設定</h3>
          <div className="space-y-4">
            <div>
              <div className="mb-2 block text-xs text-gray-600">輔助模式</div>
              <div className="grid grid-cols-3 gap-2">
                {assistModes.map((mode) => (
                  <button key={mode.value} type="button" onClick={() => onDraftChange({ assistMode: mode.value })} className={`rounded-lg border-2 px-2 py-2 text-center transition-colors ${draft.assistMode === mode.value ? 'border-blue-500 bg-blue-100' : 'border-transparent bg-gray-50 hover:bg-gray-100'}`}>
                    <div className="text-sm font-medium">{mode.label}</div>
                    <div className="text-xs text-gray-500">{mode.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 block text-xs text-gray-600">輔助 AI 引擎</div>
              <div className="grid grid-cols-2 gap-2">
                {humanAiModes.map((mode) => (
                  <button key={mode.value} type="button" onClick={() => onDraftChange({ humanAiMode: mode.value })} className={`rounded-lg border-2 px-2 py-2 text-center transition-colors ${draft.humanAiMode === mode.value ? 'border-blue-500 bg-blue-100' : 'border-transparent bg-gray-50 hover:bg-gray-100'}`}>
                    <div className="text-sm font-medium">{mode.label}</div>
                    <div className="text-xs text-gray-500">{mode.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 block text-xs text-gray-600">託管延遲時間</div>
              <div className="grid grid-cols-3 gap-2">
                {autoPlayDelays.map((delay) => (
                  <button key={delay.value} type="button" onClick={() => onDraftChange({ autoPlayDelay: delay.value })} className={`rounded-lg border-2 px-2 py-2 text-center transition-colors ${draft.autoPlayDelay === delay.value ? 'border-blue-500 bg-blue-100' : 'border-transparent bg-gray-50 hover:bg-gray-100'}`}>
                    <div className="text-sm font-medium">{delay.label}</div>
                    <div className="text-xs text-gray-500">{delay.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameSettings;

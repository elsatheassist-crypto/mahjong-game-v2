# 🀄 台灣16張麻將 - 安裝與啟動說明

## 系統需求

- Node.js 18 以上
- npm 或 yarn

---

## 🚀 快速啟動

### 1. 安裝相依套件

```bash
npm install
```

### 2. 啟動開發伺服器

```bash
npm run dev
```

啟動成功後，預設打開瀏覽器前往：
- http://localhost:5173

---

## 🎮 如何遊玩

### 開始遊戲
1. 選擇 AI 難度（簡單 / 普通 / 困難）
2. 選擇 AI 決策模式：
   - **演算法**：純本地計算，快速且免費。
   - **LLM**：支援 Gemini, MiniMax, OpenRouter 等 API，需要配置 API Key。
   - **混合**：混合演算法與大型語言模型決策。
3. 點擊「開始遊戲」

### 基本出牌與互動方式
- **點擊選牌**：點擊手牌來選定麻將。
- **雙擊出牌**：雙擊手牌可快速打出。
- **拖曳出牌**：直接拖曳想打出的麻將牌到牌桌中央鬆開即可。

### 遊戲流程
1. 依據台灣16張麻將規則，開始時莊家會拿到 17 張牌，閒家（含玩家與 AI）會拿到 16 張牌。
2. 系統會自動發牌與推進流程。
3. 輪到玩家回合時，請選擇手牌並打出。
4. 當可以進行 吃、碰、槓、胡 等操作時，介面會彈出提示供玩家選擇。
5. 有玩家胡牌或流局時，將會顯示結算統計畫面與台數計算。

---

## ⚙️ AI 模式說明

### 演算法模式（預設）
- 使用本機 AI 演算法（如向聽數計算、危險度分析）。
- 保證流暢，無須任何 API Key 配置。
- 具備三種難度：
  - **簡單**：偏向隨機出牌。
  - **普通**：基礎排效優化與向聽數計算。
  - **困難**：進階的防禦邏輯，具備讀牌避險能力。

### LLM 模式
- 透過 `src/ai/llm` 模組整合了多種大型語言模型 API（如 Gemini / MiniMax / OpenRouter）。
- 會讀取牌桌資訊供 LLM 分析決策，決策過程更趨近人類思考。
- 需要使用者自備 API Key（部分模型可能產生費用）。

### 混合模式
- 結合演算法進行一般出牌，並在關鍵時刻輔以 LLM AI 決策，兼顧遊戲速度並節省 API 呼叫額度。

---

## 🏗️ 原始碼架構設計

本專案採 TypeScript 與 React 18 開發，實行了**核心邏輯**與**UI視圖/狀態**徹底分離的軟體架構，從而保證遊戲邏輯的純淨以及易於測試拓展。

### 目錄結構與模組

```text
mahjong-game/
├── src/
│   ├── core/           # 核心遊戲邏輯（純函數設計）
│   │                   # 分為 tile(牌), wall(牌牆), game(主狀態), meld(吃碰槓), win(胡牌演算法), score(台數)
│   ├── ai/             # AI 對手決策大腦
│   │   ├── easy/normal/hard.ts  # 演算法 AI 分級實作
│   │   └── llm/                 # LLM 代理實作 (整合 Gemini, MiniMax, OpenRouter 等)
│   ├── stores/         # 集中式狀態管理 (Zustand)
│   │   └── gameStore.ts         # 唯一 Store：管理遊戲進程與非同步操作
│   ├── components/     # React UI 組件層
│   │   └── ...                  # Board(牌桌), Hand(手牌), Tile(牌) 等純渲染元件
│   ├── utils/          # 實用工具函式 (如 tileHelper.ts)
│   ├── __tests__/      # 單元測試集 (基於 Vitest)
│   ├── App.tsx         # 主應用程式佈局
│   └── main.tsx        # Vite 前端進入點
├── package.json
├── vite.config.ts      # Vite 伺服器與建構設定檔
└── vitest.config.ts    # Vitest 測試框架設定檔
```

### 架構說明與設計模式

1. **基礎核心層 (Core / Pure Domain Logic)**
   位於 `src/core/`。這層的函式皆為**純函數 (Pure Functions)**，負責處理麻將的基本規則：牌型驗證、算台、向聽數判定。這些函數只接收當下遊戲的 State 物件並回傳操作後的新狀態，確保**絕對不包含**任何 DOM 操作與非同步副作用。

2. **AI決策層 (AI System / Factory Pattern)**
   位於 `src/ai/`。使用工廠模式 `createAI(difficulty)` 自動建立對應難度的代理人。針對 LLM 模式，專門封裝了 `providers.ts` 以抽離各家 API 差異，並具有完整的錯誤捕捉與 Fallback 機制 (當 API 異常時可退回演算法決策)。

3. **統一狀態與流程控制器 (Zustand Store)**
   負責牽起 Core 與 UI 之間的橋樑，整個遊戲有且僅有一個 `gameStore.ts`。所有非同步的 Side Effect、回合時間延遲、網路 API 呼叫都在此處發生。這裡負責發號施令調用 `core` 去刷新 State，隨後觸發 UI 層的重繪。

4. **UI 層 (React + Tailwind CSS)**
   位於 `src/components/`。這層只做一件事：取得 Store 裡的資料流去渲染畫面，並接收玩家的操作指令。所有樣式皆透過 Tailwind CSS 以 Utility-class 的形式建立，兼具彈性與 RWD 適應性。

---

## 🔧 開發指令

專案內建的開發命令如下：

```bash
npm run dev      # 啟動 Vite 本地開發伺服器
npm run build    # 執行 TypeScript 靜態分析並建構最終產品
npm run preview  # 本機預覽建構後的產品結果
npm run test     # 跑一次 Vitest 單元測試
npm run lint     # 執行 ESLint 程式碼風格與語法檢查
```

---

## 📝 技術棧

- 主要語言：**TypeScript** (嚴格型別模式)
- 視圖框架：**React 18**
- 狀態管理：**Zustand**
- 樣式系統：**Tailwind CSS**
- 建構工具：**Vite**
- 測試環境：**Vitest** + jsdom
- 資源優化：完全使用 Unicode 字元繪製麻將外觀（不依賴外部圖檔）

---

## ⚠️ 注意事項

1. 網路請求連線需求：演算法模式為全離線運算，若開啟 LLM 模式則必須在有網路連線的環境中遊玩。
2. 開發規則守則：針對 `src/core/` 進行任何修改務必保持其 Pure Function 的設計初衷，相關 Side Effects 皆應移至 `Zustand store` 完成。

---

## 🎯 開發進度

| Phase | 內容 | 狀態 |
|-------|------|------|
| Phase 1 | 遊戲引擎核心（狀態與牌牆生成） | ✅ 完成 |
| Phase 2 | 胡牌判定系統演算法 | ✅ 完成 |
| Phase 3 | 演算法 AI（簡單/普通/困難） | ✅ 完成 |
| Phase 4 | LLM API 總線介接 (Gemini/MiniMax/OpenRouter) | ✅ 完成 |
| Phase 5 | 演算法與模型混合決策機制 | ✅ 完成 |
| Phase 6 | 狀態集中式管理重構 (Zustand) | ✅ 完成 |
| Phase 7 | 前端互動體驗（拖拉出牌）與 RWD  | ✅ 完成 |
| Phase 8 | 完整的台灣16張台數計算單元 | ✅ 完成 |
| Phase 9 | 程式碼單元測試（Vitest） | ✅ 完成 |

**目前進度已達 100% 具備完整核心體驗。**

# 🀄 台灣16張麻將 - 安裝與啟動說明

## 系統需求

- Node.js 18 以上
- npm 或 yarn
- 現已安裝：Node.js v22.22.1, npm 10.9.0

---

## 第一步：解壓縮

```bash
tar -xzvf mahjong-game.tar.gz
```

## 第二步：安裝相依套件

```bash
cd projects/mahjong-game
npm install
```

## 第三步：啟動遊戲

```bash
npm run dev
```

啟動成功後，打開瀏覽器前往：
- http://localhost:5173
- 或 http://localhost:5174
- 或 http://localhost:5175

---

## 🎮 如何遊玩

### 開始遊戲
1. 選擇 AI 難度（簡單 / 普通 / 困難）
2. 選擇 AI 模式
   - **演算法**：純本地計算，快速免費
   - **LLM**：使用 OpenRouter API，需要 API Key
   - **混合**：兩者混合
3. 點擊「開始遊戲」

### 出牌方式
- **點擊選牌**：點擊手牌中的牌來選中
- **雙擊直接出牌**：雙擊手牌直接打出
- **拖曳出牌**：拖曳手牌到外面鬆手

### 遊戲流程
1. 遊戲開始後，你會有 17 張手牌
2. 輪到你時，點擊或雙擊打出麻將
3. AI 對手會自動摸牌、出牌
4. 完成胡牌後顯示結算畫面

---

## ⚙️ AI 模式說明

### 演算法模式（預設）
- 使用本地 AI 演算法（向聽數計算、危險度分析）
- 完全免費，無需 API Key
- 三種難度差異：
  - **簡單**：隨機出牌
  - **普通**：基本效率優化
  - **困難**：攻防平衡 + 讀牌

### LLM 模式
- 使用 OpenRouter API 驅動 AI 決策
- 需要 API Key
- 決策更像人類思維
- 有免費額度（取決於模型）

### 混合模式
- 演算法出牌 + LLM 輔助決策
- 省 API 額度

---

## 📁 專案結構

```
mahjong-game/
├── src/
│   ├── components/     # UI 元件（Tile, Hand, Board 等）
│   ├── core/           # 遊戲核心邏輯（tile, wall, game, player 等）
│   ├── ai/             # AI 系統（演算法 AI + LLM AI）
│   │   └── llm/        # LLM AI（providers, agent, prompt）
│   ├── stores/         # Zustand 狀態管理
│   └── App.tsx         # 主應用程式
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🔧 開發指令

```bash
npm run dev      # 開發模式啟動
npm run build    # 建構生產版本
npm run preview  # 預覽建構結果
```

---

## 📝 技術棧

- React 18 + TypeScript
- Zustand（狀態管理）
- Tailwind CSS（樣式）
- Vite（建構工具）
- Unicode 麻將字元（無需圖片資源）

---

## ⚠️ 注意事項

1. **LLM API 額度**：使用 LLM 模式時注意 API 額度
2. **網路要求**：LLM 模式需要網路連線
3. **遊戲規則**：本遊戲為台灣 16 張麻將規則

---

## 🎯 開發进度

| Phase | 內容 | 狀態 |
|-------|------|------|
| Phase 1 | 遊戲引擎核心 | ✅ 完成 |
| Phase 2 | 胡牌判定系統 | ✅ 完成 |
| Phase 3 | 演算法 AI（3種難度） | ✅ 完成 |
| Phase 4 | LLM AI 系統 | ✅ 完成 |
| Phase 5 | 混合模式整合 | ✅ 完成 |
| Phase 6 | UI 元件 | ✅ 完成 |
| Phase 7 | 拖牌交互 | ✅ 完成 |
| Phase 8 | 遊戲流程整合 | ✅ 完成 |
| Phase 9 | 台數計算 | ✅ 完成 |

**完成度：~85%**（可正常遊玩）

---

如有問題，請聯繫開發者。

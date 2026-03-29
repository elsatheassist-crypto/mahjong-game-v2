# AGENTS.md — Coding Agent Instructions

## Build / Dev / Lint Commands

```bash
npm run dev      # Start Vite dev server (localhost:5173)
npm run build    # TypeScript compile + Vite production build
npm run preview  # Preview production build locally
npm run lint     # ESLint (flat config, auto-detected by ESLint v9)
```

**No test framework is configured.** There is no `jest`, `vitest`, or `@testing-library` in the project. Do not invent test commands. If tests are needed, propose adding vitest first.

---

## Project Structure

```
src/
├── core/           # Pure game logic (tile, wall, game, meld, win, score, player)
├── ai/             # AI decision-making (easy/normal/hard + LLM via OpenRouter)
│   ├── base.ts     # AIAgent interface, AIDifficulty type, AIConfig
│   ├── easy.ts     # Random discard AI
│   ├── normal.ts   # Basic efficiency AI (shanten calculation)
│   ├── hard.ts     # Advanced AI (defense + reading discards)
│   ├── helpers.ts  # Shared AI utilities
│   ├── index.ts    # Factory: createAI(difficulty) → AIAgent
│   └── llm/        # LLM integration (OpenRouter, MiniMax, Gemini)
│       ├── agent.ts      # createLLMAgent()
│       ├── providers.ts  # callLLM() — API call logic
│       └── index.ts      # buildLLMPrompt(), parseLLMResponse()
├── components/     # React UI components (Tile, Hand, Board, DiscardPile, etc.)
├── stores/         # Zustand state (gameStore.ts — single store)
├── utils/          # Helpers (tileHelper.ts)
├── App.tsx         # Root component — all game screens live here
├── main.tsx        # Vite entry
└── index.css       # Tailwind directives only
```

---

## Code Style

### Language & Modules
- **TypeScript** with `strict: true`. `noUnusedLocals` and `noUnusedParameters` are **disabled**.
- ES modules (`"type": "module"` in package.json). Use `import`/`export`, never `require`.
- Path: relative imports only (no path aliases configured).

### Naming Conventions
| Kind | Convention | Example |
|------|-----------|---------|
| Files | `camelCase.ts` | `gameStore.ts`, `tileHelper.ts` |
| React components | `PascalCase.tsx` | `Tile.tsx`, `DiscardPile.tsx` |
| Interfaces/types | `PascalCase` | `GameState`, `MeldAction`, `AIDecision` |
| Enums | `PascalCase` | `Suit`, `GamePhase`, `WinType` |
| Functions | `camelCase` | `createTile`, `canChi`, `checkWin` |
| Constants | `UPPER_SNAKE_CASE` | `TILE_DISPLAY`, `TILE_UNICODE` |
| Tuple types | `camelCase` with `as const` | `['east', 'south', 'west', 'north'] as const` |

### Imports
- Group order: (1) React / external libs, (2) core modules, (3) components/stores, (4) utils
- No barrel re-exports — each file exports its own symbols directly
- **Exception**: `ai/index.ts` is a barrel that re-exports + provides `createAI()` factory

### TypeScript Patterns
- **String unions over numeric enums**: `type WinType = 'tianhu' | 'dihu' | ...`
- **Enums for domain constants**: `enum Suit { WAN = 'wan', ... }` — use when runtime iteration needed
- **Immutability**: Spread to create new state — `return { ...state, players }`
- **No `as any`** — never suppress type errors
- **`as const`** for literal tuple inference where needed
- **JSDoc comments** on exported interfaces and public functions (see `ai/base.ts` for style)

### React Patterns
- Components use `React.FC<Props>` with explicit prop interfaces defined above the component
- `useCallback` for event handlers passed to child components
- `useMemo` for expensive derived state (chi/peng options)
- Zustand selectors for individual state slices: `useGameStore((s) => s.selectedTileId)`
- **Single Zustand store**: All game state lives in `gameStore.ts`. Do not create new stores.

### Tailwind / Styling
- Tailwind CSS 3 utility classes — no CSS modules, no styled-components
- Responsive sizes via custom `sizeClasses` record (`sm`, `md`, `lg`, `xl`)
- Color encoding: tile suit → color class (`Suit.WAN` → `text-red-600`)
- Multi-line template literals for dynamic className composition

### Error Handling
- AI errors: `try/catch` with `console.error`, then fallback to safe default (discard first tile)
- LLM errors: catch → fallback to algorithm AI → catch again → fallback to first tile
- No error boundaries in React (none configured)

### Game Logic Purity
- `src/core/` functions are **pure**: take state, return new state, no side effects
- `src/stores/` owns all mutations and async logic (AI turns, LLM calls)
- Tile IDs use `crypto.randomUUID()` when available, fallback to `${suit}-${value}-${Date.now()}-${random}`

### AI Module Pattern
- Factory pattern: `createAI(difficulty)` returns `AIAgent` interface
- All AI classes implement `AIAgent` from `ai/base.ts`
- Key methods: `decideDiscard()`, `decideMeld()`, `decideSelfDrawn()`, `getThinkTime()`
- LLM integration: `createLLMAgent()` + `callLLM()` in `ai/llm/`

---

## Domain-Specific Notes

- **16-tile mahjong (台灣麻將)**: Dealer gets 17 tiles, others get 16. Win = 17 tiles or 16 + claimed discard.
- **Seat order**: `east → south → west → north`. Player index 0 = human (south seat).
- **Chi restriction**: Only from left neighbor (previous player in turn order).
- **Action priority**: 胡 > 槓 > 碰 > 吃 > pass
- **Tile suits**: `wan` (萬), `tiao` (索), `tong` (筒), `feng` (東南西北), `jian` (中發白)

---

## Common Pitfalls

1. **Don't mutate `GameState` directly** — always spread into a new object.
2. **Don't use `Math.random()` for tile IDs** in production — use `crypto.randomUUID()`.
3. **Don't add test dependencies** without asking — the project has zero test infra.
4. **Don't create new Zustand stores** — extend the existing `gameStore.ts`.
5. **Don't add barrel `index.ts` re-exports** unless the module already has one (e.g., `ai/index.ts`).
6. **Don't bypass the AI factory** — always use `createAI(difficulty)`, never instantiate AI classes directly.

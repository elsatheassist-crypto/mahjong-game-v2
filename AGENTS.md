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
│   └── llm/        # LLM providers, agent, prompt building
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
- Group: (1) React / external libs, (2) core modules, (3) components/stores, (4) utils
- No barrel re-exports — each file exports its own symbols directly
- AI modules use factory pattern: `createAI(difficulty)` returns `AIAgent` interface

### TypeScript Patterns
- **Enum → string union**: Prefer `type WinType = 'tianhu' | 'dihu' | ...` over numeric enums for unions
- **Enum for domain constants**: `enum Suit { WAN = 'wan', ... }` for fixed sets with runtime iteration
- **Immutability**: Spread to create new state — `return { ...state, players }`
- **No `as any`** — never suppress type errors
- **`as const`** for literal tuple inference where needed

### React Patterns
- Components use `React.FC<Props>` with explicit prop interfaces
- `useCallback` for event handlers passed to child components
- `useMemo` for expensive derived state (chi/peng options)
- Zustand selectors for individual state slices: `useGameStore((s) => s.selectedTileId)`
- Component props interface defined above the component, not inline

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
5. **Don't add barrel `index.ts` re-exports** unless the module's own `index.ts` already does it (e.g., `ai/index.ts`).

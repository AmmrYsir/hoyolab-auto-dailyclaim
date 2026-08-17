# AGENTS.md — Agent & Contributor Development Guide

This document provides architectural standards, conventions, and operational workflows for autonomous AI agents and developers working on the `hoyolab-auto-dailyclaim` codebase.

---

## 🏛️ Project Architecture & Design Principles

1. **Zero External Runtime Dependencies**:
   - The project strictly uses **native Bun APIs** (`fetch`, `Bun.file`, `bun:test`, `node:net`, `node:tls`, `node:crypto`).
   - Do NOT install npm packages for runtime HTTP, parsing, or SMTP unless explicitly requested by the user.

2. **Strict TypeScript & Type Safety**:
   - Every module, function parameter, and return value must have explicit TypeScript types.
   - `strict: true` and `noUncheckedIndexedAccess: true` are enabled in `tsconfig.json`.
   - Run `bun run typecheck` (`tsc --noEmit`) to verify zero type errors.

3. **Security & Privacy First**:
   - Never log raw cookies, `ltoken_v2`, `ltuid_v2`, passwords, or webhook secrets.
   - Always route log strings and payload debug dumps through `src/utils/sanitizer.ts`.
   - Never write credentials or sensitive data to disk or untracked temporary files.

4. **Configuration Architecture & Separation of Concerns**:
   - **`config.json`**: Contains **only** the account profiles catalog (`profiles: [...]`) with explicit `ltoken_v2` and `ltuid_v2` fields.
   - **`.env`**: Contains all **infrastructure secrets & notifications** (`DISCORD_*`, `TELEGRAM_*`, `SMTP_*`, `WEBHOOK_*`), **runtime tunables** (`DELAY_MIN_MS`, `DELAY_MAX_MS`, `RETRY_COUNT`, `REQUEST_TIMEOUT_MS`, `FETCH_REWARD_DETAILS`), and environment accounts `HOYOLAB_ACCOUNTS`.
   - `src/config/loader.ts` automatically merges `config.json` profiles with `.env` settings.

5. **Modular Domain Layout**:
   ```
   src/
   ├── types/          # Central type definitions (game, config, hoyolab, notification)
   ├── constants/      # Game catalogs, act IDs, endpoints, headers
   ├── utils/          # Sanitizer, logger, time/delay jitter, resilient HTTP client
   ├── config/         # Multi-source config loader, schema validator, cookie normalizer
   ├── services/       # HoYoLAB API client & multi-account claim coordinator
   ├── notifiers/      # Discord, Telegram, SMTP, Webhook, and Console formatters
   └── index.ts        # CLI application entrypoint
   ```

---

## 🛠️ Development & Testing Workflows

### 1. Requirements
- **Bun**: `>= 1.3.0`
- **TypeScript**: `^5.0.0`

### 2. Available NPM / Bun Scripts
```bash
bun run start            # Execute daily claim routine
bun run dev              # Run with hot reload (watch mode)
bun test                 # Execute full test suite
bun run typecheck        # Verify TypeScript static analysis (tsc --noEmit)
bun run dry-run          # Test credentials without claiming rewards
bun run validate         # Validate config syntax and token formatting
```

### 3. Running & Writing Tests
- All test files reside in `tests/*.test.ts` and use Bun's native test runner (`import { describe, expect, it } from 'bun:test'`).
- Always write mock unit tests for any new notifier, service method, or configuration parser.
- Keep tests fast (under 200ms total execution time).

---

## 🧩 Extension Guide

### Adding a New Supported Game
1. Open [`src/types/game.ts`](file:///src/types/game.ts):
   - Add the game key to the `GameKey` union type.
2. Open [`src/constants/games.ts`](file:///src/constants/games.ts):
   - Add the game definition to `GAMES` object (`id`, `name`, `actId`, `signUrl`, `infoUrl`, `homeUrl`, `iconUrl`, `colorHex`, custom `headers` if required).
   - Add common aliases to `GAME_KEY_ALIASES`.
3. Open [`src/types/config.ts`](file:///src/types/config.ts) and [`src/config/schema.ts`](file:///src/config/schema.ts):
   - Update `AccountProfile` and `validateAccountProfile` to handle the game's toggle property.
4. Add unit test cases in `tests/config.test.ts` and `tests/hoyolab-client.test.ts`.

### Adding a New Notifier Channel
1. Create `src/notifiers/<channel>.ts` extending `BaseNotifier` from [`src/notifiers/base.ts`](file:///src/notifiers/base.ts).
2. Implement `public async send(summary: ClaimSummary): Promise<void>`.
3. Respect `this.shouldNotify(summary)` based on notification policy (`always`, `on_error`, `on_claim`).
4. Update [`src/types/config.ts`](file:///src/types/config.ts) and [`src/config/schema.ts`](file:///src/config/schema.ts) with the channel's configuration schema.
5. Register the notifier in [`src/notifiers/index.ts`](file:///src/notifiers/index.ts).
6. Add unit tests in `tests/notifiers.test.ts`.

---

## 🛡️ Coding Standards Checklist

- [ ] Zero runtime npm dependencies.
- [ ] No `any` types without explicit reason and safe casting.
- [ ] All sensitive strings (tokens, webhooks, credentials) sanitized via `sanitizeText` or `maskSecret`.
- [ ] Async methods properly handle errors without crashing unhandled rejections.
- [ ] `bun test` passes 100% of tests.
- [ ] `bun run typecheck` passes with 0 errors.

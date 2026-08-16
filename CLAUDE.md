# CLAUDE.md — Instructions for Claude

## Overview
`hoyolab-auto-dailyclaim` is a zero-dependency, type-safe automated daily rewards claimer for HoYoverse games (Genshin Impact, Honkai: Star Rail, Zenless Zone Zero, Honkai Impact 3rd, Tears of Themis) built on **Bun & TypeScript**.

## Key Commands
```bash
bun run start            # Execute daily claim
bun run dry-run          # Dry-run validation (no claim requests)
bun run validate         # Validate config & cookies without making requests
bun test                 # Run test suite with bun:test
bun run typecheck        # Type check via tsc --noEmit
```

## Architecture & Conventions
- **Runtime**: Bun `>= 1.3.0`.
- **Zero Runtime Dependencies**: Strictly use Bun built-in APIs (`fetch`, `bun:test`, `Bun.file`, `node:net`, `node:tls`). Do NOT install external runtime npm packages.
- **Security & Masking**: Never print raw cookies or webhook URLs. Always use `sanitizeText()` from `src/utils/sanitizer.ts`.
- **Error Handling**: HoYoLAB retcodes are mapped to strongly-typed `ClaimStatus` in `src/services/hoyolab-client.ts`:
  - `0`: SUCCESS
  - `-5003`: ALREADY_CLAIMED
  - `1034` / `is_risk`: CAPTCHA_TRIGGERED
  - `-100` / `10001`: INVALID_TOKEN
  - `-10002`: NO_CHARACTER
- **Notification Channels**:
  - `DiscordNotifier`: Rich Embeds with status colors and pings
  - `TelegramNotifier`: Formatted HTML
  - `SmtpNotifier`: Native zero-dependency SMTP with HTML and plain text
  - `GenericWebhookNotifier`: JSON POST
  - `ConsoleNotifier`: ANSI summary table

## Directory Structure
- `src/types/`: TypeScript interfaces and union types.
- `src/constants/`: Game metadata, act IDs, endpoints, default headers.
- `src/utils/`: Logger, sanitizer, time/jitter, resilient HTTP request wrapper.
- `src/config/`: Configuration loader (`config.json`, `.env`, env vars) and schema normalizer.
- `src/services/`: HoYoLAB client (sign-in + rewards/streak lookup) and claim coordinator.
- `src/notifiers/`: Multi-channel notification dispatchers.
- `src/index.ts`: CLI entry point with flags (`--dry-run`, `--validate`, `--config`, `--help`, `--version`).
- `tests/`: Unit and integration tests using `bun:test`.

## Quality Checks Before Committing
1. `bun test` must pass all tests.
2. `bun run typecheck` must pass with 0 errors.

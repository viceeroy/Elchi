# Lessons Learned

Patterns, corrections, and prevention rules captured during development.

### 2026-10-06 - Telegram Login Flow & Webhook Reliability
- **Mistake / Issue:** Referencing `elchi.uz` instead of `https://elchi.org`.
- **Root Cause:** Assumptions made without verifying the production domain registry.
- **Prevention Rule:** The only production domain is `https://elchi.org`. Never use or suggest `elchi.uz`.

### 2026-10-06 - Webhook Secret & Token Handling
- **Mistake / Issue:** Untrimmed webhook secret strings and delimiter splitting on tokens.
- **Root Cause:** Direct string equality without trimming caused failures when dashboard env vars contained whitespace/newlines. Using `.split('_')` failed if token format changed or contained extra characters.
- **Prevention Rule:** Always call `.trim()` on webhook secrets from headers and environment variables. Always use explicit regex validation (UUID) and prefix stripping (`.replace(/^\/start login_/, '').trim()`) instead of `.split()`.

### 2026-10-06 - Double-Tap Race Conditions in Telegram Callbacks
- **Mistake / Issue:** Users rapidly double-tapping inline buttons triggered redundant backend provisioning.
- **Root Cause:** A separate SELECT check followed by an UPDATE allowed parallel requests to pass the check.
- **Prevention Rule:** Use atomic UPDATE with `.is('telegram_id', null).eq('status', 'pending').select()` to claim single execution rights before initiating expensive external operations.

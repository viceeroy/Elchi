# Tasks & Todo

## Active Tasks

- [x] FIX 1: Trim webhook secret in `api/telegram-webhook.ts`
- [x] FIX 2: Token parsing with explicit prefix stripping & UUID validation in `lib/telegram-bot.ts`
- [x] FIX 3: Double-tap race on Confirm with atomic claim in `lib/telegram-bot.ts`
- [x] FIX 4: Explicit error state and expired UX in `src/components/LoginModal.tsx`
- [x] FIX 5: READ-ONLY report on double provisioning call in `lib/telegram-auth.ts`
- [x] FIX 6: Display `fix-webhook.sh` contents and status
- [x] Verification: Run `npm run lint` and `npm test`

## Review & Completed Tasks

- **Fix 1**: Applied whitespace trimming on both `TELEGRAM_WEBHOOK_SECRET` and `x-telegram-bot-api-secret-token` in `api/telegram-webhook.ts`, maintaining fail-closed logic and auth-before-body ordering.
- **Fix 2 & 3**: Added `UUID_REGEX` validation and explicit prefix stripping (`rawText.replace(/^\/start login_/, '').trim()` and `cq.data.replace(/^login_confirm_/, '').trim()`). Added atomic claim (`status = 'pending'`, `telegram_id is null`) before provisioning, with rollback on error, Uzbek callback notification, and button spinner termination.
- **Fix 4**: Added `"error"` status to `LoginModal.tsx`, cleared interval on verification or expiration, handled `verifyOtp` failure with Uzbek error message, and provided restart button (`Qaytadan urinish`) which issues a fresh signup token.
- **Verification**: `tsc --noEmit` passed with 0 errors; all 36 tests passed.

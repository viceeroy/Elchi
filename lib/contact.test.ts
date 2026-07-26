// Tests for the contact validators in ./contact.ts.
//
// Run with `npm test`. Uses Node's built-in test runner and its native
// TypeScript stripping — no test framework or dependency involved. Needs
// Node >= 22.18 (where type stripping is on by default); on 22.6–22.17 the
// same command works with --experimental-strip-types.
//
// These rules gate what lands in the `contact` column, and the phone cases in
// particular are load-bearing: the post form's own sanitizer permits spaces,
// hyphens and parentheses, and its +998/+82 quick-fill buttons insert a space.
// A "digits only" pattern would reject almost every real submission, so the
// separator cases below exist to keep anyone from tightening it into one.

import test from 'node:test';
import assert from 'node:assert/strict';
import { isContactKind, isValidContact, telegramUsername, phoneDialString } from './contact.ts';

test('telegram handles', async (t) => {
  await t.test('accepts well-formed handles', () => {
    for (const handle of [
      '@user123',
      '@traveler_kr',
      '@abcde',                 // minimum length (5)
      '@' + 'a'.repeat(32),     // maximum length (32)
      '@Mixed_Case_9',
    ]) {
      assert.equal(isValidContact(handle, 'telegram'), true, handle);
    }
  });

  await t.test('rejects malformed handles', () => {
    for (const handle of [
      '@abcd',                  // 4 chars, below Telegram's minimum
      '@' + 'a'.repeat(33),     // 33 chars, above the maximum
      '@1abcde',                // must start with a letter
      '@user-name',             // hyphen outside the charset
      '@user name',             // whitespace
      '@user.name',             // dot outside the charset
      'user123',                // missing the leading @
      '@',
      '',
    ]) {
      assert.equal(isValidContact(handle, 'telegram'), false, handle);
    }
  });

  await t.test('rejects a phone number submitted as telegram', () => {
    assert.equal(isValidContact('+998901234567', 'telegram'), false);
  });
});

test('phone numbers', async (t) => {
  await t.test('accepts the formats the post form produces', () => {
    for (const phone of [
      '+998 90-123-4567',       // UZ quick-fill button
      '+82 10-1234-5678',       // KR quick-fill button
      '+998901234567',          // no separators
      '(998) 90 123 45 67',     // parentheses
      '010-1234-5678',          // local format, no country code
      '1234567',                // minimum 7 digits
      '+' + '1'.repeat(15),     // maximum 15 digits (E.164)
    ]) {
      assert.equal(isValidContact(phone, 'phone'), true, phone);
    }
  });

  await t.test('rejects out-of-range digit counts', () => {
    assert.equal(isValidContact('123456', 'phone'), false);            // 6 digits
    assert.equal(isValidContact('+' + '1'.repeat(16), 'phone'), false); // 16 digits
  });

  await t.test('rejects letters and misplaced plus signs', () => {
    for (const phone of [
      '+998 90 ABC 4567',       // letters
      '998+901234567',          // plus is only meaningful leading
      '@998901234567',          // telegram handle submitted as a phone
      'tel:+998901234567',
      '',
    ]) {
      assert.equal(isValidContact(phone, 'phone'), false, phone);
    }
  });

  await t.test('tolerates surrounding whitespace', () => {
    assert.equal(isValidContact('  +998 90-123-4567  ', 'phone'), true);
  });
});

test('isContactKind narrows to the two supported channels', () => {
  assert.equal(isContactKind('telegram'), true);
  assert.equal(isContactKind('phone'), true);
  for (const v of ['email', '', null, undefined, 0, {}]) {
    assert.equal(isContactKind(v), false, String(v));
  }
});

test('telegramUsername strips anything outside the username charset', () => {
  assert.equal(telegramUsername('@user123'), 'user123');
  assert.equal(telegramUsername('user123'), 'user123');
  assert.equal(telegramUsername('  @user_123  '), 'user_123');
  // Legacy rows predate validation, so the link builder must not be steerable
  // by whatever they happen to contain.
  assert.equal(telegramUsername('@../../evil'), 'evil');
  assert.equal(telegramUsername('@user.name'), 'username');
  assert.equal(telegramUsername('@a b/c?d=e'), 'abcde');
});

test('phoneDialString reduces to a dialable URI body', () => {
  assert.equal(phoneDialString('+998 90-123-4567'), '+998901234567');
  assert.equal(phoneDialString('(82) 10 1234 5678'), '821012345678');
  assert.equal(phoneDialString('010-1234-5678'), '01012345678');
  assert.equal(phoneDialString('  +1 (555) 010-9999 '), '+15550109999');
  // A plus anywhere other than the front is dropped rather than relocated.
  assert.equal(phoneDialString('998+901234567'), '998901234567');
});

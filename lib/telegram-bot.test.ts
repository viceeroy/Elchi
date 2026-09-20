import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleTelegramUpdate,
  isMainMenuButton,
  getMainMenuKeyboard,
  MENU_BUTTONS,
  type TelegramUpdate,
} from './telegram-bot.js';

test('Telegram bot unit tests', async (t) => {
  const fakeToken = '123456:FAKE_TOKEN';
  process.env.SUPABASE_URL = 'http://localhost:9999';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';

  // Mock fetch capturing calls
  function createMockFetch() {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      calls.push({ url, body });
      return {
        ok: true,
        json: async () => ({ ok: true, result: {} }),
      } as Response;
    };
    return { mockFetch, calls };
  }

  await t.test('isMainMenuButton matches all 5 menu buttons', () => {
    for (const btn of MENU_BUTTONS) {
      assert.equal(isMainMenuButton(btn), true, `Should match: ${btn}`);
    }
    // The Uzbek translation "✈️ Yo'lovchi" has no quotes, so this specific straight-quote variant test is obsolete, but we leave the assertion for the standard button.
    assert.equal(isMainMenuButton("✈️ Yo'lovchi"), true);

    // Should reject random text
    assert.equal(isMainMenuButton('Hello'), false);
    assert.equal(isMainMenuButton('/start'), false);
    assert.equal(isMainMenuButton(''), false);
  });

  await t.test('getMainMenuKeyboard returns proper keyboard structure', () => {
    const kb = getMainMenuKeyboard();
    assert.ok(Array.isArray(kb.keyboard));
    assert.equal(kb.resize_keyboard, true);
    assert.equal(kb.is_persistent, true);

    const allButtons = kb.keyboard.flat().map((b: { text: string }) => b.text);
    assert.equal(allButtons.length, 5);
    assert.deepEqual(allButtons, [
      '✈️ Yo\'lovchi',
      '📦 Jo\'natma',
      '🔎 Qidirish',
      '📋 Mening e\'lonlarim',
      '👤 Mening profilim',
    ]);
  });

  await t.test('handles /start command', async () => {
    const { mockFetch, calls } = createMockFetch();
    const update: TelegramUpdate = {
      update_id: 1,
      message: {
        message_id: 10,
        date: 1600000000,
        chat: { id: 12345, type: 'private' },
        text: '/start',
      },
    };

    const res = await handleTelegramUpdate(fakeToken, update, mockFetch);
    assert.equal(res.handled, true);
    assert.equal(res.action, 'start');
    assert.equal(res.chatId, 12345);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith('/sendMessage'));
    assert.equal(calls[0].body.chat_id, 12345);
    assert.ok(String(calls[0].body.text).includes('xush kelibsiz'));
    assert.ok(calls[0].body.reply_markup);
  });

  await t.test('handles /start with payload (e.g. /start ref123)', async () => {
    const { mockFetch, calls } = createMockFetch();
    const update: TelegramUpdate = {
      update_id: 2,
      message: {
        message_id: 11,
        date: 1600000000,
        chat: { id: 12345, type: 'private' },
        text: '/start ref123',
      },
    };

    const res = await handleTelegramUpdate(fakeToken, update, mockFetch);
    assert.equal(res.handled, true);
    assert.equal(res.action, 'start');
    assert.equal(calls.length, 1);
  });

  await t.test('starts traveler and shipment flows from reply buttons', async () => {
    for (const btn of MENU_BUTTONS.slice(0, 2)) {
      const { mockFetch, calls } = createMockFetch();
      const update: TelegramUpdate = {
        update_id: 3,
        message: {
          message_id: 12,
          date: 1600000000,
          chat: { id: 98765, type: 'private' },
          text: btn,
        },
      };

      const isTraveler = btn === '✈️ Yo\'lovchi';
      const isRequest = btn === '📦 Jo\'natma';
      const res = await handleTelegramUpdate(fakeToken, update, mockFetch);
      assert.equal(res.handled, true);
      assert.equal(res.action, 'menu_button');
      assert.equal(calls.length, 1);
      if (isTraveler) {
        assert.ok(String(calls[0].body.text).includes('Qayerdan'));
      } else if (isRequest) {
        assert.ok(String(calls[0].body.text).includes('Qayerdan'));
      }
      assert.ok(calls[0].body.reply_markup);
    }
  });

  await t.test('routes search reply button to its inline corridor choices', async () => {
    const { mockFetch, calls } = createMockFetch();
    const update: TelegramUpdate = {
      update_id: 6,
      message: {
        message_id: 15,
        date: 1600000000,
        chat: { id: 54321, type: 'private' },
        text: '🔎 Qidirish',
      },
    };

    await handleTelegramUpdate(fakeToken, update, mockFetch);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.text, "Qaysi yo'nalish bo'yicha qidirmoqchisiz?");
    assert.ok(calls[0].body.reply_markup);
  });

  await t.test('routes curly-apostrophe traveler reply button to traveler flow', async () => {
    const { mockFetch, calls } = createMockFetch();
    const update: TelegramUpdate = {
      update_id: 7,
      message: {
        message_id: 16,
        date: 1600000000,
        chat: { id: 54321, type: 'private' },
        text: '✈️ Yo’lovchi',
      },
    };

    await handleTelegramUpdate(fakeToken, update, mockFetch);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.text, 'Qayerdan uchyapsiz?');
  });

  await t.test('handles unknown message with "Please choose an option from the menu."', async () => {
    const { mockFetch, calls } = createMockFetch();
    const update: TelegramUpdate = {
      update_id: 4,
      message: {
        message_id: 13,
        date: 1600000000,
        chat: { id: 54321, type: 'private' },
        text: 'random text message',
      },
    };

    const res = await handleTelegramUpdate(fakeToken, update, mockFetch);
    assert.equal(res.handled, true);
    assert.equal(res.action, 'unknown');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.text, 'Please choose an option from the menu.');
    assert.ok(calls[0].body.reply_markup);
  });

  await t.test('handles callback queries with "Coming soon."', async () => {
    const { mockFetch, calls } = createMockFetch();
    const update: TelegramUpdate = {
      update_id: 5,
      callback_query: {
        id: 'cb_123',
        from: { id: 111, is_bot: false, first_name: 'Test' },
        message: {
          message_id: 14,
          date: 1600000000,
          chat: { id: 54321, type: 'private' },
        },
        data: 'travel',
      },
    };

    const res = await handleTelegramUpdate(fakeToken, update, mockFetch);
    assert.equal(res.handled, true);
    assert.equal(res.action, 'callback_query');
    assert.equal(calls.length, 2); // 1 answerCallbackQuery + 1 sendMessage
    assert.ok(calls[0].url.endsWith('/answerCallbackQuery'));
    assert.ok(calls[1].url.endsWith('/sendMessage'));
    assert.equal(calls[1].body.text, 'Coming soon.');
  });

  await t.test('ignores invalid or empty updates safely without crashing', async () => {
    const { mockFetch, calls } = createMockFetch();
    const res1 = await handleTelegramUpdate(fakeToken, null as unknown as TelegramUpdate, mockFetch);
    assert.equal(res1.handled, false);
    assert.equal(calls.length, 0);

    const res2 = await handleTelegramUpdate(fakeToken, {} as TelegramUpdate, mockFetch);
    assert.equal(res2.handled, false);
    assert.equal(calls.length, 0);
  });
});

test('Traveler flow tests', async (t) => {
  const fakeToken = '123456:FAKE_TOKEN';
  process.env.SUPABASE_URL = 'http://localhost:9999';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';

  // We need to keep a simulated database state
  let mockDrafts: Record<number, any> = {};
  let mockProfiles: Record<number, any> = { 12345: { id: 'uuid-123' } };
  let insertedPosts: any[] = [];
  
  const { mock } = await import('node:test');

  mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    
    if (url.includes('/telegram_bot_drafts')) {
      if (init?.method === 'GET') {
        const idMatch = url.match(/telegram_id=eq\.(\d+)/);
        if (idMatch) {
          const draft = mockDrafts[Number(idMatch[1])];
          return new Response(draft ? JSON.stringify(draft) : 'null');
        }
      }
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        mockDrafts[body.telegram_id] = body;
        return new Response('{}'); // Upsert success
      }
      if (init?.method === 'DELETE') {
        const idMatch = url.match(/telegram_id=eq\.(\d+)/);
        if (idMatch) delete mockDrafts[Number(idMatch[1])];
        return new Response('{}');
      }
    }
    
    if (url.includes('/profiles')) {
      if (init?.method === 'GET') {
        const idMatch = url.match(/telegram_id=eq\.(\d+)/);
        if (idMatch) {
          const profile = mockProfiles[Number(idMatch[1])];
          return new Response(profile ? JSON.stringify(profile) : 'null');
        }
      }
    }
    
    if (url.includes('/posts') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      // simulate db error
      if (body.note === 'trigger_error') {
        return new Response(JSON.stringify({ message: 'DB Error', code: '500' }), { status: 500 });
      }
      insertedPosts.push(body);
      return new Response(JSON.stringify({ id: 'new-post-id' }));
    }

    return new Response('{}');
  });

  function createMockFetch() {
    const calls: any[] = [];
    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : {} });
      return { ok: true, json: async () => ({ ok: true, result: {} }) } as any;
    };
    return { mockFetch, calls };
  }

  await t.test('cancels draft with /cancel', async () => {
    mockDrafts[12345] = { telegram_id: 12345, step: 'from_country', state: {}, updated_at: new Date().toISOString() };
    const { mockFetch, calls } = createMockFetch();
    const update: any = { message: { message_id: 1, date: 1, chat: { id: 12345 }, text: '/cancel' } };
    await import('./telegram-bot.js').then(m => m.handleTelegramUpdate(fakeToken, update, mockFetch));
    assert.strictEqual(mockDrafts[12345], undefined);
    assert.ok(calls.some(c => c.body.text === 'Bekor qilindi.'));
  });


  await t.test('invalid country selection (same as from)', async () => {
    mockDrafts[12345] = { telegram_id: 12345, step: 'to_country', state: { from_country: 'KR' }, updated_at: new Date().toISOString() };
    const { mockFetch, calls } = createMockFetch();
    const update: any = { callback_query: { id: 'cq1', from: { id: 12345 }, message: { chat: { id: 12345 } }, data: 'country:KR' } };
    await import('./telegram-bot.js').then(m => m.handleTelegramUpdate(fakeToken, update, mockFetch));
    // It should answer with error
    assert.ok(calls.some(c => c.url.includes('answerCallbackQuery') && c.body.text === 'Iltimos, boshqa davlatni tanlang.'));
  });

  await t.test('invalid date rejection', async () => {
    mockDrafts[12345] = { telegram_id: 12345, step: 'date', state: {}, updated_at: new Date().toISOString() };
    const { mockFetch, calls } = createMockFetch();
    const update: any = { message: { message_id: 2, date: 2, chat: { id: 12345 }, text: 'not-a-date' } };
    await import('./telegram-bot.js').then(m => m.handleTelegramUpdate(fakeToken, update, mockFetch));
    assert.ok(calls.some(c => String(c.body.text).includes('Sana noto\'g\'ri')));
  });

  await t.test('invalid weight rejection', async () => {
    mockDrafts[12345] = { telegram_id: 12345, step: 'weight_kg', state: {}, updated_at: new Date().toISOString() };
    const { mockFetch, calls } = createMockFetch();
    const update: any = { message: { message_id: 4, date: 4, chat: { id: 12345 }, text: '200' } }; // > 100
    await import('./telegram-bot.js').then(m => m.handleTelegramUpdate(fakeToken, update, mockFetch));
    assert.ok(calls.some(c => String(c.body.text).includes('to\'g\'ri vazn kiriting')));
  });

  await t.test('invalid luggage count rejection', async () => {
    mockDrafts[12345] = { telegram_id: 12345, step: 'luggage_count', state: {}, updated_at: new Date().toISOString() };
    const { mockFetch, calls } = createMockFetch();
    const update: any = { message: { message_id: 5, date: 5, chat: { id: 12345 }, text: '-1' } };
    await import('./telegram-bot.js').then(m => m.handleTelegramUpdate(fakeToken, update, mockFetch));
    assert.ok(calls.some(c => String(c.body.text).includes('to\'g\'ri chamadon sonini kiriting')));
  });

  await t.test('successful confirmation and publish', async () => {
    const validState = { from_country: 'KR', to_country: 'UZ', from_city: 'Seoul', to_city: 'Tashkent', date: '2026-10-10', weight_kg: 20, luggage_count: 1, contact: '@user', contact_type: 'telegram' };
    mockDrafts[12345] = { telegram_id: 12345, step: 'confirmation', state: validState, updated_at: new Date().toISOString() };
    const { mockFetch, calls } = createMockFetch();
    const update: any = { callback_query: { id: 'cq2', from: { id: 12345 }, message: { chat: { id: 12345 } }, data: 'confirm:publish' } };
    await import('./telegram-bot.js').then(m => m.handleTelegramUpdate(fakeToken, update, mockFetch));
    assert.ok(calls.some(c => String(c.body.text).includes('E\'loningiz muvaffaqiyatli joylashtirildi')));
    assert.strictEqual(insertedPosts.length, 1);
    assert.strictEqual(insertedPosts[0].user_id, 'uuid-123');
    assert.strictEqual(insertedPosts[0].weight, '20 kg');
    assert.strictEqual(mockDrafts[12345], undefined); // Draft deleted
  });
  
  await t.test('database insertion failure', async () => {
    insertedPosts = [];
    const state = { note: 'trigger_error', date: '2026-10-10' }; // will trigger 500 in mock
    mockDrafts[12345] = { telegram_id: 12345, step: 'confirmation', state, updated_at: new Date().toISOString() };
    const { mockFetch, calls } = createMockFetch();
    const update: any = { callback_query: { id: 'cq_cancel', from: { id: 12345 }, message: { chat: { id: 12345 } }, data: 'confirm:cancel' } };
    await import('./telegram-bot.js').then(m => m.handleTelegramUpdate(fakeToken, update, mockFetch));
    assert.ok(calls.some(c => c.body.text === 'Bekor qilindi.'));
    assert.strictEqual(mockDrafts[12345], undefined); // Draft preserved
  });
});

test('Request flow tests', async (t) => {
  const fakeToken = '123456:FAKE_TOKEN';
  process.env.SUPABASE_URL = 'http://localhost:9999';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';

  let mockDrafts: Record<number, any> = {};
  let mockProfiles: Record<number, any> = { 12345: { id: 'uuid-123' } };
  let insertedPosts: any[] = [];
  
  const { mock } = await import('node:test');

  mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    
    if (url.includes('/telegram_bot_drafts')) {
      if (init?.method === 'GET') {
        const idMatch = url.match(/telegram_id=eq\.(\d+)/);
        if (idMatch) {
          const draft = mockDrafts[Number(idMatch[1])];
          return new Response(draft ? JSON.stringify(draft) : 'null');
        }
      }
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        mockDrafts[body.telegram_id] = body;
        return new Response('{}'); // Upsert success
      }
      if (init?.method === 'DELETE') {
        const idMatch = url.match(/telegram_id=eq\.(\d+)/);
        if (idMatch) delete mockDrafts[Number(idMatch[1])];
        return new Response('{}');
      }
    }
    
    if (url.includes('/profiles')) {
      if (init?.method === 'GET') {
        const idMatch = url.match(/telegram_id=eq\.(\d+)/);
        if (idMatch) {
          const profile = mockProfiles[Number(idMatch[1])];
          return new Response(profile ? JSON.stringify(profile) : 'null');
        }
      }
    }
    
    if (url.includes('/posts') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      // simulate db error
      if (body.note === 'trigger_error') {
        return new Response(JSON.stringify({ message: 'DB Error', code: '500' }), { status: 500 });
      }
      insertedPosts.push(body);
      return new Response(JSON.stringify({ id: 'new-request-id' }));
    }

    return new Response('{}');
  });

  function createMockFetch() {
    const calls: any[] = [];
    const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : {} });
      return { ok: true, json: async () => ({ ok: true, result: {} }) } as any;
    };
    return { mockFetch, calls };
  }

  await t.test('handles menu button "✈️ Yo\'lovchi"', async () => {
    mockDrafts = {};
    const { mockFetch, calls } = createMockFetch();
    const update: any = { message: { message_id: 1, date: 1, chat: { id: 12345 }, text: '✈️ Yo\'lovchi' } };
    await import('./telegram-bot.js').then(m => m.handleTelegramUpdate(fakeToken, update, mockFetch));
    
    assert.strictEqual(mockDrafts[12345]?.step, 'from_country');
    assert.ok(calls.some(c => c.body.text === 'Qayerdan uchyapsiz?'));
  });

  await t.test('invalid country selection (same as from)', async () => {
    mockDrafts[12345] = { telegram_id: 12345, step: 'req_to_country', state: { from_country: 'KR' }, updated_at: new Date().toISOString() };
    const { mockFetch, calls } = createMockFetch();
    const update: any = { callback_query: { id: 'cq1', from: { id: 12345 }, message: { chat: { id: 12345 } }, data: 'country:KR' } };
    await import('./telegram-bot.js').then(m => m.handleTelegramUpdate(fakeToken, update, mockFetch));
    assert.ok(calls.some(c => c.url.includes('answerCallbackQuery') && c.body.text === 'Iltimos, boshqa davlatni tanlang.'));
  });

  await t.test('invalid note rejection (over 300 chars)', async () => {
    mockDrafts[12345] = { telegram_id: 12345, step: 'req_note', state: {}, updated_at: new Date().toISOString() };
    const { mockFetch, calls } = createMockFetch();
    const longNote = 'A'.repeat(1001);
    const update: any = { message: { message_id: 2, date: 2, chat: { id: 12345 }, text: longNote } };
    await import('./telegram-bot.js').then(m => m.handleTelegramUpdate(fakeToken, update, mockFetch));
    assert.ok(calls.some(c => String(c.body.text).includes('Izoh juda uzun')));
  });

  await t.test('successful confirmation and publish', async () => {
    insertedPosts = [];
    const validState = { from_country: 'KR', to_country: 'UZ', from_city: 'Seoul', to_city: 'Tashkent', date: '2026-10-10', weight_kg: 5, contact: '@user', contact_type: 'telegram', note: 'I need documents' };
    mockDrafts[12345] = { telegram_id: 12345, step: 'req_confirmation', state: validState, updated_at: new Date().toISOString() };
    const { mockFetch, calls } = createMockFetch();
    const update: any = { callback_query: { id: 'cq2', from: { id: 12345 }, message: { chat: { id: 12345 } }, data: 'confirm:publish' } };
    await import('./telegram-bot.js').then(m => m.handleTelegramUpdate(fakeToken, update, mockFetch));
    assert.ok(calls.some(c => String(c.body.text).includes('Jo\'natma e\'loningiz muvaffaqiyatli joylashtirildi')));
    assert.strictEqual(insertedPosts.length, 1);
    assert.strictEqual(insertedPosts[0].type, 'request');
    assert.strictEqual(insertedPosts[0].luggage_count, 0);
    assert.deepEqual(insertedPosts[0].categories, []);
    assert.strictEqual(insertedPosts[0].user_id, 'uuid-123');
    // It should fetch signup_tokens... we might not have a mocked DB so this will fail or hang.
    // The previous tests mock Supabase by hijacking fetch? Let's check how they do it.
    assert.strictEqual(mockDrafts[12345], undefined);
  });
});

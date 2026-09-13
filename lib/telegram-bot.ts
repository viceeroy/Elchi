// Telegram bot logic for Elchi (@elchitravel_bot).
//
// Designed to be modular and serverless-friendly: processes individual updates
// statelessly and can be invoked from the Vercel webhook endpoint
// (api/telegram-webhook.ts) or tested in isolation.

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export const MENU_BUTTONS = [
  '✈️ Yo\'lovchi',
  '📦 Jo\'natma',
  '🔎 Qidirish',
  '📋 Mening e\'lonlarim',
  '👤 Mening profilim',
] as const;

export type MenuButton = (typeof MENU_BUTTONS)[number];

// Builds the persistent reply keyboard matching the 5 specified options.
export function getMainMenuKeyboard() {
  return {
    keyboard: [
      [{ text: '✈️ Yo\'lovchi' }],
      [{ text: '📦 Jo\'natma' }],
      [{ text: '🔎 Qidirish' }],
      [{ text: '📋 Mening e\'lonlarim' }, { text: '👤 Mening profilim' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

// Normalizes strings to match button text regardless of curly vs straight apostrophes
function normalizeMenuText(text: string): string {
  return text.trim().replace(/’/g, "'");
}

export function isMainMenuButton(text: string): boolean {
  const norm = normalizeMenuText(text);
  return (
    norm === '✈️ Yo\'lovchi' ||
    norm === '📦 Jo\'natma' ||
    norm === '🔎 Qidirish' ||
    norm === '📋 Mening e\'lonlarim' ||
    norm === '👤 Mening profilim'
  );
}

export interface TelegramApiResult {
  ok: boolean;
  description?: string;
  result?: unknown;
}

// Low-level helper to call Telegram Bot API methods.
// Token is never logged or exposed in error messages.
export async function callTelegramApi(
  token: string,
  method: string,
  body: Record<string, unknown>,
  fetchFn: typeof fetch = fetch,
): Promise<TelegramApiResult> {
  if (!token) {
    throw new Error('Telegram bot token is missing');
  }

  const url = `https://api.telegram.org/bot${token}/${method}`;
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return (await res.json()) as TelegramApiResult;
  } catch (err) {
    console.error(`Telegram API call ${method} failed:`, err instanceof Error ? err.message : 'Unknown error');
    return { ok: false, description: err instanceof Error ? err.message : 'Network error' };
  }
}

export async function sendTelegramMessage(
  token: string,
  chatId: number | string,
  text: string,
  replyMarkup?: Record<string, unknown>,
  fetchFn: typeof fetch = fetch,
): Promise<TelegramApiResult> {
  return callTelegramApi(
    token,
    'sendMessage',
    {
      chat_id: chatId,
      text,
      reply_markup: replyMarkup,
    },
    fetchFn,
  );
}

export async function answerTelegramCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string,
  fetchFn: typeof fetch = fetch,
): Promise<TelegramApiResult> {
  return callTelegramApi(
    token,
    'answerCallbackQuery',
    {
      callback_query_id: callbackQueryId,
      text,
    },
    fetchFn,
  );
}

export interface ProcessUpdateResult {
  handled: boolean;
  action?: 'start' | 'menu_button' | 'unknown' | 'callback_query' | 'ignored';
  chatId?: number;
  responseSent?: boolean;
}

// Main dispatcher for incoming Telegram updates.
// Guaranteed not to throw: catches errors and returns a structured result.
export async function handleTelegramUpdate(
  token: string,
  update: TelegramUpdate,
  fetchFn: typeof fetch = fetch,
): Promise<ProcessUpdateResult> {
  if (!update || typeof update !== 'object') {
    return { handled: false, action: 'ignored' };
  }

  // 1. Handle Callback Queries (e.g. inline buttons if any)
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message?.chat.id;
    
    if (chatId) {
      let handled = await handleTravelerFlow(token, update, cq.from.id, chatId, fetchFn);
      if (!handled) handled = await handleRequestFlow(token, update, cq.from.id, chatId, fetchFn);
      if (handled) return { handled: true, action: 'callback_query', chatId, responseSent: true };
    }

    await answerTelegramCallbackQuery(token, cq.id, 'Coming soon.', fetchFn);

    if (chatId) {
      await sendTelegramMessage(token, chatId, 'Coming soon.', getMainMenuKeyboard(), fetchFn);
    }
    return { handled: true, action: 'callback_query', chatId, responseSent: true };
  }

  // 2. Handle standard Messages
  const message = update.message;
  if (!message || !message.chat || typeof message.chat.id !== 'number') {
    return { handled: false, action: 'ignored' };
  }

  const chatId = message.chat.id;
  const rawText = message.text ? message.text.trim() : '';

  // 2a. /start or /cancel command
  if (rawText === '/start' || rawText.startsWith('/start ') || rawText === '/cancel') {
    // Both commands cancel any active draft
    await deleteDraft(chatId);
    
    if (rawText === '/cancel') {
      await sendTelegramMessage(token, chatId, 'Bekor qilindi.', getMainMenuKeyboard(), fetchFn);
      return { handled: true, action: 'start', chatId, responseSent: true };
    }

    const welcomeText =
      'Assalomu alaykum! Elchiga (@elchitravel_bot) xush kelibsiz.\n\n' +
      'Iltimos, menyudan tanlang:';

    await sendTelegramMessage(token, chatId, welcomeText, getMainMenuKeyboard(), fetchFn);
    return { handled: true, action: 'start', chatId, responseSent: true };
  }

  // 2b. Main menu button selection
  if (isMainMenuButton(rawText)) {
    if (rawText === "✈️ Yo'lovchi") {
      const handled = await handleTravelerFlow(token, update, chatId, chatId, fetchFn);
      if (handled) return { handled: true, action: 'menu_button', chatId, responseSent: true };
    }
    if (rawText === '📦 Jo\'natma') {
      const handled = await handleRequestFlow(token, update, chatId, chatId, fetchFn);
      if (handled) return { handled: true, action: 'menu_button', chatId, responseSent: true };
    }
    await sendTelegramMessage(token, chatId, 'Tez kunda...', getMainMenuKeyboard(), fetchFn);
    return { handled: true, action: 'menu_button', chatId, responseSent: true };
  }

  // Handle in-progress flows (any text that isn't a command)
  let handled = await handleTravelerFlow(token, update, chatId, chatId, fetchFn);
  if (!handled) handled = await handleRequestFlow(token, update, chatId, chatId, fetchFn);
  if (handled) return { handled: true, action: 'menu_button', chatId, responseSent: true };

  // 2c. Any other text or non-text message
  await sendTelegramMessage(
    token,
    chatId,
    'Please choose an option from the menu.',
    getMainMenuKeyboard(),
    fetchFn,
  );
  return { handled: true, action: 'unknown', chatId, responseSent: true };
}
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isValidContact } from './contact.js';

let adminClient: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;
  adminClient = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '', {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}
// --- State Management ---
export interface DraftState {
  from_country?: string;
  to_country?: string;
  from_city?: string;
  to_city?: string;
  date?: string;
  weight_kg?: number;
  luggage_count?: number;
  note?: string;
  contact?: string;
  contact_type?: 'telegram' | 'phone';
}

export type FlowStep =
  | 'from_country'
  | 'to_country'
  | 'from_city'
  | 'to_city'
  | 'date'
  | 'weight_kg'
  | 'luggage_count'
  | 'note'
  | 'contact'
  | 'confirmation'
  | 'req_from_country'
  | 'req_to_country'
  | 'req_from_city'
  | 'req_to_city'
  | 'req_date'
  | 'req_weight'
  | 'req_note'
  | 'req_contact'
  | 'req_confirmation';

export interface TelegramDraft {
  telegram_id: number;
  step: FlowStep;
  state: DraftState;
  updated_at: string;
}

const STALE_DRAFT_HOURS = 24;

export async function getDraft(telegramId: number): Promise<TelegramDraft | null> {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('telegram_bot_drafts')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (error || !data) return null;

  const updatedDate = new Date(data.updated_at);
  if (new Date().getTime() - updatedDate.getTime() > STALE_DRAFT_HOURS * 60 * 60 * 1000) {
    await deleteDraft(telegramId);
    return null;
  }

  return {
    telegram_id: Number(data.telegram_id),
    step: data.step as FlowStep,
    state: data.state as DraftState,
    updated_at: data.updated_at,
  };
}

export async function upsertDraft(telegramId: number, step: FlowStep, state: DraftState): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('telegram_bot_drafts')
    .upsert(
      { telegram_id: telegramId, step, state, updated_at: new Date().toISOString() },
      { onConflict: 'telegram_id' }
    );
  if (error) return false;
  cleanupStaleDrafts().catch(() => {});
  return true;
}

export async function deleteDraft(telegramId: number): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from('telegram_bot_drafts').delete().eq('telegram_id', telegramId);
}

async function cleanupStaleDrafts(): Promise<void> {
  const admin = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - STALE_DRAFT_HOURS * 60 * 60 * 1000).toISOString();
  await admin.from('telegram_bot_drafts').delete().lt('updated_at', cutoff);
}

// --- Helpers for Traveler Flow ---

function getCountryKeyboard(exclude?: string) {
  const all = [
    { text: '🇰🇷 Korea', callback_data: 'country:KR' },
    { text: '🇺🇿 Uzbekistan', callback_data: 'country:UZ' }
  ];
  return { inline_keyboard: [exclude ? all.filter(b => !b.callback_data.endsWith(exclude)) : all] };
}

// Categories are only used for requests, not traveler posts.

function parseDate(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  
  let match = trimmed.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  let year: number, month: number, day: number;
  if (match) {
    year = parseInt(match[1], 10);
    month = parseInt(match[2], 10) - 1;
    day = parseInt(match[3], 10);
  } else {
    match = trimmed.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    if (match) {
      day = parseInt(match[1], 10);
      month = parseInt(match[2], 10) - 1;
      year = parseInt(match[3], 10);
    } else {
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
                     'yan', 'fev', 'mar', 'apr', 'may', 'iyu', 'iyu', 'avg', 'sen', 'okt', 'noy', 'dek',
                     'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
      match = trimmed.match(/^(\d{1,2})[\s\-]+([a-zа-я]+)(?:[\s\-]+(\d{4}))?$/);
      if (match) {
        day = parseInt(match[1], 10);
        const mStr = match[2].substring(0,3);
        month = months.findIndex(m => m === mStr);
        if (month === -1) return null;
        month = month % 12;
        year = match[3] ? parseInt(match[3], 10) : new Date().getUTCFullYear();
      } else {
        return null;
      }
    }
  }

  const d = new Date(Date.UTC(year, month, day));
  if (isNaN(d.getTime())) return null;
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month || d.getUTCDate() !== day) {
    return null;
  }

  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const maxFuture = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()));

  if (d < startOfToday || d > maxFuture) return null;
  return d.toISOString().split('T')[0];
}

function renderConfirmation(state: DraftState, username?: string): string {
  const fromFlag = state.from_country === 'KR' ? '🇰🇷' : '🇺🇿';
  const toFlag = state.to_country === 'KR' ? '🇰🇷' : '🇺🇿';
  const fromCity = state.from_city || (state.from_country === 'KR' ? 'Seoul' : 'Tashkent');
  const toCity = state.to_city || (state.to_country === 'KR' ? 'Seoul' : 'Tashkent');
  
  return `✈️ Yo'lovchi\n\n${fromFlag} ${fromCity} → ${toFlag} ${toCity}\n📅 ${state.date}\n🧳 ${state.weight_kg} kg\n👜 ${state.luggage_count} ta chamadon\n\n${state.note ? `📝 ${state.note}\n\n` : ''}📱 ${state.contact}`;
}

export async function handleTravelerFlow(token: string, update: TelegramUpdate, telegramId: number, chatId: number, fetchFn: typeof fetch = fetch): Promise<boolean> {
  const draft = await getDraft(telegramId);

  if (update.message?.text?.trim() === "✈️ Yo'lovchi") {
    await upsertDraft(telegramId, 'from_country', {});
    await sendTelegramMessage(token, chatId, 'Qayerdan uchyapsiz?', getCountryKeyboard(), fetchFn);
    return true;
  }

  if (draft && !draft.step.startsWith('req_')) {
    let nextStep: FlowStep | null = null;
    let nextState = { ...draft.state };
    
    if (update.callback_query) {
      const cq = update.callback_query;
      const data = cq.data || '';
      
      if (draft.step === 'from_country' && data.startsWith('country:')) {
        nextState.from_country = data.split(':')[1];
        nextStep = 'to_country';
        await answerTelegramCallbackQuery(token, cq.id, '', fetchFn);
        await sendTelegramMessage(token, chatId, 'Qayerga uchyapsiz?', getCountryKeyboard(nextState.from_country), fetchFn);
      } 
      else if (draft.step === 'to_country' && data.startsWith('country:')) {
        const selected = data.split(':')[1];
        if (selected === nextState.from_country) {
          await answerTelegramCallbackQuery(token, cq.id, 'Iltimos, boshqa davlatni tanlang.', fetchFn);
          return true;
        }
        nextState.to_country = selected;
        nextStep = 'from_city';
        await answerTelegramCallbackQuery(token, cq.id, '', fetchFn);
        await sendTelegramMessage(token, chatId, 'Qaysi shahardan uchyapsiz?', undefined, fetchFn);
      }

      else if (draft.step === 'note' && data === 'skip_note') {
        nextStep = 'contact';
        await answerTelegramCallbackQuery(token, cq.id, '', fetchFn);
        const kb: any = { inline_keyboard: [] };
        if (cq.from.username) kb.inline_keyboard.push([{ text: `Mening @${cq.from.username} profilim`, callback_data: `contact:@${cq.from.username}` }]);
        await sendTelegramMessage(token, chatId, 'Bog\'lanish uchun telefon raqam yoki Telegram @username kiriting.', kb.inline_keyboard.length > 0 ? kb : undefined, fetchFn);
      }
      else if (draft.step === 'contact' && data.startsWith('contact:')) {
        nextState.contact = data.substring('contact:'.length);
        nextState.contact_type = nextState.contact.startsWith('@') ? 'telegram' : 'phone';
        nextStep = 'confirmation';
        await answerTelegramCallbackQuery(token, cq.id, '', fetchFn);
        await sendTelegramMessage(token, chatId, renderConfirmation(nextState, cq.from.username), { inline_keyboard: [[{ text: '✅ Joylashtirish', callback_data: 'confirm:publish' }, { text: '❌ Bekor qilish', callback_data: 'confirm:cancel' }]] }, fetchFn);
      }
      else if (draft.step === 'confirmation' && data.startsWith('confirm:')) {
        const action = data.split(':')[1];
        await answerTelegramCallbackQuery(token, cq.id, '', fetchFn);
        
        if (action === 'cancel') {
          await deleteDraft(telegramId);
          await sendTelegramMessage(token, chatId, 'Bekor qilindi.', getMainMenuKeyboard(), fetchFn);
          return true;
        } else if (action === 'publish') {
          const admin = getSupabaseAdmin();
          const { data: profile } = await admin.from('profiles').select('id').eq('telegram_id', telegramId).maybeSingle();
          if (!profile?.id) {
            await sendTelegramMessage(token, chatId, 'Telegram orqali e\'lon berishdan oldin Elchi veb-saytiga kiring.', getMainMenuKeyboard(), fetchFn);
            await deleteDraft(telegramId);
            return true;
          }
          const { error, data: inserted } = await admin.from('posts').insert({
            type: 'traveler', from_country: nextState.from_country, to_country: nextState.to_country,
            from_city: nextState.from_city, to_city: nextState.to_city, date: nextState.date,
            weight_kg: nextState.weight_kg, luggage_count: nextState.luggage_count,
            categories: [],
            category_other: null, weight: nextState.weight_kg + ' kg',
            note: nextState.note || null, contact: nextState.contact, contact_type: nextState.contact_type,
            user_id: profile.id, expires_at: new Date(new Date(nextState.date as string).getTime() + 86400000).toISOString().split('T')[0]
          }).select('id').single();
            
          if (error) {
            console.error('Insert error', error);
            await sendTelegramMessage(token, chatId, 'Xatolik yuz berdi. Iltimos qaytadan urining.', undefined, fetchFn);
          } else {
            await deleteDraft(telegramId);
            await sendTelegramMessage(
              token, 
              chatId, 
              '✅ E\'loningiz muvaffaqiyatli joylashtirildi.', 
              { inline_keyboard: [[{ text: '🔗 E\'lonni ko\'rish', url: `https://elchi.org/post/${inserted.id}` }]] }, 
              fetchFn
            );
          }
          return true;
        }
      } else {
        await answerTelegramCallbackQuery(token, cq.id, 'Noto\'g\'ri tanlov.', fetchFn);
      }
    } 
    else if (update.message?.text) {
      let text = update.message.text.trim();
      
      if (draft.step === 'from_city') {
        nextState.from_city = text;
        nextStep = 'to_city';
        await sendTelegramMessage(token, chatId, 'Qaysi shaharga boryapsiz?', undefined, fetchFn);
      }
      else if (draft.step === 'to_city') {
        nextState.to_city = text;
        nextStep = 'date';
        await sendTelegramMessage(token, chatId, 'Qaysi sanada uchyapsiz? (masalan: 25 Sentabr)', undefined, fetchFn);
      }
      else if (draft.step === 'date') {
        const parsed = parseDate(text);
        if (!parsed) {
          await sendTelegramMessage(token, chatId, 'Sana noto\'g\'ri. Iltimos YYYY-MM-DD yoki aniq sanani kiriting.', undefined, fetchFn);
          return true;
        }
        nextState.date = parsed;
        nextStep = 'weight_kg';
        await sendTelegramMessage(token, chatId, 'Qancha bo\'sh joyingiz bor? (kg)', undefined, fetchFn);
      }
      else if (draft.step === 'weight_kg') {
        const val = parseFloat(text);
        if (isNaN(val) || val <= 0 || val > 100) {
          await sendTelegramMessage(token, chatId, 'Iltimos, to\'g\'ri vazn kiriting (1 dan 100 gacha).', undefined, fetchFn);
          return true;
        }
        nextState.weight_kg = val;
        nextStep = 'luggage_count';
        await sendTelegramMessage(token, chatId, 'Nechta chamadon? (agar faqat kg bo\'lsa 0 yozing)', undefined, fetchFn);
      }
      else if (draft.step === 'luggage_count') {
        const val = parseInt(text, 10);
        if (isNaN(val) || val < 0 || val > 20) {
          await sendTelegramMessage(token, chatId, 'Iltimos, to\'g\'ri chamadon sonini kiriting (0 dan 20 gacha).', undefined, fetchFn);
          return true;
        }
        nextState.luggage_count = val;
        nextStep = 'note';
        await sendTelegramMessage(token, chatId, 'Qo\'shimcha izoh (ixtiyoriy)', { inline_keyboard: [[{ text: '⏭️ O\'tkazib yuborish', callback_data: 'skip_note' }]] }, fetchFn);
      }
      else if (draft.step === 'note') {
        if (text.length > 300) {
          await sendTelegramMessage(token, chatId, 'Izoh juda uzun. Iltimos, 300 belgidan oshirmang.', undefined, fetchFn);
          return true;
        }
        nextState.note = text.substring(0, 300);
        nextStep = 'contact';
        const kb: any = { inline_keyboard: [] };
        if (update.message.from?.username) kb.inline_keyboard.push([{ text: `Mening @${update.message.from.username} profilim`, callback_data: `contact:@${update.message.from.username}` }]);
        await sendTelegramMessage(token, chatId, 'Bog\'lanish uchun telefon raqam yoki Telegram @username kiriting.', kb.inline_keyboard.length > 0 ? kb : undefined, fetchFn);
      }
      else if (draft.step === 'contact') {
        let contactKind: 'telegram' | 'phone' | null = null;
        
        let testTg = text;
        if (!testTg.startsWith('@') && /^[A-Za-z]/.test(testTg)) {
          testTg = '@' + testTg;
        }
        
        if (isValidContact(testTg, 'telegram')) {
          contactKind = 'telegram';
          text = testTg; // normalize
        } else if (isValidContact(text, 'phone')) {
          contactKind = 'phone';
        }

        if (!contactKind) {
          await sendTelegramMessage(token, chatId, 'Bog\'lanish ma\'lumoti noto\'g\'ri. Iltimos, to\'g\'ri telefon raqam yoki Telegram @username kiriting.', undefined, fetchFn);
          return true;
        }

        nextState.contact = text;
        nextState.contact_type = contactKind;
        nextStep = 'confirmation';
        await sendTelegramMessage(token, chatId, renderConfirmation(nextState, update.message.from?.username), { inline_keyboard: [[{ text: '✅ Joylashtirish', callback_data: 'confirm:publish' }, { text: '❌ Bekor qilish', callback_data: 'confirm:cancel' }]] }, fetchFn);
      }
      else {
        await sendTelegramMessage(token, chatId, 'Iltimos, yuqoridagi tugmalardan foydalaning.', undefined, fetchFn);
        return true;
      }
    }
    
    if (nextStep) await upsertDraft(telegramId, nextStep, nextState);
    return true;
  }
  return false;
}

function renderRequestConfirmation(state: DraftState): string {
  const fromFlag = state.from_country === 'KR' ? '🇰🇷' : '🇺🇿';
  const toFlag = state.to_country === 'KR' ? '🇰🇷' : '🇺🇿';
  const fromCity = state.from_city || (state.from_country === 'KR' ? 'Seoul' : 'Tashkent');
  const toCity = state.to_city || (state.to_country === 'KR' ? 'Seoul' : 'Tashkent');
  
  return `📦 Jo'natma\n\n${fromFlag} ${fromCity} → ${toFlag} ${toCity}\n📅 ${state.date} gacha\n🧳 ${state.weight_kg} kg gacha\n\n📝 ${state.note}\n\n📱 ${state.contact}`;
}

export async function handleRequestFlow(token: string, update: TelegramUpdate, telegramId: number, chatId: number, fetchFn: typeof fetch = fetch): Promise<boolean> {
  const draft = await getDraft(telegramId);

  if (update.message?.text?.trim() === "📦 Jo'natma") {
    await upsertDraft(telegramId, 'req_from_country', {});
    await sendTelegramMessage(token, chatId, 'Qayerdan yuboryapsiz?', getCountryKeyboard(), fetchFn);
    return true;
  }

  if (draft && draft.step.startsWith('req_')) {
    let nextStep: FlowStep | null = null;
    let nextState = { ...draft.state };
    
    if (update.callback_query) {
      const cq = update.callback_query;
      const data = cq.data || '';
      
      if (draft.step === 'req_from_country' && data.startsWith('country:')) {
        nextState.from_country = data.split(':')[1];
        nextStep = 'req_to_country';
        await answerTelegramCallbackQuery(token, cq.id, '', fetchFn);
        await sendTelegramMessage(token, chatId, 'Where are you sending to?', getCountryKeyboard(nextState.from_country), fetchFn);
      } 
      else if (draft.step === 'req_to_country' && data.startsWith('country:')) {
        const selected = data.split(':')[1];
        if (selected === nextState.from_country) {
          await answerTelegramCallbackQuery(token, cq.id, 'Please select the opposite country.', fetchFn);
          return true;
        }
        nextState.to_country = selected;
        nextStep = 'req_from_city';
        await answerTelegramCallbackQuery(token, cq.id, '', fetchFn);
        await sendTelegramMessage(token, chatId, 'Which city are you sending from?', undefined, fetchFn);
      }
      else if (draft.step === 'req_contact' && data.startsWith('contact:')) {
        nextState.contact = data.substring('contact:'.length);
        nextState.contact_type = nextState.contact.startsWith('@') ? 'telegram' : 'phone';
        nextStep = 'req_confirmation';
        await answerTelegramCallbackQuery(token, cq.id, '', fetchFn);
        await sendTelegramMessage(token, chatId, renderRequestConfirmation(nextState), { inline_keyboard: [[{ text: '✅ Joylashtirish', callback_data: 'confirm:publish' }, { text: '❌ Bekor qilish', callback_data: 'confirm:cancel' }]] }, fetchFn);
      }
      else if (draft.step === 'req_confirmation' && data.startsWith('confirm:')) {
        const action = data.split(':')[1];
        await answerTelegramCallbackQuery(token, cq.id, '', fetchFn);
        
        if (action === 'cancel') {
          await deleteDraft(telegramId);
          await sendTelegramMessage(token, chatId, 'Bekor qilindi.', getMainMenuKeyboard(), fetchFn);
          return true;
        } else if (action === 'publish') {
          const admin = getSupabaseAdmin();
          const { data: profile } = await admin.from('profiles').select('id').eq('telegram_id', telegramId).maybeSingle();
          if (!profile?.id) {
            await sendTelegramMessage(token, chatId, 'Telegram orqali e\'lon berishdan oldin Elchi veb-saytiga kiring.', getMainMenuKeyboard(), fetchFn);
            await deleteDraft(telegramId);
            return true;
          }
          const { error, data: inserted } = await admin.from('posts').insert({
            type: 'request', from_country: nextState.from_country, to_country: nextState.to_country,
            from_city: nextState.from_city, to_city: nextState.to_city, date: nextState.date,
            weight_kg: nextState.weight_kg, luggage_count: 0,
            categories: [], category_other: null, weight: nextState.weight_kg + ' kg',
            note: nextState.note || null, contact: nextState.contact, contact_type: nextState.contact_type,
            user_id: profile.id, expires_at: new Date(new Date(nextState.date as string).getTime() + 86400000).toISOString().split('T')[0]
          }).select('id').single();
            
          if (error) {
            console.error('Insert error', error);
            await sendTelegramMessage(token, chatId, 'Xatolik yuz berdi. Iltimos qaytadan urining.', undefined, fetchFn);
          } else {
            await deleteDraft(telegramId);
            await sendTelegramMessage(
              token, 
              chatId, 
              '✅ Jo\'natma e\'loningiz muvaffaqiyatli joylashtirildi.', 
              { inline_keyboard: [[{ text: '🔗 E\'lonni ko\'rish', url: `https://elchi.org/post/${inserted.id}` }]] }, 
              fetchFn
            );
          }
          return true;
        }
      } else {
        await answerTelegramCallbackQuery(token, cq.id, 'Noto\'g\'ri tanlov.', fetchFn);
      }
    } 
    else if (update.message?.text) {
      let text = update.message.text.trim();
      
      if (draft.step === 'req_from_city') {
        nextState.from_city = text;
        nextStep = 'req_to_city';
        await sendTelegramMessage(token, chatId, 'Qaysi shaharga yuboryapsiz?', undefined, fetchFn);
      }
      else if (draft.step === 'req_to_city') {
        nextState.to_city = text;
        nextStep = 'req_date';
        await sendTelegramMessage(token, chatId, 'Qaysi sanagacha yetkazish kerak? (masalan: 25 Sentabr)', undefined, fetchFn);
      }
      else if (draft.step === 'req_date') {
        const parsed = parseDate(text);
        if (!parsed) {
          await sendTelegramMessage(token, chatId, 'Sana noto\'g\'ri. Iltimos YYYY-MM-DD yoki aniq sanani kiriting.', undefined, fetchFn);
          return true;
        }
        nextState.date = parsed;
        nextStep = 'req_note';
        await sendTelegramMessage(token, chatId, 'Nima yubormoqchisiz? Qisqacha izoh yozing (maksimal 300 belgi).', undefined, fetchFn);
      }
      else if (draft.step === 'req_note') {
        if (text.length > 300) {
          await sendTelegramMessage(token, chatId, 'Izoh juda uzun. Iltimos, 300 belgidan oshirmang.', undefined, fetchFn);
          return true;
        }
        nextState.note = text;
        nextStep = 'req_weight';
        await sendTelegramMessage(token, chatId, 'Taxminiy og\'irligi? (kg)', undefined, fetchFn);
      }
      else if (draft.step === 'req_weight') {
        const val = parseFloat(text);
        if (isNaN(val) || val <= 0 || val > 100) {
          await sendTelegramMessage(token, chatId, 'Iltimos, to\'g\'ri vazn kiriting (1 dan 100 gacha).', undefined, fetchFn);
          return true;
        }
        nextState.weight_kg = val;
        nextStep = 'req_contact';
        const kb: any = { inline_keyboard: [] };
        if (update.message.from?.username) kb.inline_keyboard.push([{ text: `Mening @${update.message.from.username} profilim`, callback_data: `contact:@${update.message.from.username}` }]);
        await sendTelegramMessage(token, chatId, 'Bog\'lanish uchun telefon raqam yoki Telegram @username kiriting.', kb.inline_keyboard.length > 0 ? kb : undefined, fetchFn);
      }
      else if (draft.step === 'req_contact') {
        let contactKind: 'telegram' | 'phone' | null = null;
        let testTg = text;
        if (!testTg.startsWith('@') && /^[A-Za-z]/.test(testTg)) testTg = '@' + testTg;
        if (isValidContact(testTg, 'telegram')) { contactKind = 'telegram'; text = testTg; }
        else if (isValidContact(text, 'phone')) contactKind = 'phone';
        
        if (!contactKind) {
          await sendTelegramMessage(token, chatId, 'Bog\'lanish ma\'lumoti noto\'g\'ri. Iltimos, to\'g\'ri telefon raqam yoki Telegram @username kiriting.', undefined, fetchFn);
          return true;
        }
        nextState.contact = text;
        nextState.contact_type = contactKind;
        nextStep = 'req_confirmation';
        await sendTelegramMessage(token, chatId, renderRequestConfirmation(nextState), { inline_keyboard: [[{ text: '✅ Joylashtirish', callback_data: 'confirm:publish' }, { text: '❌ Bekor qilish', callback_data: 'confirm:cancel' }]] }, fetchFn);
      }
      else {
        await sendTelegramMessage(token, chatId, 'Iltimos, yuqoridagi tugmalardan foydalaning.', undefined, fetchFn);
        return true;
      }
    }
    
    if (nextStep) await upsertDraft(telegramId, nextStep, nextState);
    return true;
  }
  return false;
}

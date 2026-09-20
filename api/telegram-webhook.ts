import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleTelegramUpdate, type TelegramUpdate } from '../lib/telegram-bot.js';

// Telegram Webhook endpoint for Elchi bot (@elchitravel_bot).
//
// Receives HTTP POST updates pushed by Telegram's webhook system.
// Responds with 200 OK to acknowledge receipt, preventing Telegram from
// retrying updates in a loop.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate Telegram Webhook Secret token (set via setWebhook secret_token parameter).
  // Fails closed: reject if secret is not configured or header does not match.
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const receivedSecret = req.headers['x-telegram-bot-api-secret-token'];
  if (!webhookSecret || receivedSecret !== webhookSecret) {
    if (!webhookSecret) {
      console.error('TELEGRAM_WEBHOOK_SECRET is not configured');
    }
    return res.status(401).json({ error: 'Unauthorized webhook request' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN is not configured');
    return res.status(500).json({ error: 'Telegram bot token is not configured' });
  }

  try {
    const update = req.body as TelegramUpdate;
    if (!update || typeof update !== 'object') {
      return res.status(400).json({ error: 'Invalid update body' });
    }

    const result = await handleTelegramUpdate(botToken, update);
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    console.error('Unhandled error in telegram-webhook:', err instanceof Error ? err.message : 'Unknown error');
    // Telegram will retry on non-200. Return 200 with ok: false to prevent spam retries on unrecoverable logic bugs
    return res.status(200).json({ ok: false, error: 'Internal processing error' });
  }
}

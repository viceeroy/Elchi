import type { VercelRequest, VercelResponse } from '@vercel/node';

const WEBSITE_ID = 'dfid_HuqfXN07SpsFWoIp6ObZk';
const DOMAIN = 'elchi.org';
const CRAWLER_RE = /bot|crawl|spider|slurp|chatgpt|gptbot|claude|perplexity|facebookexternalhit|googlebot|bingbot|yandex|duckduckbot/i;

/**
 * Tracks AI crawler and search bot requests server-side without external dependencies.
 * Resolves synchronously in zero network time for human visitors.
 * For crawlers, reliably sends tracking events before the serverless function exits.
 */
export async function trackBotRequest(
  req: VercelRequest,
  _res?: VercelResponse,
  publicPath?: string
): Promise<void> {
  const userAgent = req.headers['user-agent'] || '';
  if (!CRAWLER_RE.test(userAgent)) return;

  try {
    const host = req.headers.host || DOMAIN;
    const path = publicPath ?? (typeof req.url === 'string' ? req.url : '/');
    const fullUrl = `https://${host}${path.startsWith('/') ? path : `/${path}`}`;

    await fetch('https://datafa.st/api/ai-crawls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        websiteId: WEBSITE_ID,
        domain: DOMAIN,
        href: fullUrl,
        referrer: req.headers.referer || req.headers.referrer || null,
        ai: {
          userAgent,
          source: 'serverless',
        },
      }),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // Best effort — never block or fail the primary response
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { trackAICrawlerRequest } from '@datafast/ai-crawl';

const WEBSITE_ID = 'dfid_HuqfXN07SpsFWoIp6ObZk';
const DOMAIN = 'elchi.org';

/**
 * Tracks AI crawler and search bot requests server-side.
 * Resolves synchronously in zero network time for human visitors.
 * For crawlers, reliably sends tracking events before the serverless function exits.
 */
export async function trackBotRequest(
  req: VercelRequest,
  res?: VercelResponse,
  publicPath?: string
): Promise<void> {
  try {
    const host = req.headers.host || DOMAIN;
    const path = publicPath ?? (typeof req.url === 'string' ? req.url : '/');
    const fullUrl = `https://${host}${path.startsWith('/') ? path : `/${path}`}`;

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        headers.set(key, value.join(', '));
      } else if (typeof value === 'string') {
        headers.set(key, value);
      }
    }

    const request = new Request(fullUrl, {
      method: req.method || 'GET',
      headers,
    });

    await trackAICrawlerRequest(request, {
      websiteId: WEBSITE_ID,
      domain: DOMAIN,
      publicOrigin: `https://${DOMAIN}`,
    });
  } catch {
    // Best effort — never block or fail the primary response
  }
}

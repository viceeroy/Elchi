import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabase.js';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';
import { trackBotRequest } from '../lib/datafast.js';
import fs from 'fs';
import path from 'path';

// Read the built index.html from dist/ at runtime so PWA tags stay in sync.
// Fallback to the raw index.html during local dev if dist/ doesn't exist yet.
let HTML_SHELL = '';
try {
  HTML_SHELL = fs.readFileSync(path.join(process.cwd(), 'dist', 'index.html'), 'utf8');
} catch (e) {
  try {
    HTML_SHELL = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  } catch (err) {
    console.error('Could not load index.html template');
    HTML_SHELL = '<!doctype html><html lang="uz"><head><title>Elchi</title></head><body><div id="root"></div></body></html>';
  }
}

// Inlined — same as src/constants.ts, but we can't import client code here.
const COUNTRY_NAMES: Record<string, string> = { KR: 'Koreya', UZ: "O'zbekiston" };

// Self-contained HTML for expired posts. No SPA, no JS, no external deps — a
// crawlable dead-end that tells both the user and Google the post is gone.
// `noindex` prevents re-indexing; canonical funnels residual link equity home.
const EXPIRED_HTML = `<!doctype html>
<html lang="uz">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>E'lon muddati tugagan | Elchi</title>
  <meta name="robots" content="noindex">
  <link rel="canonical" href="https://elchi.org/">
  <meta name="description" content="Bu e'lonning amal qilish muddati tugagan.">
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center;
           justify-content: center; min-height: 100vh; margin: 0; background: #faf9f6; color: #1a1a1a; }
    .box { text-align: center; max-width: 400px; padding: 2rem; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: #666; margin-bottom: 1.5rem; }
    a { color: #2563eb; text-decoration: none; font-weight: 500; }
  </style>
</head>
<body>
  <div class="box">
    <h1>⏳ E'lon muddati tugagan</h1>
    <p>Bu e'lonning amal qilish muddati tugagan. Yangi e'lonlarni bosh sahifada ko'ring.</p>
    <a href="https://elchi.org/">Bosh sahifaga qaytish →</a>
  </div>
</body>
</html>`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.postId === 'string' ? req.query.postId : null;
  await trackBotRequest(req, res, id ? `/post/${id}` : '/post');
  
  const respondWithDefault = () => {
    // HTML_SHELL already contains the default tags
    return res.setHeader('Content-Type', 'text/html; charset=utf-8').status(200).send(HTML_SHELL);
  };

  if (!id) {
    // Not a post page — serve the shell unchanged
    return respondWithDefault();
  }

  const { data } = await supabase
    .from('public_posts')
    .select('id, type, from_country, to_country, from_city, to_city, date, weight, note')
    .eq('id', id)
    .maybeSingle();

  if (!data) {
    // The view filters out expired rows, so null means either "never existed"
    // or "expired". A cheap PK lookup on the raw table tells us which.
    const admin = getSupabaseAdmin();
    const { data: row } = await admin.from('posts').select('id').eq('id', id).maybeSingle();
    if (row) {
      // Row exists but fell out of public_posts → expired.
      // 410 Gone tells crawlers the resource was intentionally removed; noindex
      // in the HTML is belt-and-suspenders for bots that ignore the status code.
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
      return res.status(410).send(EXPIRED_HTML);
    }
    // Truly does not exist.
    return res.setHeader('Content-Type', 'text/html; charset=utf-8').status(404).send(HTML_SHELL);
  }

  const from = COUNTRY_NAMES[data.from_country] ?? data.from_country;
  const to = COUNTRY_NAMES[data.to_country] ?? data.to_country;
  const typeLabel = data.type === 'traveler' ? "Yo'lovchi" : "Jo'natma";
  
  const title = `${typeLabel}: ${data.from_city ?? from} → ${data.to_city ?? to} | Elchi`;
  const desc = [data.weight, data.note].filter(Boolean).join(' · ').slice(0, 160)
    || `${from} → ${to} yo'nalishida e'lon`;
  const url = `https://elchi.org/post/${data.id}`;

  const titleStr = escHtml(title);
  const descStr = escAttr(desc);
  const urlStr = escAttr(url);

  let html = HTML_SHELL;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${titleStr}</title>`);
  html = html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/, `$1${urlStr}$2`);

  const replaceContent = (nameOrProperty: string, newValue: string) => {
    const regex = new RegExp(`(<meta\\s+(?:name|property)="${nameOrProperty}"\\s+content=")[^"]*(")`, 'g');
    html = html.replace(regex, `$1${newValue}$2`);
  };

  replaceContent('description', descStr);
  replaceContent('og:description', descStr);
  replaceContent('twitter:description', descStr);
  replaceContent('og:title', titleStr);
  replaceContent('twitter:title', titleStr);
  replaceContent('og:url', urlStr);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
  return res.status(200).send(html);
}

function escHtml(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s: string) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

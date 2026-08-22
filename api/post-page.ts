import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabase.js';
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.postId === 'string' ? req.query.postId : null;
  
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
    // Post not found or expired — serve the generic page
    return respondWithDefault();
  }

  const from = COUNTRY_NAMES[data.from_country] ?? data.from_country;
  const to = COUNTRY_NAMES[data.to_country] ?? data.to_country;
  const typeLabel = data.type === 'traveler' ? 'Uchish' : 'Pochta bor';
  
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
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
  return res.status(200).send(html);
}

function escHtml(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s: string) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

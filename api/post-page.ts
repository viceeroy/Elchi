import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabase.js';

// Inlined — same as src/constants.ts, but we can't import client code here.
const COUNTRY_NAMES: Record<string, string> = { KR: 'Koreya', UZ: "O'zbekiston" };

// We inline the HTML shell as a template string constant directly.
// This is exactly the content of index.html, but with placeholders injected.
const HTML_SHELL = `<!doctype html>
<html lang="uz">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400..900&family=Space+Mono:wght@400;700&display=swap"
    />
    <link rel="preconnect" href="https://oauth.telegram.org" crossorigin />
    <link rel="preload" href="https://telegram.org/js/telegram-widget.js?22" as="script" />

    <title>__META_TITLE__</title>
    <meta
      name="description"
      content="__META_DESCRIPTION__"
    />
    <meta
      name="keywords"
      content="pochta yuborish, chamadonda joy, sayohatda yordam, yuk tashish e'lonlari, hujjat yuborish, dori yuborish, sovg'a yuborish, elchi"
    />
    <meta name="theme-color" content="#1B2A4A" />
    <link rel="canonical" href="__META_URL__" />

    <link rel="alternate" hreflang="uz" href="https://elchi.org/" />
    <link rel="alternate" hreflang="x-default" href="https://elchi.org/" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Elchi" />
    <meta property="og:url" content="__META_URL__" />
    <meta property="og:title" content="__META_TITLE__" />
    <meta
      property="og:description"
      content="__META_DESCRIPTION__"
    />
    <meta property="og:image" content="https://elchi.org/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Elchi — chamadoningizda joy bormi?" />
    <meta property="og:locale" content="uz_UZ" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="__META_TITLE__" />
    <meta
      name="twitter:description"
      content="__META_DESCRIPTION__"
    />
    <meta name="twitter:image" content="https://elchi.org/og-image.png" />

    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Elchi",
        "url": "https://elchi.org/",
        "inLanguage": ["uz"],
        "description": "Sayohatchilar va pochta yubormoqchi bo'lganlarni bog'lovchi bepul e'lon taxtasi.",
        "publisher": {
          "@type": "Organization",
          "name": "Elchi",
          "url": "https://elchi.org/",
          "logo": "https://elchi.org/favicon.svg"
        }
      }
    </script>

  </head>
  <body>
    <div id="root"></div>

    <noscript>
      <h1>Elchi — chamadoningizda joy bormi?</h1>
      <p>
        Elchi — sayohatchilar va pochta yubormoqchi bo'lganlar uchun bepul e'lon
        taxtasi. Chamadoningizda bo'sh joy bo'lsa e'lon bering; hujjat, dori,
        kiyim yoki sovg'a yuborish kerak bo'lsa, yo'lda ketayotgan odamni toping.
        Elchi to'lov va yetkazib berishga aralashmaydi — foydalanuvchilar o'zaro
        bevosita kelishadi.
      </p>
      <p>Bepul e'lon taxtasi</p>
    </noscript>

    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.postId === 'string' ? req.query.postId : null;
  
  const defaultTitle = "Elchi — Chamadoningizda joy bormi? | Bepul e'lon taxtasi";
  const defaultDesc = "Elchi — sayohatchilar va pochta yubormoqchi bo'lganlarni bog'lovchi bepul e'lon taxtasi. Chamadoningizda bo'sh joy bo'lsa e'lon bering, yoki hujjat, dori, sovg'a yuborish uchun yo'lda ketayotgan odamni toping. Ro'yxatdan o'tish oson, to'lovsiz.";
  const defaultUrl = "https://elchi.org/";

  const respondWithDefault = () => {
    const html = HTML_SHELL
      .replace(/__META_TITLE__/g, escHtml(defaultTitle))
      .replace(/__META_DESCRIPTION__/g, escAttr(defaultDesc))
      .replace(/__META_URL__/g, escAttr(defaultUrl));
    return res.setHeader('Content-Type', 'text/html; charset=utf-8').status(200).send(html);
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

  const html = HTML_SHELL
    .replace(/__META_TITLE__/g, escHtml(title))
    .replace(/__META_DESCRIPTION__/g, escAttr(desc))
    .replace(/__META_URL__/g, escAttr(url));

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
  return res.status(200).send(html);
}

function escHtml(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s: string) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

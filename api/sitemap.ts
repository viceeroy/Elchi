import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { data, error } = await supabase
    .from('public_posts')
    .select('id, created_at')
    .in('type', ['traveler', 'request'])
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).send('Internal Server Error');
  }

  const urls = (data ?? []).map((row) =>
    `  <url>
    <loc>https://elchi.org/post/${row.id}</loc>
    <lastmod>${new Date(row.created_at).toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
  </url>`
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://elchi.org/</loc>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
${urls}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
  return res.status(200).send(xml);
}

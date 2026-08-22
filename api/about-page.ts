import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';

import { EXPLAINERS } from '../lib/explainers.js';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const title = "Elchi haqida — Bepul e'lon taxtasi";
  const desc = "Elchi platformasi haqida batafsil ma'lumot: u qanday ishlaydi, e'lon berish tartibi va xavfsizlik qoidalari.";
  const url = "https://elchi.org/about";

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

  // Generate plain visible HTML from EXPLAINERS for Googlebot
  let explainersHtml = '<div class="max-w-[680px] mx-auto px-5 py-8 flex flex-col gap-8">\n';
  explainersHtml += `<h1 class="text-3xl font-black text-ink mb-2">${titleStr}</h1>\n`;

  for (const explainer of EXPLAINERS) {
    const c = explainer.content.uz;
    explainersHtml += `<section class="bg-card border border-edge rounded-xl p-5 mb-6">\n`;
    explainersHtml += `<h2 class="text-2xl font-bold text-ink mb-3">${escHtml(c.title)}</h2>\n`;
    
    if (c.lead) {
      explainersHtml += `<p class="text-body leading-relaxed mb-4">${formatMarkup(c.lead)}</p>\n`;
    }
    
    if (c.points && c.points.length > 0) {
      explainersHtml += `<ul class="list-disc pl-5 mb-4 space-y-2">\n`;
      for (const pt of c.points) {
        explainersHtml += `<li class="text-body"><strong>${escHtml(pt.title)}:</strong> ${escHtml(pt.desc)}</li>\n`;
      }
      explainersHtml += `</ul>\n`;
    }

    if (c.typesList && c.typesList.length > 0) {
      explainersHtml += `<ul class="list-none mb-4 space-y-3">\n`;
      for (const type of c.typesList) {
        explainersHtml += `<li class="text-body bg-paper p-3 rounded-lg border border-edge/60"><strong>${escHtml(type.label)}:</strong> ${escHtml(type.text)}</li>\n`;
      }
      explainersHtml += `</ul>\n`;
    }

    if (c.flowSteps && c.flowSteps.length > 0) {
      explainersHtml += `<ol class="list-decimal pl-5 mb-4 space-y-2">\n`;
      for (const step of c.flowSteps) {
        explainersHtml += `<li class="text-body"><strong>${escHtml(step.title)}:</strong> ${escHtml(step.desc)}</li>\n`;
      }
      explainersHtml += `</ol>\n`;
    }

    if (c.tips && c.tips.length > 0) {
      explainersHtml += `<ul class="list-disc pl-5 mb-4 space-y-2">\n`;
      for (const tip of c.tips) {
        explainersHtml += `<li class="text-body"><strong>${escHtml(tip.title)}:</strong> ${escHtml(tip.desc)}</li>\n`;
      }
      explainersHtml += `</ul>\n`;
    }

    if (c.bullets && c.bullets.length > 0) {
      explainersHtml += `<ul class="list-disc pl-5 mb-4 space-y-2">\n`;
      for (const bullet of c.bullets) {
        explainersHtml += `<li class="text-body">${formatMarkup(bullet)}</li>\n`;
      }
      explainersHtml += `</ul>\n`;
    }

    if (c.note) {
      explainersHtml += `<div class="bg-paper p-3 rounded-lg border border-edge/60 text-body mt-2">${formatMarkup(c.note)}</div>\n`;
    }
    
    explainersHtml += `</section>\n`;
  }
  
  explainersHtml += '</div>';

  // Inject into <div id="root">
  html = html.replace('<div id="root"></div>', `<div id="root">\n${explainersHtml}\n</div>`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
  return res.status(200).send(html);
}

function escHtml(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s: string) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function formatMarkup(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map(part => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return `<strong>${escHtml(part.slice(2, -2))}</strong>`;
    }
    return escHtml(part);
  }).join('');
}

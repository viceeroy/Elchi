import fs from 'fs';
import path from 'path';

let HTML_SHELL = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

const titleStr = "NEW TITLE";
const descStr = "NEW DESC";
const urlStr = "https://elchi.org/post/123";

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

console.log(html);

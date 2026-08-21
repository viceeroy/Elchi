import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.resolve(__dirname, '../public/favicon.svg');
const out192 = path.resolve(__dirname, '../public/icon-192x192.png');
const out512 = path.resolve(__dirname, '../public/icon-512x512.png');
const outMaskable = path.resolve(__dirname, '../public/icon-maskable-512x512.png');

async function generateIcons() {
  try {
    await sharp(inputPath).resize(192, 192).toFile(out192);
    await sharp(inputPath).resize(512, 512).toFile(out512);

    // Maskable icon with solid background
    await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: '#EDE9DC'
      }
    })
      .composite([{ input: inputPath, blend: 'over' }])
      .toFile(outMaskable);

    console.log('Icons generated successfully.');
  } catch (err) {
    console.error('Error generating icons:', err);
  }
}

generateIcons();

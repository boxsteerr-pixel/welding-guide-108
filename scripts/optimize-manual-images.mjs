import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const root = new URL('../', import.meta.url);
const manual = JSON.parse(await fs.readFile(new URL('data/manual.json', root), 'utf8'));
const images = [...new Set([...manual.faults, ...manual.maintenance].flatMap(item => item.procedure || []).map(block => block.image).filter(Boolean))];
let original = 0, optimized = 0;
for (const file of images) {
  const input = new URL(file, root), output = new URL(file.replace(/\.png$/, '.webp'), root);
  const source = await fs.readFile(input);
  // Full original dimensions: no cropping, resizing, annotations or generated content.
  const result = await sharp(source).webp({ quality: 92, effort: 6 }).toBuffer();
  await fs.writeFile(output, result);
  const before = await sharp(source).metadata(), after = await sharp(result).metadata();
  if (before.width !== after.width || before.height !== after.height) throw Error('Dimensions changed: ' + file);
  original += source.length; optimized += result.length;
  console.log(`${file}: ${source.length} -> ${result.length} bytes (${before.width}x${before.height})`);
}
console.log(JSON.stringify({ images: images.length, originalMB: original / 1048576, optimizedMB: optimized / 1048576, reductionPercent: (1 - optimized / original) * 100 }));

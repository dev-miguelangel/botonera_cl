import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';

const svg = readFileSync('./icon.svg');
const outDir = './public/icons';
mkdirSync(outDir, { recursive: true });

const sizes = [
  { name: 'icon-72x72.png',   size: 72  },
  { name: 'icon-96x96.png',   size: 96  },
  { name: 'icon-128x128.png', size: 128 },
  { name: 'icon-144x144.png', size: 144 },
  { name: 'icon-152x152.png', size: 152 },
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-384x384.png', size: 384 },
  { name: 'icon-512x512.png', size: 512 },
];

// Maskable icon: same but with extra padding (safe zone = 40% of size)
const maskableSizes = [
  { name: 'icon-192x192-maskable.png', size: 192 },
  { name: 'icon-512x512-maskable.png', size: 512 },
];

for (const { name, size } of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(`${outDir}/${name}`);
  console.log(`✓ ${name}`);
}

// Maskable: render icon at 60% and pad with background color
for (const { name, size } of maskableSizes) {
  const iconSize = Math.round(size * 0.6);
  const pad = Math.round((size - iconSize) / 2);
  await sharp(svg)
    .resize(iconSize, iconSize)
    .png()
    .toBuffer()
    .then(buf =>
      sharp({
        create: {
          width: size, height: size,
          channels: 4,
          background: { r: 224, g: 240, b: 251, alpha: 1 }, // #E0F0FB
        },
      })
      .composite([{ input: buf, top: pad, left: pad }])
      .png()
      .toFile(`${outDir}/${name}`)
    );
  console.log(`✓ ${name} (maskable)`);
}

// Favicon 32x32 and 16x16
for (const size of [16, 32, 48]) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(`${outDir}/favicon-${size}x${size}.png`);
  console.log(`✓ favicon-${size}x${size}.png`);
}

console.log('\nDone! Icons in', outDir);

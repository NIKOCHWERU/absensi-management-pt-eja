import { Jimp } from 'jimp';

async function generate() {
  console.log("Reading logo...");
  const image1 = await Jimp.read('./client/public/logo_elok_buah.jpg');
  image1.resize({ w: 192, h: 192 });
  await image1.write('./client/public/pwa-192x192.png');
  
  const image2 = await Jimp.read('./client/public/logo_elok_buah.jpg');
  image2.resize({ w: 512, h: 512 });
  await image2.write('./client/public/pwa-512x512.png');
  
  console.log("Icons generated successfully.");
}

generate().catch(console.error);

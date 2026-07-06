import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generate() {
  const logoPath = 'C:/Users/chris/Desktop/adamic/images/adamic_logo/logo_1024x1024.png';
  let logoBase64 = '';
  try {
    const logoBuffer = readFileSync(logoPath);
    logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch (e) {
    console.error('Failed to read logo:', e);
    process.exit(1);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;500;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0; padding: 0; width: 1280px; height: 640px;
      background: radial-gradient(circle at 20% 30%, #1a1e29 0%, #11151e 50%, #080a0f 100%);
      font-family: 'Outfit', sans-serif; color: #ffffff;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      overflow: hidden; position: relative;
    }

    /* Vibrant Orbs */
    .glow-1 {
      position: absolute; top: -100px; left: -150px; width: 600px; height: 600px;
      /* MySQL Blue: #00758F or #E48E00. Let's use #00758F for glow 1 */
      background: radial-gradient(circle, rgba(0, 117, 143, 0.45) 0%, rgba(0, 117, 143, 0) 70%);
      filter: blur(80px); z-index: 1;
    }
    
    .glow-2 {
      position: absolute; bottom: -150px; right: -100px; width: 800px; height: 800px;
      /* Orange: #E48E00 */
      background: radial-gradient(circle, rgba(228, 142, 0, 0.2) 0%, rgba(228, 142, 0, 0) 70%);
      filter: blur(80px); z-index: 1;
    }

    .container {
      z-index: 10; display: flex; flex-direction: column; align-items: center; 
      text-align: center; width: 100%; padding: 40px; box-sizing: border-box;
    }

    .logo-container {
      margin-bottom: 24px; width: 120px; height: 120px; background: rgba(255, 255, 255, 0.03);
      border-radius: 28px; padding: 20px; backdrop-filter: blur(12px);
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.1);
      border: 1px solid rgba(255, 255, 255, 0.08); display: flex; align-items: center; justify-content: center;
    }

    .title {
      font-family: 'JetBrains Mono', monospace; font-size: 80px; font-weight: 700; 
      letter-spacing: -2px; margin: 0; background: linear-gradient(135deg, #ffffff 0%, #e2e8f0 40%, #94a3b8 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 1.1;
    }

    .subtitle { font-size: 28px; font-weight: 400; color: #cbd5e1; margin-top: 20px; max-width: 900px; }
    .highlight { color: #f97316; font-weight: 500; } /* Match OAuth orange for pop */

    .badges-container {
      display: flex; flex-direction: column; align-items: center; gap: 16px; margin-top: 36px; width: 100%;
    }

    .badges-row { display: flex; justify-content: center; gap: 16px; }

    .badge {
      background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 12px 20px; border-radius: 100px; font-size: 19px; color: #f1f5f9;
      display: flex; align-items: center; gap: 10px; backdrop-filter: blur(10px);
    }

    .badge-icon { width: 16px; height: 16px; border-radius: 50%; }
    
    /* 3-2 Grid Color Coding */
    .ts-badge .badge-icon { background: #3178c6; box-shadow: 0 0 12px #3178c6; }
    .oauth-badge .badge-icon { background: #f97316; box-shadow: 0 0 12px #f97316; }
    .tokens-badge .badge-icon { background: #3b82f6; box-shadow: 0 0 12px #3b82f6; }
    .transport-badge .badge-icon { background: #10b981; box-shadow: 0 0 12px #10b981; }
    .pool-badge .badge-icon { background: #8b5cf6; box-shadow: 0 0 12px #8b5cf6; }

    .grid {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background-size: 50px 50px;
      background-image: linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px);
    }
  </style>
</head>
<body>
  <div class="grid"></div>
  <div class="glow-1"></div>
  <div class="glow-2"></div>
  <div class="container">
    <div class="logo-container"><img src="${logoBase64}" style="width:100%; height:100%; object-fit:contain;"></div>
    <h1 class="title">mysql-mcp</h1>
    <h2 class="subtitle">200+ MySQL Tools in One <span class="highlight">Secure</span> Sandboxed Code Mode.</h2>
    
    <div class="badges-container">
      <!-- 3-2 Grid Layout (Top: 3, Bottom: 2) -->
      <div class="badges-row">
        <div class="badge ts-badge"><div class="badge-icon"></div> TypeScript Strict</div>
        <div class="badge transport-badge"><div class="badge-icon"></div> HTTP & SSE Transports</div>
        <div class="badge tokens-badge"><div class="badge-icon"></div> 90% Token Savings</div>
      </div>
      <div class="badges-row">
        <div class="badge pool-badge"><div class="badge-icon"></div> Connection Pooling</div>
        <div class="badge oauth-badge"><div class="badge-icon"></div> OAuth 2.1</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  const htmlPath = join(__dirname, '..', 'social-preview.html');
  writeFileSync(htmlPath, html);
  
  // Set up Playwright to generate the image
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000); // Allow fonts to load completely
  
  const imgPath = join(__dirname, '..', 'social-preview.png');
  await page.screenshot({ path: imgPath });
  await browser.close();
  
  console.log(`Generated preview at ${imgPath}`);
}

generate().catch(console.error);

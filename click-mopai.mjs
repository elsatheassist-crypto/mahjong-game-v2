import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// Connect to existing browser at localhost:5173 if available
// Otherwise create new browser
try {
  await page.goto('http://localhost:5173', { timeout: 5000 });
  console.log('Connected to existing browser at localhost:5173');
} catch {
  console.log('No existing browser, but continuing...');
}

// Click the 摸牌 button
const moPaiButton = page.locator('button:has-text("摸牌")');
const isVisible = await moPaiButton.isVisible();
console.log('摸牌 button visible:', isVisible);

if (isVisible) {
  await moPaiButton.click();
  console.log('Clicked 摸牌 button');
  
  // Wait a bit for the game state to update
  await page.waitForTimeout(1000);
  
  // Take a snapshot
  const snapshot = await page.locator('body').innerHTML();
  console.log('Page updated. Body content length:', snapshot.length);
  
  // Check wall count
  const wallText = await page.locator('text=牌牆').textContent();
  console.log('Wall status:', wallText);
} else {
  console.log('摸牌 button not found - game may have progressed');
}

// Take screenshot
await page.screenshot({ path: '.sisyphus/evidence/final-qa/task-f2-after-draw.png', fullPage: false });
console.log('Screenshot saved to .sisyphus/evidence/final-qa/task-f2-after-draw.png');

await browser.close();
console.log('Done');
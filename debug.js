const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
    console.log('PAGE ERROR STACK:', error.stack);
  });

  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(1000);
  
  // Click Portfolio tab
  const tabs = await page.$$('.tab-btn');
  for (const tab of tabs) {
    const text = await tab.innerText();
    if (text === 'Portfolio') {
      await tab.click();
      break;
    }
  }

  await page.waitForTimeout(2000);
  await browser.close();
})();

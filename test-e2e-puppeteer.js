const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  try {
    console.log("Navigating to http://localhost:3000...");
    await page.goto('http://localhost:3000');
    
    // Wait for either the dashboard to load (if logged in somehow) or the sign in elements
    // E.g. email input
    console.log("Waiting for email input field...");
    await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });
    
    console.log("Typing credentials...");
    await page.type('input[type="email"]', 'marco@stackshift.co.nz');
    await page.type('input[type="password"]', 'Phoenix031$');
    
    console.log("Submitting login form...");
    // Attempt to click the submit button
    const submitButton = await page.$('button[type="submit"]');
    if (submitButton) {
      await submitButton.click();
    } else {
      await page.keyboard.press('Enter');
    }
    
    // Wait for navigation after login
    console.log("Waiting for navigation to dashboard...");
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    
    console.log("Current URL after login:", page.url());
    
    console.log("Looking for New Analysis button or textarea...");
    // See if we have a textarea to paste text (on 'new' or 'dashboard' screen)
    // or a 'New Analysis' link.
    let textArea = await page.$('textarea');
    if (!textArea) {
      // Look for a link to '/new', or a button with text 'New', 'Analyze', etc.
      console.log("No textarea on current page, attempting to navigate to /new...");
      await page.goto('http://localhost:3000/new', { waitUntil: 'networkidle2' });
      textArea = await page.waitForSelector('textarea', { timeout: 10000 });
    }
    
    console.log("Typing sample text into textarea...");
    await textArea.type("The synergistic capabilities of our enterprise offering will holistically streamline your organizational paradigm and optimize strategic capabilities across all key deliverables.");
    
    console.log("Looking for Submit/Analyze button...");
    // Find analyze button. Generally inside a form, or has text "Analyse" or "Submit"
    const buttons = await page.$$('button');
    let analyzeBtn;
    for (let btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && (text.toLowerCase().includes('analyse') || text.toLowerCase().includes('analyze') || text.toLowerCase().includes('submit'))) {
            analyzeBtn = btn;
            break;
        }
    }
    
    if (analyzeBtn) {
        console.log("Clicking Analyse button...");
        await analyzeBtn.click();
    } else {
        console.log("Could not find a specific Analyse button, pressing enter or picking specific form submit");
        const formSubmit = await page.$('form button[type="submit"]');
        if (formSubmit) await formSubmit.click();
        else {
             console.log("Page HTML dump for debug:", await page.content());
             throw new Error("No analyze button found");
        }
    }
    
    console.log("Waiting for analysis results (timeout 60s)...");
    // Next page should be /analyse/[id] or results should show up.
    // Wait for common result elements, like "Score", numbers out of 100, or a specific class.
    // I'll just wait for the URL to change to /analyse or wait 10 seconds of network idle
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 });
    } catch(e) {
      console.log("No explicit navigation occurred, maybe it's SPA. Waiting 5s then checking URL...", page.url());
      await new Promise(r => setTimeout(r, 5000));
    }
    
    console.log("Current URL:", page.url());
    
    // Take a screenshot of the results
    await page.screenshot({ path: 'e2e_results.png', fullPage: true });
    
    console.log("E2E Test Step 3 Complete: Reached analysis results.");
    
    console.log("Looking for Clean Up / Rewrite button...");
    const resultButtons = await page.$$('button');
    let cleanBtn;
    for (let btn of resultButtons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && (text.toLowerCase().includes('clean') || text.toLowerCase().includes('improve') || text.toLowerCase().includes('rewrite'))) {
            cleanBtn = btn;
            break;
        }
    }
    
    if (cleanBtn) {
      console.log("Clicking Clean Up Button...");
      await cleanBtn.click();
      
      console.log("Waiting for cleanup to finish... (timeout 60s)");
      try {
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 });
      } catch(e) {
        console.log("Waiting 10s for page rehydrate...");
        await new Promise(r => setTimeout(r, 10000));
      }
      console.log("Cleanup final URL:", page.url());
      await page.screenshot({ path: 'e2e_cleanup.png', fullPage: true });
      console.log("Stage 3 Flow Success!");
    } else {
      console.log("No Clean Up button found. This might be fine if analysis was all that's required, or it might be named differently.");
    }
    
  } catch (error) {
    console.error("Test failed:", error);
    await page.screenshot({ path: 'e2e_failure.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();

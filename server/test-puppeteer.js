const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        await page.goto('https://example.com');
        console.log('Puppeteer works!');
        await browser.close();
    } catch (e) {
        console.error('Puppeteer Failed:', e);
    }
})();

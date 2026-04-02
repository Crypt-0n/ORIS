const puppeteer = require('puppeteer');

(async () => {
    try {
        console.log('Testing puppeteer launch...');
        console.log('Executable path env:', process.env.PUPPETEER_EXECUTABLE_PATH);
        const browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        console.log('Puppeteer launched successfully.');
        const page = await browser.newPage();
        await page.goto('https://example.com');
        console.log('Puppeteer navigated to example.com successfully!');
        await browser.close();
        process.exit(0);
    } catch (e) {
        console.error('Puppeteer Failed:', e);
        process.exit(1);
    }
})();

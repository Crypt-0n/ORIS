import { AuthenticatedRequest } from '../types';
import express, { Request, Response } from 'express';
import puppeteer from 'puppeteer';
import authenticateToken from '../middleware/auth';
import { canAccessCase } from '../utils/access';
import { ReportService } from '../services/ReportService';

const router = express.Router();
router.use(authenticateToken);

router.get('/case/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const caseId = (req.params.id as string);
        if (!await canAccessCase(req.user.id, caseId)) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        const data = await ReportService.getCaseReportData(caseId);
        res.json(data);
    } catch (err: any) {
        console.error('Reports error:', err.message, err);
        if (err.message === 'Case not found') {
            res.status(404).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

router.get('/export/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const caseId = (req.params.id as string);
        if (!await canAccessCase(req.user.id, caseId)) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        const { type = 'full', date, weeks, lng = 'fr' } = req.query;
        // Construct the URL to the frontend print view
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        let targetUrl = `${baseUrl}/print/case/${caseId}?type=${type}&lng=${lng}`;
        if (date) targetUrl += `&date=${date}`;
        if (weeks) targetUrl += `&weeks=${weeks}`;

        const browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();

        let jwtCookie = req.cookies?.oris_jwt;
        if (!jwtCookie && req.headers.authorization?.startsWith('Bearer ')) {
            jwtCookie = req.headers.authorization.substring(7);
        }

        if (jwtCookie) {
            const parsedUrl = new URL(baseUrl);
            await page.setCookie({
                name: 'oris_jwt',
                value: jwtCookie,
                domain: parsedUrl.hostname,
            });
            await page.setCookie({
                name: 'oris_jwt',
                value: jwtCookie,
                domain: 'localhost',
            });
        }

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for rendering to complete (to catch complex SVGs)
        try {
            await page.waitForSelector('#oris-print-ready', { timeout: 30000 });
            // Add a brief pause for SVGs to render fully on screen after mounting
            await new Promise(r => setTimeout(r, 1500));
        } catch(e) {
            console.warn('Timeout waiting for print-ready selector, proceeding with PDF capture anyway.');
        }

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                bottom: '10mm',
                left: '10mm',
                right: '10mm'
            }
        });

        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Incident_Report_${caseId}.pdf`);
        res.send(Buffer.from(pdfBuffer));
    } catch (err: any) {
        console.error('PDF Export Error:', err);
        res.status(500).json({ error: 'Failed to generate PDF', details: err.message });
    }
});

module.exports = router;

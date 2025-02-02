import express from 'express';
import bodyParser from 'body-parser';
import sql from '../database/db.js';
import rateLimit from 'express-rate-limit';
import { nanoid } from 'nanoid';
import { user_email } from '../auth.js';
import { getOS, getDeviceType } from '../config.js';
import client from '../redis.js';

const router = express.Router();
const urlDatabase = {};

router.use(bodyParser.json({ urlencoded: true }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many requests, please try again after 15 minutes.'
});

/**
 * @swagger
 * /api/shorten:
 *   post:
 *     summary: Shorten a URL
 *     description: Create a short URL for the given long URL.
 *     tags: [URL Shortener]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 description: The long URL to be shortened.
 *               customAlias:
 *                 type: string
 *                 description: Custom alias for the short URL.
 *               topic:
 *                 type: string
 *                 description: The topic of the short URL.
 *     responses:
 *       201:
 *         description: Short URL created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 shortUrl:
 *                   type: string
 *                 created_at:
 *                   type: string
 *       400:
 *         description: Bad request.
 */
router.post('/shorten', limiter, async (req, res) => {
    const { url, customAlias, topic } = req.body;
    let id = customAlias;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }
    if (!customAlias) {
        id = nanoid(8);
    }
    urlDatabase[id] = url;
    try {
        await sql`INSERT INTO urlshortener.url_data(alias, originalurl, created_by, topic) VALUES(${id}, ${url}, ${user_email}, ${topic})`;
        await client.set(id, url); // Cache the short URL
        await client.set(url, id); // Cache the long URL
    } catch (error) {
        return res.status(400).json({ error: 'Same name alias already exists' });
    }
    res.status(201).json({ id, shortUrl: `http://localhost:3000/urls/${id}`, originalUrl: url });
});

/**
 * @swagger
 * /api/shorten/{alias}:
 *   get:
 *     summary: Redirect to the original URL
 *     description: Redirect to the original URL based on the short URL alias.
 *     tags: [URL Shortener]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: alias
 *         schema:
 *           type: string
 *         required: true
 *         description: The alias of the short URL.
 *     responses:
 *       302:
 *         description: Redirect to the original URL.
 *       404:
 *         description: Alias not found.
 */
router.get('/shorten/:alias', async (req, res) => {
    const { alias } = req.params;
    try {
        let originalUrl = await client.get(alias); // Check cache first
        if (!originalUrl) {
            const result = await sql`SELECT originalurl FROM urlshortener.url_data WHERE alias = ${alias}`;
            if (result.length === 0) {
                return res.status(404).json({ error: 'Alias not found' });
            }
            originalUrl = result[0].originalurl;
            await client.set(alias, originalUrl); // Cache the result
        }

        const timestamp = new Date().toISOString();
        const userAgent = req.headers['user-agent'];
        const ipAddress = req.ip;
        const osType = getOS(userAgent);
        const deviceType = getDeviceType(userAgent);
        // Geolocation data can be obtained using an external API, e.g., ipstack or ipinfo
        // For simplicity, we'll just log the IP address here
        console.log(`Redirect event: ${timestamp}, ${userAgent}, ${ipAddress}`);

        await sql`INSERT INTO urlshortener.analytics(alias, timestamp, user_agent, ip_address, os_name, device_type) VALUES(${alias}, ${timestamp}, ${userAgent}, ${ipAddress}, ${osType}, ${deviceType})`;
        res.redirect(originalUrl);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
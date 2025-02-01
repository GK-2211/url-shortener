import express from 'express';
import bodyParser from 'body-parser';
import sql from '../database/db.js';
import { getAsync, setAsync } from '../redis.js';
import { nanoid } from 'nanoid';
import {user_email, token } from '../auth.js';
import { getOS, getDeviceType, limiter } from '../config.js';

const router = express.Router();

router.use(bodyParser.json({ urlencoded: true }));

router.post('/shorten', async (req, res) => {
    let queryResult;
    if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.redirect('/auth/google');
    }
    const { url, customAlias, topic } = req.body;
    let id = customAlias;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }
    if (!customAlias) {
        id = nanoid(8);
    }
    try {
        queryResult = await sql`INSERT INTO urlshortener.url_data(alias, originalurl, created_by, topic) VALUES(${id}, ${url}, ${user_email}, ${topic}) Returning *`;
    } catch (error) {
        return res.status(400).json({ error: 'Same name alias already exists' });
    }
    res.status(201).json({ shortUrl: `http://localhost:3000/urls/${id}`, created_at: queryResult[0].created_at});
});

router.get('/shorten/:alias', async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.redirect('/auth/google');
    }
    const { alias } = req.params;
    try {

            const result = await sql`SELECT originalurl FROM urlshortener.url_data WHERE alias = ${alias}`;
            if (result.length === 0) {
                return res.status(404).json({ error: 'Alias not found' });
            }
           const originalUrl = result[0].originalurl;

        const timestamp = new Date().toISOString();
        const userAgent = req.headers['user-agent'];
        const ipAddress = req.ip;
        const osType = getOS(userAgent);
        const deviceType = getDeviceType(userAgent);

        await sql`INSERT INTO urlshortener.analytics(alias, timestamp, user_agent, ip_address, os_name, device_type) VALUES(${alias}, ${timestamp}, ${userAgent}, ${ipAddress}, ${osType}, ${deviceType})`;
        res.redirect(originalUrl);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
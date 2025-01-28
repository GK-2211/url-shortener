import express from 'express';
import bodyParser from 'body-parser'; 
import sql from '../database/db.js'
import rateLimit from 'express-rate-limit';
import {getAsync, setAsync} from '../redis.js'

import { nanoid } from 'nanoid';



const router=express.Router();
const urlDatabase = {};


router.use(bodyParser.json({urlencoded:true}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many requests, please try again after 15 minutes.'
});

function getOS(userAgent) {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
    return 'Unknown';
}

function getDeviceType(userAgent) {
    if (userAgent.includes('Mobi')) return 'Mobile';
    return 'Desktop';
}


router.post('/shorten', limiter,  async (req, res) => {
    
    const { url, customAlias } = req.body;
    let id = customAlias;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }
    if(!customAlias) {
        id = nanoid(8);
    }
    urlDatabase[id] = url;
    try {
        await sql`INSERT INTO urlshortener.url_data(alias, originalurl) VALUES(${id}, ${url})`;
        await setAsync(id, url);
    } catch (error) {
        return res.status(400).json({ error: 'Same name alias already exists' });
    }
    res.status(201).json({ id, shortUrl: `http://localhost:3000/urls/${id}`, originalUrl:  url});
});

router.get('/shorten/:alias', async (req, res) => {
    const { alias } = req.params;
    try {
        let originalUrl = await getAsync(alias);
        if (!originalUrl) {
            const result = await sql`SELECT originalurl FROM urlshortener.url_data WHERE alias = ${alias}`;
            if (result.length === 0) {
                return res.status(404).json({ error: 'Alias not found' });
            }
            originalUrl = result[0].originalurl;
            await setAsync(alias, originalUrl);
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
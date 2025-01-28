import express from 'express';
import bodyParser from 'body-parser'; 
import sql from '../database/db.js'
import {getAsync, setAsync} from '../redis.js'


const router=express.Router();


router.use(bodyParser.json({urlencoded:true}));


router.get('/analytics/:alias', async (req, res) => {
    const { alias } = req.params;
    try {
        let cachedAnalytics = await getAsync(`analytics:${alias}`);
        if (cachedAnalytics) {
            return res.json(JSON.parse(cachedAnalytics));
        }

        const totalClicksResult = await sql`SELECT COUNT(*) AS totalClicks FROM urlshortener.analytics WHERE alias = ${alias}`;
        const uniqueUsersResult = await sql`SELECT COUNT(DISTINCT ip_address) AS uniqueUsers FROM urlshortener.analytics WHERE alias = ${alias}`;
        const clicksByDateResult = await sql`
            SELECT DATE(timestamp) AS date, COUNT(*) AS clickCount
            FROM urlshortener.analytics
            WHERE alias = ${alias} AND timestamp >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(timestamp)
            ORDER BY DATE(timestamp) DESC
        `;
        const osTypeResult = await sql`
            SELECT os_name AS osName, COUNT(*) AS uniqueClicks, COUNT(DISTINCT ip_address) AS uniqueUsers
            FROM urlshortener.analytics
            WHERE alias = ${alias}
            GROUP BY os_name
        `;
        const deviceTypeResult = await sql`
            SELECT device_type AS deviceName, COUNT(*) AS uniqueClicks, COUNT(DISTINCT ip_address) AS uniqueUsers
            FROM urlshortener.analytics
            WHERE alias = ${alias}
            GROUP BY device_type
        `;

        const totalClicks = totalClicksResult[0].totalclicks;
        const uniqueUsers = uniqueUsersResult[0].uniqueusers;
        const clicksByDate = clicksByDateResult.map(row => ({
            date: row.date,
            clickCount: row.clickcount
        }));
        const osType = osTypeResult.map(row => ({
            osName: row.osname,
            uniqueClicks: row.uniqueclicks,
            uniqueUsers: row.uniqueusers
        }));
        const deviceType = deviceTypeResult.map(row => ({
            deviceName: row.devicename,
            uniqueClicks: row.uniqueclicks,
            uniqueUsers: row.uniqueusers
        }));
        const analyticsData = {
            totalClicks,
            uniqueUsers,
            clicksByDate,
            osType,
            deviceType
        };
        await setAsync(`analytics:${alias}`, JSON.stringify(analyticsData), 'EX', 60 * 60);

        res.json(analyticsData);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
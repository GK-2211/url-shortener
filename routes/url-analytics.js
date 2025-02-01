import express from 'express';
import bodyParser from 'body-parser';
import sql from '../database/db.js';
import { user_email } from '../auth.js';

const router = express.Router();

router.use(bodyParser.json({ urlencoded: true }));

/**
 * @swagger
 * /analytics:
 *   get:
 *     summary: Get analytics for a specific alias
 *     description: Retrieve analytics for a specific alias.
 *     tags: [URL Analytics]
 *     responses:
 *       200:
 *         description: Analytics data retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalClicks:
 *                   type: number
 *                 uniqueUsers:
 *                   type: number
 *                 clicksByDate:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                       clickCount:
 *                         type: number
 *                 osType:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       osName:
 *                         type: string
 *                       uniqueClicks:
 *                         type: number
 *                       uniqueUsers:
 *                         type: number
 *                 deviceType:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       deviceName:
 *                         type: string
 *                       uniqueClicks:
 *                         type: number
 *                       uniqueUsers:
 *                         type: number
 *       500:
 *         description: Internal server error.
 */
router.get('/analytics', async (req, res) => {
    const alias = '6kEe1kQ4';
    try {
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

        res.json(analyticsData);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /analytics/topic/{topic}:
 *   get:
 *     summary: Retrieve analytics for all short URLs grouped under a specific topic.
 *     description: Retrieve analytics for all short URLs grouped under a specific topic, allowing users to assess the performance of their links based on categories.
 *     tags: [URL Analytics]
 *     parameters:
 *       - in: path
 *         name: topic
 *         schema:
 *           type: string
 *         required: true
 *         description: The topic of the short URLs.
 *     responses:
 *       200:
 *         description: Analytics data retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalClicks:
 *                   type: number
 *                 uniqueUsers:
 *                   type: number
 *                 clicksByDate:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                       clickCount:
 *                         type: number
 *                 urls:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       shortUrl:
 *                         type: string
 *                       totalClicks:
 *                         type: number
 *                       uniqueUsers:
 *                         type: number
 *       404:
 *         description: Topic not found.
 *       500:
 *         description: Internal server error.
 */
router.get('/analytics/topic/:topic', async (req, res) => {
    const { topic } = req.params;
    try {
        const totalClicksResult = await sql`
            SELECT COUNT(*) AS totalClicks
            FROM urlshortener.analytics
            WHERE alias IN (
                SELECT alias
                FROM urlshortener.url_data
                WHERE topic = ${topic}
            )
        `;
        const uniqueUsersResult = await sql`
            SELECT COUNT(DISTINCT ip_address) AS uniqueUsers
            FROM urlshortener.analytics
            WHERE alias IN (
                SELECT alias
                FROM urlshortener.url_data
                WHERE topic = ${topic}
            )
        `;
        const clicksByDateResult = await sql`
            SELECT DATE(timestamp) AS date, COUNT(*) AS clickCount
            FROM urlshortener.analytics
            WHERE alias IN (
                SELECT alias
                FROM urlshortener.url_data
                WHERE topic = ${topic}
            ) AND timestamp >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(timestamp)
            ORDER BY DATE(timestamp) DESC
        `;
        const urlsResult = await sql`
            SELECT alias, COUNT(*) AS totalClicks, COUNT(DISTINCT ip_address) AS uniqueUsers
            FROM urlshortener.analytics
            WHERE alias IN (
                SELECT alias
                FROM urlshortener.url_data
                WHERE topic = ${topic}
            )
            GROUP BY alias
        `;

        const totalClicks = totalClicksResult[0].totalclicks;
        const uniqueUsers = uniqueUsersResult[0].uniqueusers;
        const clicksByDate = clicksByDateResult.map(row => ({
            date: row.date,
            clickCount: row.clickcount
        }));
        const urls = urlsResult.map(row => ({
            shortUrl: `http://localhost:3000/urls/${row.alias}`,
            totalClicks: row.totalclicks,
            uniqueUsers: row.uniqueusers
        }));

        const analyticsData = {
            totalClicks,
            uniqueUsers,
            clicksByDate,
            urls
        };

        res.json(analyticsData);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /analytics/overall:
 *   get:
 *     summary: Retrieve overall analytics for all short URLs created by the authenticated user.
 *     description: Retrieve overall analytics for all short URLs created by the authenticated user, providing a comprehensive view of their link performance.
 *     tags: [URL Analytics]
 *     responses:
 *       200:
 *         description: Analytics data retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalUrls:
 *                   type: number
 *                 totalClicks:
 *                   type: number
 *                 uniqueUsers:
 *                   type: number
 *                 clicksByDate:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                       clickCount:
 *                         type: number
 *                 osType:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       osName:
 *                         type: string
 *                         uniqueClicks:
 *                         type: number
 *                         uniqueUsers:
 *                         type: number
 *                 deviceType:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       deviceName:
 *                         type: string
 *                         uniqueClicks:
 *                         type: number
 *                         uniqueUsers:
 *                         type: number
 *       401:
 *         description: Unauthorized.
 *       500:
 *         description: Internal server error.
 */
router.get('/analytics/overall', async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.redirect('/auth/google');
    }
    try {
        const totalUrlsResult = await sql`
            SELECT COUNT(*) AS totalUrls
            FROM urlshortener.url_data
            WHERE created_by = ${user_email}
        `;
        const totalClicksResult = await sql`
            SELECT COUNT(*) AS totalClicks
            FROM urlshortener.analytics
            WHERE alias IN (
                SELECT alias
                FROM urlshortener.url_data
                WHERE created_by = ${user_email}
            )
        `;
        const uniqueUsersResult = await sql`
            SELECT COUNT(DISTINCT ip_address) AS uniqueUsers
            FROM urlshortener.analytics
            WHERE alias IN (
                SELECT alias
                FROM urlshortener.url_data
                WHERE created_by = ${user_email}
            )
        `;
        const clicksByDateResult = await sql`
            SELECT DATE(timestamp) AS date, COUNT(*) AS clickCount
            FROM urlshortener.analytics
            WHERE alias IN (
                SELECT alias
                FROM urlshortener.url_data
                WHERE created_by = ${user_email}
            ) AND timestamp >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(timestamp)
            ORDER BY DATE(timestamp) DESC
        `;
        const osTypeResult = await sql`
            SELECT os_name AS osName, COUNT(*) AS uniqueClicks, COUNT(DISTINCT ip_address) AS uniqueUsers
            FROM urlshortener.analytics
            WHERE alias IN (
                SELECT alias
                FROM urlshortener.url_data
                WHERE created_by = ${user_email}
            )
            GROUP BY os_name
        `;
        const deviceTypeResult = await sql`
            SELECT device_type AS deviceName, COUNT(*) AS uniqueClicks, COUNT(DISTINCT ip_address) AS uniqueUsers
            FROM urlshortener.analytics
            WHERE alias IN (
                SELECT alias
                FROM urlshortener.url_data
                WHERE created_by = ${user_email}
            )
            GROUP BY device_type
        `;

        const totalUrls = totalUrlsResult[0].totalurls;
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
            totalUrls,
            totalClicks,
            uniqueUsers,
            clicksByDate,
            osType,
            deviceType
        };

        res.json(analyticsData);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
import { createClient } from 'redis';
import dotenv from 'dotenv';


dotenv.config();

const client = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    }
});

const connectRedis = async () => {
    await client.connect();
    console.log("Connected to Redis Cloud");

};

connectRedis();

export default client;


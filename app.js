import express from 'express';
import urlDataRoutes from './routes/url-data.js';
import urlAnalyticsRoutes from './routes/url-analytics.js';
import { authApp } from './auth.js';
import swaggerRouter from './swagger.js';


const app = express();

app.use(authApp);

app.get('/', (req, res) => {
    res.redirect('auth/google');
});

app.use('/', urlDataRoutes);
app.use('/', urlAnalyticsRoutes);
app.use(swaggerRouter);


app.listen(3000, () => {
    console.log(`Running on PORT 3000`);
});

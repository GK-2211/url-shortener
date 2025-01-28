import express from 'express';
import urlDataRoutes from './routes/url-data.js';
import urlAnalyticsRoutes from './routes/url-analytics.js';

// import db from './database/db.js'






const app = express();

app.get('/', (req, res) => {
    res.send('GeeksforGeeks');
})


app.listen(3000, () => {
    console.log(`Running on PORT 3000`);
})



app.use('/', urlDataRoutes);
app.use('/', urlAnalyticsRoutes);


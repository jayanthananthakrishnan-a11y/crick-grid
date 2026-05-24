const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const sessionsRouter = require('./routes/sessions');
const ballsRouter = require('./routes/balls');
const analyticsRouter = require('./routes/analytics');
const fieldsRouter = require('./routes/fields');
const scoringRouter = require('./routes/scoring');
const videosRouter = require('./routes/videos');
const clipsRouter = require('./routes/clips');
const reviewsRouter = require('./routes/reviews');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/sessions', sessionsRouter);
app.use('/api/balls', ballsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/fields', fieldsRouter);
app.use('/api/scoring', scoringRouter);
app.use('/api/videos', videosRouter);
app.use('/api/clips', clipsRouter);
app.use('/api/reviews', reviewsRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Cricket API running on port ${PORT}`));
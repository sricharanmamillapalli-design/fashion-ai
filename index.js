const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const analyseRoutes = require('./routes/analyse');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for rate limiting if behind a reverse proxy (e.g. Vercel/Railway)
app.set('trust proxy', 1);

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

// Middleware
app.use(express.json()); // Parse JSON bodies

// CORS Configuration
const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Only serve static files locally. Vercel handles /public via vercel.json rewrites.
if (!isProduction) {
    app.use(express.static(path.join(__dirname, '../public')));
}

// Rate Limiting — Disabled in production/serverless to avoid invocation overhead
if (!isProduction) {
    const limiter = rateLimit({
        windowMs: 60 * 1000,
        max: 30,
        message: 'Too many requests'
    });
    app.use(limiter);
}

// API Routes
app.use('/api/analyse', analyseRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', gemini: !!process.env.GEMINI_API_KEY });
});

// Start Server (Only if not running in Vercel)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`StyleAI Server running on port ${PORT}`);
  });
}

// Export for Vercel Serverless Functions
module.exports = app;

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Security headers. Force HTTPS behind a proxy in production.
app.use(helmet());
app.use((req, res, next) => {
  if (config.isProd && req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (config.clientOrigin.includes(origin)) return callback(null, true);
    const hasVercelOrigin = config.clientOrigin.some((o) => o.includes('.vercel.app'));
    if (hasVercelOrigin && /\.vercel\.app$/.test(new URL(origin).hostname)) {
      return callback(null, true);
    }
    if (!config.isProd && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }
    callback(new Error(`Origin ${origin} blocked by CORS policy`));
  },
  credentials: true,
  exposedHeaders: ['X-Refresh-Token']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// 1. Intercept temporary try-on images with strict authentication & ownership checks
const { authenticate } = require('./middleware/auth');
app.use(`/${config.storage.uploadDir}/tryon-temp`, authenticate, (req, res) => {
  const filename = path.basename(req.path);
  const match = filename.match(/^tryon_(\d+)__[a-f0-9-]+\.(jpg|jpeg|png|webp)$/i);
  if (!match) {
    return res.status(400).json({ error: { message: 'Invalid temporary image identifier.' } });
  }

  const ownerId = match[1];
  if (req.user.role !== 'admin' && String(req.user.id) !== String(ownerId)) {
    return res.status(403).json({ error: { message: 'Access denied: You do not own this temporary image.' } });
  }

  const baseDir = path.resolve(process.cwd(), config.storage.uploadDir, 'tryon-temp');
  const filePath = path.resolve(baseDir, filename);

  if (!filePath.startsWith(baseDir)) {
    return res.status(403).json({ error: { message: 'Invalid path traversal detected.' } });
  }

  res.set({
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff'
  });

  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: { message: 'Temporary image not found or expired.' } });
    }
  });
});

// 2. Serve public permanent uploads (e.g. products, categories)
app.use(`/${config.storage.uploadDir}`, express.static(path.join(process.cwd(), config.storage.uploadDir)));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/returns', require('./routes/returns'));
app.use('/api/tryon', require('./routes/tryon'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/payments', require('./routes/payments'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;

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

app.use(cors({ origin: config.clientOrigin, credentials: true, exposedHeaders: ['X-Refresh-Token'] }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve locally stored uploads (dev storage driver).
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

app.use(notFound);
app.use(errorHandler);

module.exports = app;

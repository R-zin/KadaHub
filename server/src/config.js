require('dotenv').config();

const bool = (v, fallback = false) =>
  v === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());

module.exports = {
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 4000),

  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/kadahub',
  // Supabase (and most managed Postgres) require TLS. Allow opting out locally.
  dbSsl: bool(process.env.DB_SSL, true),

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-insecure-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m'
  },
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 10),

  clientOrigin: (process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173,http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    uploadDir: process.env.UPLOAD_DIR || 'uploads'
  },
  payment: {
    driver: process.env.PAYMENT_DRIVER || 'mock',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    currency: (process.env.STRIPE_CURRENCY || 'usd').toLowerCase()
  },
  tryOn: { driver: process.env.TRYON_DRIVER || 'mock' },
  notifications: { driver: process.env.NOTIFICATION_DRIVER || 'console' }
};

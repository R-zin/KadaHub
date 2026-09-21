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

  clientOrigin: [
    ...(process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173,http://localhost:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL.trim()] : [])
  ],

  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    supabaseBucket: process.env.SUPABASE_STORAGE_BUCKET || 'product-images'
  },
  payment: {
    driver: process.env.PAYMENT_DRIVER || 'mock',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
    currency: (process.env.PAYMENT_CURRENCY || 'inr').toLowerCase(),
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || ''
  },
  tryOn: {
    driver: process.env.TRYON_DRIVER || 'mock',
    // Modal-hosted IDM-VTON endpoint (see modal/tryon_app.py)
    modalUrl: process.env.TRYON_MODAL_URL || '',
    modalToken: process.env.TRYON_API_TOKEN || '',
    // Inference tuning for the Modal driver
    steps: Number(process.env.TRYON_STEPS || 30),
    timeoutMs: Number(process.env.TRYON_TIMEOUT_MS || 180000)
  },
  notifications: { driver: process.env.NOTIFICATION_DRIVER || 'console' }
};

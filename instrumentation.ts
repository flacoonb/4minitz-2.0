export async function register() {
  // Validate required environment variables at startup
  const required = ['JWT_SECRET', 'MONGODB_URI'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      'Please define them in your .env.local file.'
    );
  }

  // Warn about optional but recommended variables
  const recommended = ['ENCRYPTION_SECRET', 'CRON_SECRET'];
  const missingRecommended = recommended.filter((key) => !process.env[key]);
  if (missingRecommended.length > 0) {
    console.warn(
      `[WARN] Missing recommended environment variables: ${missingRecommended.join(', ')}`
    );
  }
}

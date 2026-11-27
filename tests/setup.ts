// Deterministic, test-only configuration. Never point these at production services.
process.env.NEXTAUTH_SECRET ??= "test-secret-do-not-use-in-production-0123456789";
process.env.SIGNUP_BONUS_CREDITS ??= "25";
delete process.env.SMTP_HOST;
delete process.env.OPENAI_API_KEY;
delete process.env.RAZORPAY_KEY_ID;
delete process.env.RAZORPAY_KEY_SECRET;

// Integration tests use TEST_MONGODB_URI (never the app's MONGODB_URI).
if (process.env.TEST_MONGODB_URI) {
  process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;
} else {
  delete process.env.MONGODB_URI;
  delete process.env.MONGODB_URL;
}

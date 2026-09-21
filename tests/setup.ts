import "dotenv/config";

// Integration tests use a separate database so development data is never touched.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

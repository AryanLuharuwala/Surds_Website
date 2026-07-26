/* Shared Neon Postgres client.
   Uses Neon's serverless HTTP driver, which works both locally (Node) and in Vercel
   serverless/edge functions. Credentials come from DATABASE_URL (see .env / Vercel env). */
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set (add it to .env locally / Vercel project env)');
}

const sql = neon(process.env.DATABASE_URL);

module.exports = { sql };

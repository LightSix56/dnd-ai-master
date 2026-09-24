const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
const dbUrl = process.env.DATABASE_URL || '';
const isPostgres = isVercel || dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');

if (isPostgres) {
  // Ensure postgresql provider for Vercel / production Supabase
  schema = schema.replace(
    /datasource db \{[\s\S]*?\}/,
    `datasource db {\n  provider  = "postgresql"\n  url       = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")\n}`
  );
} else {
  // Ensure sqlite provider for local development & vitest suite
  schema = schema.replace(
    /datasource db \{[\s\S]*?\}/,
    `datasource db {\n  provider = "sqlite"\n  url      = env("DATABASE_URL")\n}`
  );
}

fs.writeFileSync(schemaPath, schema, 'utf8');
console.log(`[Prisma Schema] Configured datasource provider for ${isPostgres ? 'PostgreSQL (Vercel/Production)' : 'SQLite (Local Dev)'}`);

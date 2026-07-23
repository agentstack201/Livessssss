const { Sequelize } = require("sequelize");
require("dotenv").config();

// Pre-load pg to ensure it's available for Sequelize
try {
  require('pg');
  console.log('✅ pg package found');
} catch (error) {
  console.error('❌ pg package not found:', error.message);
  throw new Error('pg package is required but not installed');
}

// Shared options for both connection styles.
// Neon requires SSL; rejectUnauthorized:false accepts Neon's managed cert.
const commonOptions = {
  dialect: 'postgres',
  dialectModule: require('pg'), // Explicitly provide pg module
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  },
  logging: false,
};

let sequelize;

if (process.env.DATABASE_URL) {
  // Preferred for Neon: a single connection string, e.g.
  //   postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
  // Use the POOLED endpoint (host contains "-pooler") for serverless/many connections.
  console.log('🔗 Connecting via DATABASE_URL (Neon)');
  sequelize = new Sequelize(process.env.DATABASE_URL, commonOptions);
} else {
  // Fallback: individual variables (DB_HOST / DB_USER / DB_PASSWORD / DB_NAME / DB_PORT).
  console.log('🔗 Connecting via individual DB_* variables');
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER || process.env.DB_USERNAME,
    process.env.DB_PASSWORD,
    {
      ...commonOptions,
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 5432,
    }
  );
}

module.exports = sequelize;

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

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER || process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    dialect: 'postgres',
    dialectModule: require('pg'), // Explicitly provide pg module
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false,
  }
);

module.exports = sequelize;

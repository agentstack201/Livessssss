const sequelize = require('../config/database');
const Country = require('../models/countries.model');

async function addDefaultCountry() {
  try {
    await sequelize.sync();
    console.log('✅ Database connected');

    // Check if country with id=1 exists
    const existingCountry = await Country.findOne({ where: { id: 1 } });

    if (!existingCountry) {
      // Create default country (Saudi Arabia)
      await Country.create({
        id: 1,
        country_name_en: 'Saudi Arabia',
        country_name_ar: 'السعودية'
      });
      console.log('✅ Default country (Saudi Arabia) added');
    } else {
      console.log('✅ Default country already exists');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addDefaultCountry();

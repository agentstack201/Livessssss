const bcrypt = require('bcrypt');
const sequelize = require('../config/database');
const User = require('../models/user.model');

async function createAdminUser() {
  try {
    // Connect to database
    await sequelize.sync();
    console.log('✅ Database connected');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ 
      where: { email: 'simo@seha.sa' } 
    });

    // if (existingAdmin) {
    //   console.log('⚠️  Admin user already exists');
    //   console.log('Email: admin@seha.sa');
    //   process.exit(0);
    // }

    // Hash password
    const hashedPassword = await bcrypt.hash('ahmed123456#@', 10);

    // Create admin user
    const admin = await User.create({
      name: 'ahmed',
      email: 'ahmed@seha.sa',
      password: hashedPassword
    });


    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

createAdminUser();

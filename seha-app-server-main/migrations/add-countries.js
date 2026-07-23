require("dotenv").config();
const sequelize = require("../config/database");

async function addCountries() {
  try {
    console.log("🔄 بدء تحديث جدول countries بأسماء الدول...");

    // قائمة الدول مع الأسماء العربية والإنجليزية (أسماء الدول وليس الجنسيات)
    const countries = [
      { id: 1, country_name_ar: 'السعودية', country_name_en: 'Saudi Arabia' },
      { id: 2, country_name_ar: 'مصر', country_name_en: 'Egypt' },
      { id: 3, country_name_ar: 'سوريا', country_name_en: 'Syria' },
      { id: 4, country_name_ar: 'الأردن', country_name_en: 'Jordan' },
      { id: 5, country_name_ar: 'لبنان', country_name_en: 'Lebanon' },
      { id: 6, country_name_ar: 'فلسطين', country_name_en: 'Palestine' },
      { id: 7, country_name_ar: 'العراق', country_name_en: 'Iraq' },
      { id: 8, country_name_ar: 'اليمن', country_name_en: 'Yemen' },
      { id: 9, country_name_ar: 'السودان', country_name_en: 'Sudan' },
      { id: 10, country_name_ar: 'باكستان', country_name_en: 'Pakistan' },
      { id: 11, country_name_ar: 'الهند', country_name_en: 'India' },
      { id: 12, country_name_ar: 'بنغلاديش', country_name_en: 'Bangladesh' },
      { id: 13, country_name_ar: 'الفلبين', country_name_en: 'Philippines' },
      { id: 14, country_name_ar: 'إثيوبيا', country_name_en: 'Ethiopia' },
      { id: 15, country_name_ar: 'إندونيسيا', country_name_en: 'Indonesia' },
      { id: 16, country_name_ar: 'نيبال', country_name_en: 'Nepal' },
      { id: 17, country_name_ar: 'سريلانكا', country_name_en: 'Sri Lanka' },
      { id: 18, country_name_ar: 'تونس', country_name_en: 'Tunisia' },
      { id: 19, country_name_ar: 'المغرب', country_name_en: 'Morocco' },
      { id: 20, country_name_ar: 'الجزائر', country_name_en: 'Algeria' },
      { id: 21, country_name_ar: 'ليبيا', country_name_en: 'Libya' },
      { id: 22, country_name_ar: 'الكويت', country_name_en: 'Kuwait' },
      { id: 23, country_name_ar: 'الإمارات', country_name_en: 'UAE' },
      { id: 24, country_name_ar: 'قطر', country_name_en: 'Qatar' },
      { id: 25, country_name_ar: 'البحرين', country_name_en: 'Bahrain' },
      { id: 26, country_name_ar: 'عمان', country_name_en: 'Oman' },
      { id: 27, country_name_ar: 'تركيا', country_name_en: 'Turkey' },
      { id: 28, country_name_ar: 'إيران', country_name_en: 'Iran' },
      { id: 29, country_name_ar: 'أفغانستان', country_name_en: 'Afghanistan' }
    ];

    for (const country of countries) {
      try {
        // التحقق من وجود الدولة
        const [existing] = await sequelize.query(
          `SELECT id FROM countries WHERE id = ${country.id}`
        );
        
        if (existing.length === 0) {
          await sequelize.query(`
            INSERT INTO countries (id, country_name_ar, country_name_en, "createdAt", "updatedAt")
            VALUES (${country.id}, '${country.country_name_ar}', '${country.country_name_en}', NOW(), NOW())
          `);
          console.log(`✅ تم إضافة: ${country.country_name_ar} (${country.country_name_en})`);
        } else {
          await sequelize.query(`
            UPDATE countries 
            SET country_name_ar = '${country.country_name_ar}', country_name_en = '${country.country_name_en}', "updatedAt" = NOW()
            WHERE id = ${country.id}
          `);
          console.log(`🔄 تم تحديث: ${country.country_name_ar} (${country.country_name_en})`);
        }
      } catch (e) {
        console.log(`⚠️ تخطي ${country.country_name_ar}: ${e.message}`);
      }
    }

    console.log("✅ تم تحديث/إضافة جميع الدول بنجاح");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ خطأ أثناء الميجريشن:", error);
    process.exit(1);
  }
}

// Run migration
addCountries();

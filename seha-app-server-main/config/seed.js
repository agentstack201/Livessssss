// Idempotent boot-time seeding.
//
// A freshly-provisioned database (e.g. a new Neon project) starts empty, and the
// seed data used to live only in migrations/*.js scripts that had to be run by
// hand — so the nationality dropdown rendered with no options at all. This module
// runs on every boot and is safe to re-run: it only inserts what is missing.
//
// Note: rows are inserted WITHOUT explicit ids so Postgres' serial sequence stays
// in sync. On an empty table the first row (السعودية) naturally receives id = 1,
// which is the fallback countryId used elsewhere in the app.
const Country = require("../models/countries.model");

// Country names, then nationality adjectives and residency statuses, so the user
// can pick "السعودية" or "سعودي" or "مقيم نازح" without having to add them first.
const DEFAULT_COUNTRIES = [
  // Saudi first — becomes id 1 on a fresh database and is the app-wide default.
  { ar: 'السعودية', en: 'Saudi Arabia' },
  { ar: 'مصر', en: 'Egypt' },
  { ar: 'اليمن', en: 'Yemen' },
  { ar: 'سوريا', en: 'Syria' },
  { ar: 'الأردن', en: 'Jordan' },
  { ar: 'لبنان', en: 'Lebanon' },
  { ar: 'فلسطين', en: 'Palestine' },
  { ar: 'العراق', en: 'Iraq' },
  { ar: 'السودان', en: 'Sudan' },
  { ar: 'باكستان', en: 'Pakistan' },
  { ar: 'الهند', en: 'India' },
  { ar: 'بنغلاديش', en: 'Bangladesh' },
  { ar: 'الفلبين', en: 'Philippines' },
  { ar: 'إثيوبيا', en: 'Ethiopia' },
  { ar: 'إندونيسيا', en: 'Indonesia' },
  { ar: 'نيبال', en: 'Nepal' },
  { ar: 'سريلانكا', en: 'Sri Lanka' },
  { ar: 'تونس', en: 'Tunisia' },
  { ar: 'المغرب', en: 'Morocco' },
  { ar: 'الجزائر', en: 'Algeria' },
  { ar: 'ليبيا', en: 'Libya' },
  { ar: 'الكويت', en: 'Kuwait' },
  { ar: 'الإمارات', en: 'United Arab Emirates' },
  { ar: 'قطر', en: 'Qatar' },
  { ar: 'البحرين', en: 'Bahrain' },
  { ar: 'عُمان', en: 'Oman' },
  { ar: 'تركيا', en: 'Turkey' },
  { ar: 'إيران', en: 'Iran' },
  { ar: 'أفغانستان', en: 'Afghanistan' },
  { ar: 'الصومال', en: 'Somalia' },
  { ar: 'إريتريا', en: 'Eritrea' },
  { ar: 'جيبوتي', en: 'Djibouti' },
  { ar: 'موريتانيا', en: 'Mauritania' },
  { ar: 'تشاد', en: 'Chad' },
  { ar: 'نيجيريا', en: 'Nigeria' },
  { ar: 'كينيا', en: 'Kenya' },
  { ar: 'أوغندا', en: 'Uganda' },
  { ar: 'ميانمار', en: 'Myanmar' },
  { ar: 'الصين', en: 'China' },
  { ar: 'بريطانيا', en: 'United Kingdom' },
  { ar: 'أمريكا', en: 'United States' },
  { ar: 'كندا', en: 'Canada' },

  // Nationality adjectives (commonly written on the report instead of the country)
  { ar: 'سعودي', en: 'Saudi' },
  { ar: 'مصري', en: 'Egyptian' },
  { ar: 'يمني', en: 'Yemeni' },
  { ar: 'سوري', en: 'Syrian' },
  { ar: 'أردني', en: 'Jordanian' },
  { ar: 'لبناني', en: 'Lebanese' },
  { ar: 'فلسطيني', en: 'Palestinian' },
  { ar: 'عراقي', en: 'Iraqi' },
  { ar: 'سوداني', en: 'Sudanese' },
  { ar: 'باكستاني', en: 'Pakistani' },
  { ar: 'هندي', en: 'Indian' },
  { ar: 'بنغلاديشي', en: 'Bangladeshi' },
  { ar: 'فلبيني', en: 'Filipino' },

  // Residency / legal statuses
  { ar: 'مقيم', en: 'Resident' },
  { ar: 'مقيم نازح', en: 'Displaced Resident' },
  { ar: 'زائر', en: 'Visitor' },
  { ar: 'خليجي', en: 'GCC Citizen' },
  { ar: 'حامل وثيقة', en: 'Travel Document Holder' },
  { ar: 'غير محدد', en: 'Unspecified' },
];

// migrations/add-countries.js inserts explicit ids 1-29 without advancing the
// serial sequence, so on a database where it was ever run the next generated id
// collides and the first custom nationality a user adds fails with a duplicate
// key. Realigning the sequence with the table's real maximum repairs that, and
// is a no-op on a healthy database.
async function repairCountrySequence(sequelize) {
  try {
    await sequelize.query(`
      SELECT setval(
        pg_get_serial_sequence('countries', 'id'),
        COALESCE((SELECT MAX(id) FROM countries), 1),
        true
      )
    `);
  } catch (err) {
    console.warn('⚠️ Could not realign countries id sequence:', err.message);
  }
}

async function seedCountries() {
  try {
    const existing = await Country.findAll({ attributes: ['country_name_ar'] });
    const have = new Set(existing.map((c) => c.country_name_ar));

    const missing = DEFAULT_COUNTRIES.filter((c) => !have.has(c.ar));
    if (missing.length === 0) {
      console.log(`✅ Countries already seeded (${have.size} entries)`);
      return;
    }

    // Insert sequentially so السعودية lands on id 1 for a fresh database.
    for (const c of missing) {
      try {
        await Country.create({
          country_name_ar: c.ar,
          country_name_en: c.en,
          created_by: 'system',
        });
      } catch (err) {
        // A concurrent boot may have inserted it — not fatal.
        console.warn(`⚠️ Skipped seeding "${c.ar}": ${err.message}`);
      }
    }

    console.log(`✅ Seeded ${missing.length} nationality entries (total ${have.size + missing.length})`);
  } catch (error) {
    // Seeding must never prevent the server from starting.
    console.error('⚠️ Country seeding skipped:', error.message);
  }
}

module.exports = { seedCountries, DEFAULT_COUNTRIES };

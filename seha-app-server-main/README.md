# 🏥 Seha Sick Leaves API

API Backend لإدارة الإجازات المرضية في منصة صحة السعودية.

## 📋 المميزات

✅ **تسجيل الدخول** - نظام مصادقة JWT  
✅ **إدارة الإجازات** - إنشاء، تحديث، حذف، استعلام  
✅ **تحميل PDF** - توليد تقارير PDF تلقائياً  
✅ **استخراج ذكي** - AI-assisted data extraction  
✅ **تحويل التواريخ** - تحويل تلقائي للتاريخ الهجري  
✅ **حساب المدة** - حساب أيام الإجازة تلقائياً  

---

## 🚀 البدء السريع

### 1. التثبيت

```bash
# استنساخ المشروع
git clone https://github.com/your-repo/seha-app-server.git
cd seha-app-server

# تثبيت المكتبات
npm install
```

### 2. إعداد قاعدة البيانات (Neon)

1. أنشئ مشروعاً مجانياً على [Neon](https://neon.tech).
2. من **Project → Connect** انسخ سلسلة الاتصال (استخدم الـ **Pooled connection** — يحتوي المضيف على `-pooler`).
3. ضعها في `DATABASE_URL` داخل ملف `.env` (انظر الخطوة التالية).

> الجداول تُنشأ تلقائياً عند أول تشغيل عبر `sequelize.sync()`، ثم شغّل `npm run create-admin` لإنشاء حساب المدير.

### 3. إعداد المتغيرات البيئية

```bash
# نسخ ملف البيئة
cp .env.example .env

# تعديل المتغيرات
nano .env
```

### 4. تشغيل السيرفر

```bash
# Development
npm start

# أو مع nodemon
npm run dev
```

السيرفر سيعمل على: `http://localhost:3000` (Development) أو رابط الاستضافة الخاص بك على Render/Vercel (Production)

---

## 📁 هيكل المشروع

```
seha-app-server/
├── app.js                    # نقطة الدخول الرئيسية
├── config/
│   ├── database.js           # إعدادات قاعدة البيانات
│   ├── middlewares.js        # تجميع الـ middlewares
│   ├── models_associations.js # علاقات النماذج
│   └── routes.js             # تجميع الـ routes
├── controller/
│   ├── country.controller.js # معالج الدول
│   ├── leaves.controller.js  # معالج الإجازات (CRUD)
│   └── login.controller.js   # معالج تسجيل الدخول
├── middlewares/
│   ├── authMW.js             # مصادقة JWT
│   ├── calcDays.js           # حساب أيام الإجازة
│   ├── convertDates.js       # تحويل التواريخ
│   ├── generatePdf.js        # توليد PDF
│   └── validationMW.js       # معالج الأخطاء
├── models/
│   ├── countries.model.js    # نموذج الدول
│   ├── leaves.model.js       # نموذج الإجازات
│   └── user.model.js         # نموذج المستخدمين
├── routes/
│   ├── country.route.js      # مسارات الدول
│   ├── leaves.route.js       # مسارات الإجازات
│   └── login.route.js        # مسارات تسجيل الدخول
├── validations/
│   ├── country.validation.js
│   ├── leaves.validations.js
│   └── login.validation.js
├── public/
│   ├── images/               # الصور للـ PDF
│   └── leaves/               # ملفات PDF المولدة
├── .env.example              # مثال لملف البيئة
├── API_DOCUMENTATION.md      # توثيق كامل للـ API
├── package.json
└── README.md
```

---

## 🔐 API Endpoints

### تسجيل الدخول
```http
POST /login
```

### إدارة الإجازات
```http
POST   /sick-leaves/:key              # إنشاء
GET    /sick-leaves                   # استعلام
PUT    /sick-leaves/:key              # تحديث
DELETE /sick-leaves/:key              # حذف
```

### تحميل PDF
```http
GET /sick-leaves/:service_num/:national_id/pdf
```

### AI Extraction
```http
POST /sick-leaves/ai-extract/:key
```

### الدول
```http
GET /countries
```

📖 للتوثيق الكامل، راجع [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

---

## 🗄️ قاعدة البيانات

### خيارات قاعدة البيانات

#### ✅ **الخيار 1: Neon — Serverless PostgreSQL (موصى به)**
- خطة مجانية سخية
- Connection pooling مدمج (استخدم مضيف `-pooler`)
- مناسب للاستضافة على Render وVercel
- الاتصال عبر متغيّر واحد: `DATABASE_URL`

#### ✅ **الخيار 2: أي PostgreSQL آخر**
- يكفي ضبط `DATABASE_URL` أو المتغيّرات المنفصلة (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`)

#### ❌ **SQLite لا يعمل على الاستضافة Serverless**
- التخزين للقراءة فقط، والبيانات تُحذف بعد كل request

### Tables

#### users
```sql
- id (INT, PK, AUTO_INCREMENT)
- name (VARCHAR(191))
- email (VARCHAR(191), UNIQUE)
- password (VARCHAR(191))
- createdAt, updatedAt
```

#### leaves
```sql
- id (INT, PK, AUTO_INCREMENT)
- service_num (VARCHAR(191))
- leave_id (VARCHAR(191))
- admission_date_en (VARCHAR(191))
- admission_date_ar (VARCHAR(191))
- discharge_date_en (VARCHAR(191))
- discharge_date_ar (VARCHAR(191))
- issue_date (VARCHAR(191))
- name_en (VARCHAR(191))
- name_ar (VARCHAR(191))
- national_id (VARCHAR(191))
- employer_en (VARCHAR(191))
- employer_ar (VARCHAR(191))
- physician_name_en (VARCHAR(191))
- physician_name_ar (VARCHAR(191))
- position_en (VARCHAR(191))
- position_ar (VARCHAR(191))
- countryId (INT, FK)
- createdAt, updatedAt
- UNIQUE INDEX: (service_num, national_id)
```

#### countries
```sql
- id (INT, PK, AUTO_INCREMENT)
- country_name_en (VARCHAR(191))
- country_name_ar (VARCHAR(191))
- createdAt, updatedAt
```

---

## 🛠️ التقنيات المستخدمة

- **Node.js** - بيئة التشغيل
- **Express.js** - إطار العمل
- **Sequelize** - ORM لقاعدة البيانات
- **Neon (PostgreSQL)** - قاعدة البيانات
- **JWT** - المصادقة
- **bcrypt** - تشفير كلمات المرور
- **Puppeteer** - توليد PDF
- **express-validator** - التحقق من البيانات
- **moment.js** - التعامل مع التواريخ
- **hijri-converter** - تحويل التاريخ الهجري

---

## 🔒 الأمان

- ✅ JWT tokens مع انتهاء صلاحية 3 ساعات
- ✅ bcrypt hashing لكلمات المرور
- ✅ express-validator للتحقق من البيانات
- ✅ CORS protection
- ✅ Unique indexes على قاعدة البيانات
- ✅ Authorization middleware

---

## 📝 أمثلة الاستخدام

### تسجيل الدخول
```javascript
const response = await fetch('http://localhost:3000/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@seha.sa',
    password: 'password123'
  })
});

const data = await response.json();
const token = data.data.token;
```

### إنشاء إجازة مرضية
```javascript
const response = await fetch('http://localhost:3000/sick-leaves/Nasr4k', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    service_num: '12345',
    leave_id: 'CSL001',
    admission_date_en: '2024-01-15',
    discharge_date_en: '2024-01-18',
    // ... باقي الحقول
  })
});
```

### تحميل PDF
```javascript
const url = `http://localhost:3000/sick-leaves/${serviceNum}/${nationalID}/pdf`;
const response = await fetch(url);
const blob = await response.blob();

// تحميل الملف
const link = document.createElement('a');
link.href = window.URL.createObjectURL(blob);
link.download = 'sick_leave.pdf';
link.click();
```

---

## 🧪 الاختبار

```bash
# اختبار الـ endpoints باستخدام curl
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@seha.sa","password":"test123"}'
```

---

## 🚀 النشر

### Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Heroku
```bash
# Login
heroku login

# Create app
heroku create seha-api

# Deploy
git push heroku main
```

---

## 📦 Dependencies

### المكتبات الأساسية
- express: ^4.19.2
- sequelize: ^6.37.3
- mysql2: ^3.9.7
- bcrypt: ^5.1.1
- jsonwebtoken: ^9.0.2

### المساعدة
- puppeteer: ^23.9.0 (PDF)
- moment: ^2.30.1 (التواريخ)
- hijri-converter: ^1.1.1 (الهجري)
- express-validator: ^7.0.1 (التحقق)
- cors: ^2.8.5 (CORS)
- dotenv: ^16.4.5 (البيئة)

---

## 🐛 استكشاف الأخطاء

### المشكلة: قاعدة البيانات لا تتصل
```bash
# تحقق من MySQL
sudo service mysql status

# تحقق من .env
cat .env | grep DB_
```

### المشكلة: Puppeteer لا يعمل
```bash
# تثبيت dependencies
sudo apt-get install -y \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0
```

### المشكلة: JWT expired
```
الحل: تسجيل الدخول مرة أخرى للحصول على token جديد
```

---

## 📞 الدعم

- 📧 Email: support@seha.sa
- 🐛 Issues: [GitHub Issues](https://github.com/your-repo/issues)
- 📖 Docs: [API Documentation](./API_DOCUMENTATION.md)

---

## 👥 المساهمة

نرحب بالمساهمات! يرجى:
1. Fork المشروع
2. إنشاء branch جديد (`git checkout -b feature/amazing-feature`)
3. Commit التغييرات (`git commit -m 'Add amazing feature'`)
4. Push إلى branch (`git push origin feature/amazing-feature`)
5. فتح Pull Request

---

## 📄 License

ISC © 2024 Seha Platform

---

## 🙏 شكر خاص

- وزارة الصحة السعودية
- فريق تطوير منصة صحة
- المجتمع البرمجي العربي

---

Made with ❤️ in Saudi Arabia 🇸🇦

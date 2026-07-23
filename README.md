# منصة صحة (Seha) — Sick Leave Platform

منصة لإنشاء وإدارة تقارير الإجازات المرضية، تتكوّن من جزأين مستقلين:

| المجلد | الوصف | التقنية |
| --- | --- | --- |
| [`seha.sa-main`](./seha.sa-main) | الواجهة الأمامية (Frontend) | React 19 + Vite |
| [`seha-app-server-main`](./seha-app-server-main) | الخادم / الـ API (Backend) | Node.js + Express 5 + Sequelize (PostgreSQL / Neon) |

يُنشر كل جزء كمشروع مستقل على **Vercel** (كلاهما يحتوي على `vercel.json` خاص به).

---

## 🚀 نموذج النشر على Vercel (مهم)

هذا المستودع **monorepo** يحتوي تطبيقين مستقلّين، ويُنشر كـ **مشروعين منفصلين** على Vercel — كلٌّ يشير إلى مجلده عبر إعداد **Root Directory**:

| مشروع Vercel | Root Directory | الإطار (Framework) |
| --- | --- | --- |
| الواجهة | `seha.sa-main` | Vite |
| الخادم | `seha-app-server-main` | Other / Node.js |

**خطوات الاستيراد في Vercel لكل مشروع:**
1. New Project → استورد نفس المستودع.
2. اضبط **Root Directory** على اسم المجلد (من الجدول أعلاه).
3. أضِف متغيّرات البيئة (انظر الأقسام أدناه).
4. Deploy.

> **لماذا لا يوجد `vercel.json` في جذر المستودع؟**
> لأن مسارات الواجهة ومسارات الـ API تتصادم (كلاهما يستخدم `/login`, `/users`, `/settings`, `/countries`, `/doctors`, `/hospitals`, `/media`). لذلك لا يمكن دمجهما في مشروع/نطاق واحد دون إعادة هيكلة مسارات الـ API ببادئة `/api`. النموذج الصحيح هو مشروعان منفصلان، وكل مجلد يحوي `vercel.json` الخاص به الذي تلتقطه Vercel تلقائياً عند ضبط Root Directory. بعد نشر الخادم، ضع رابطه في متغيّر `VITE_API_BASE_URL` لدى مشروع الواجهة.

---

## 1) الواجهة الأمامية — `seha.sa-main`

```bash
cd seha.sa-main
cp .env.example .env      # ثم عدّل القيم
npm install
npm run dev               # تطوير محلي
npm run build             # إنتاج → مجلد dist/
```

### متغيّرات البيئة (Frontend)
| المتغيّر | الوصف | مثال |
| --- | --- | --- |
| `VITE_API_BASE_URL` | عنوان الخادم | `https://your-api.vercel.app` |
| `VITE_API_LOGIN` | مسار تسجيل الدخول | `/login` |
| `VITE_API_SICK_LEAVES` | مسار الإجازات | `/sick-leaves` |

### النشر على Vercel
- **Root Directory**: `seha.sa-main`
- **Framework Preset**: Vite — **Build**: `npm run build` — **Output**: `dist`
- أضِف متغيّرات البيئة أعلاه في إعدادات المشروع.

---

## 2) الخادم — `seha-app-server-main`

```bash
cd seha-app-server-main
cp .env.example .env      # ثم عبّئ بيانات قاعدة البيانات والأسرار
npm install
npm run dev               # تطوير محلي (nodemon)
npm start                 # تشغيل عادي
npm run create-admin      # إنشاء حساب مدير أولي
```

### متغيّرات البيئة (Backend)
انظر [`seha-app-server-main/.env.example`](./seha-app-server-main/.env.example) — تشمل `DATABASE_URL` (سلسلة اتصال Neon) و `JWT_SECRET` و `CORS_ORIGIN` و `FRONTEND_URL`. (تخزين ملفات الوسائط يستخدم Supabase Storage اختيارياً عبر `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY`.)

### النشر على Render (موصى به للخادم)
الخادم دائم التشغيل ويولّد PDF عبر Chromium، لذا Render أنسب من Vercel serverless.
يوجد ملف [`render.yaml`](./render.yaml) في جذر المستودع كـ Blueprint جاهز.

**نشر بضغطة واحدة** (بعد دمج التغييرات في الفرع الافتراضي، أو اختر هذا الفرع داخل Render):

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/agentstack201/Livessssss)

**الخطوات:**
1. Render Dashboard → **New +** → **Blueprint** → اختر هذا المستودع → Apply.
   (أو **New Web Service** يدوياً مع: Root Directory = `seha-app-server-main`، Build = `npm install --omit=dev`، Start = `npm start`، Health Check Path = `/api/health`.)
2. عبّئ متغيّرات البيئة (المعلّمة `sync: false`): `DATABASE_URL` (من Neon → Connect، استخدم سلسلة الـ pooled) و `FRONTEND_URL`. (`JWT_SECRET` يولّده Render تلقائياً.)
3. بعد نجاح النشر، انسخ رابط الخدمة (مثل `https://seha-app-server.onrender.com`).
4. في مشروع **Vercel** للواجهة: اضبط `VITE_API_BASE_URL` على رابط Render أعلاه، ثم أعِد النشر (Redeploy).

> Chromium: على Render يُستخدم `@sparticuz/chromium` المضمّن تلقائياً (يُكتشف عبر متغيّر `RENDER`) — لا حاجة لتثبيت متصفّح.

---

## ⚠️ ملاحظات أمنية للاستضافة
- **لا تُرفع أي أسرار حقيقية** إلى المستودع. ملفات `.env` و `.env.backup` مُستثناة عبر `.gitignore`؛ استخدم فقط `.env.example` كقالب، وضع القيم الحقيقية في لوحة تحكم الاستضافة (Environment Variables).
- غيّر `JWT_SECRET` إلى قيمة قوية وسرّية في بيئة الإنتاج.
- اضبط `CORS_ORIGIN` / `FRONTEND_URL` على نطاق الواجهة الفعلي بعد النشر.

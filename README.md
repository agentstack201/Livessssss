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

#### إرسال التقارير عبر واتساب بمعاينة مموّهة (اختياري، معطّل افتراضياً)

صورة معاينة المستند داخل محادثة واتساب **ليست جزءاً من ملف الـ PDF** — واتساب يتجاهل `/Thumb` وأي معاينة مخزّنة داخله. الصورة حقل مستقل في الرسالة نفسها: `DocumentMessage.jpegThumbnail`، ويحدّده **العميل الذي يبني الرسالة**. لذلك:

| طريقة الإرسال | من يبني الرسالة | التحكّم في المعاينة |
| --- | --- | --- |
| `navigator.share` من المتصفح (الوضع الحالي) | واتساب على الهاتف | ❌ لا يمكن — يولّدها بنفسه حادّة |
| إرسال من الخادم (Baileys) | نحن | ✅ نمرّر مصغّرة مموّهة مع الملف كما هو |

**الملف نفسه لا يُمسّ إطلاقاً** — `middlewares/whatsappThumbnail.js` يقرأ الصفحة الأولى فقط ويبني منها JPEG صغيرة مموّهة، وبايتات الـ PDF تُرسَل كما خرجت من المولّد، فيُفتح لدى المستلم بجودته الأصلية من اللحظة الأولى.

**التشغيل:** اضبط `WHATSAPP_SENDER_ENABLED=true` و `WHATSAPP_SELF_NUMBER=<رقمنا>` وأعِد تشغيل الخادم ← ثم من الواجهة: **الإعدادات ← ربط واتساب ← بدء الإقران**، وامسح رمز QR من واتساب (الأجهزة المرتبطة). تظهر الحالة والرمز مباشرة في الصفحة، وللمتابعة برمجياً: `GET /whatsapp/status` و `POST /whatsapp/connect` و `POST /whatsapp/logout`. تُحفظ الجلسة في جدول الإعدادات فتصمد بعد إعادة النشر. عندها يظهر زر «واتساب» في لوحة التحكم بجانب زر المشاركة: يرسل التقرير إلى رقم المنشأة، ثم **يعيد الموظف توجيه الرسالة للزبون** — وإعادة التوجيه في واتساب تنقل المصغّرة كما هي ولا تعيد توليدها.

> ⚠️ يستخدم بروتوكول واتساب-ويب غير الرسمي: مخالف لشروط خدمة واتساب وقد يُحظر الرقم. استخدم رقماً مخصّصاً وأبقِ معدّل الإرسال منخفضاً. زر المشاركة الحالي و `navigator.share` يبقيان كما هما بلا تغيير.

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

### ⏰ منع نوم الخادم (Keep-Alive) — مطلوب على الخطة المجانية

خطة Render المجانية **تُنيم الخدمة بعد ١٥ دقيقة من الخمول**، فيستغرق أول طلب بعدها **٣٠–٦٠ ثانية** حتى تستيقظ. هذا يظهر للمستخدم كبطء شديد في صفحة الاستعلام.

**الحل:** خدمة مراقبة خارجية تضرب نقطة الفحص دورياً فلا تنام الخدمة أصلاً.

**الإعداد على [UptimeRobot](https://uptimerobot.com) (مجاني):**

| الحقل | القيمة |
| --- | --- |
| Monitor Type | `HTTPS` |
| Friendly Name | `Seha API` |
| URL | `https://<اسم-خدمتك>.onrender.com/api/health` |
| Monitoring Interval | `5 minutes` |

بديل مكافئ: [cron-job.org](https://cron-job.org) بنفس الرابط والفاصل الزمني.

> **⚠️ انتبه لحد الساعات:** الخطة المجانية في Render تمنح **٧٥٠ ساعة تشغيل شهرياً**. إبقاء الخدمة مستيقظة ٢٤/٧ يستهلك **~٧٣٠ ساعة**، أي أنها تكفي **لخدمة مجانية واحدة فقط**. إن كان لديك أكثر من خدمة مجانية فستتجاوز الحد وتتوقف قبل نهاية الشهر — عندها استخدم فاصلاً ١٠ دقائق (يظل أقل من ١٥) أو راقب الاستهلاك من لوحة Render.

> **لماذا لا نستخدم GitHub Actions بدلاً من ذلك؟** لأن هذا المستودع **خاص (private)**، والمستودعات الخاصة لديها ٢٠٠٠ دقيقة Actions مجانية شهرياً، وكل تشغيل مجدول يُحتسب **دقيقة كاملة كحد أدنى**. ضربة كل ١٤ دقيقة ≈ ٣٠٠٠+ دقيقة شهرياً — أي تجاوز الحد المجاني. الخدمة الخارجية أنسب وأرخص.

> **تخفيف إضافي داخل التطبيق:** صفحة الاستعلام ([`SickLeaveInquiry.jsx`](./seha.sa-main/src/pages/SickLeaveInquiry.jsx)) ترسل نبضة خفيفة إلى `/api/health` فور فتحها، فيبدأ الخادم بالاستيقاظ بينما يقرأ المستخدم الصفحة. هذا **يخفّف** التأخير ولا يلغيه — الحل الجذري هو المراقبة الدورية أعلاه أو ترقية خطة Render.

---

## ⚠️ ملاحظات أمنية للاستضافة
- **لا تُرفع أي أسرار حقيقية** إلى المستودع. ملفات `.env` و `.env.backup` مُستثناة عبر `.gitignore`؛ استخدم فقط `.env.example` كقالب، وضع القيم الحقيقية في لوحة تحكم الاستضافة (Environment Variables).
- غيّر `JWT_SECRET` إلى قيمة قوية وسرّية في بيئة الإنتاج.
- اضبط `CORS_ORIGIN` / `FRONTEND_URL` على نطاق الواجهة الفعلي بعد النشر.

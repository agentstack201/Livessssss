// ───────────────────────────────────────────────────────────────────────────
// دوال تنسيق مشتركة بين قوالب «مشهد المراجعة» (لمرافق وللمريض).
//
// كانت هذه الدوال منسوخة حرفياً داخل generateCompanionPdf.js، ومع إضافة قالب
// ثالث كانت ستُنسخ مرة ثالثة — أي ثلاث نسخ من منطق «فترة الانتظار» تنحرف عن
// بعضها مع أول تعديل. استُخرجت هنا كما هي بالضبط بلا أي تغيير سلوكي.
// ───────────────────────────────────────────────────────────────────────────

const padTwo = (value) => String(value).padStart(2, '0');

// تاريخ ميلادي YYYY-MM-DD → DD-MM-YYYY
const formatDate = (dateString) => {
  if (!dateString) return '';
  const parts = String(dateString).split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${padTwo(day)}-${padTwo(month)}-${year}`;
  }
  return dateString;
};

// تاريخ هجري → أرقام بخانتين مع الحفاظ على الفاصل
const formatHijriDate = (dateString) => {
  if (!dateString) return '';
  const delimiter = String(dateString).includes('/') ? '/' : '-';
  const parts = String(dateString).split(delimiter);
  if (parts.length >= 3) {
    return parts.map((part) => (isNaN(part) ? part : padTwo(part))).join(delimiter);
  }
  return dateString;
};

// "11:52 AM" أو "23:15" → عدد الدقائق منذ منتصف الليل (null إن تعذّر التحليل)
const parseTimeMinutes = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  let m = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    let hours = parseInt(m[1], 10) % 12;
    if (/pm/i.test(m[3])) hours += 12;
    return hours * 60 + parseInt(m[2], 10);
  }
  m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return null;
};

// أي صيغة وقت → "11:52 AM"
const formatTime12 = (value) => {
  const minutes = parseTimeMinutes(value);
  if (minutes === null) return '';
  const hours24 = Math.floor(minutes / 60);
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = (hours24 % 12) || 12;
  return `${hours12}:${padTwo(minutes % 60)} ${ampm}`;
};

// صباحاً / مساءً حسب الوقت
const arabicMeridiem = (value) => {
  const minutes = parseTimeMinutes(value);
  if (minutes === null) return '';
  return minutes < 12 * 60 ? 'صباحاً' : 'مساءً';
};

// فرق الأيام بين تاريخين ميلاديين (0 إن تعذّر الحساب)
const daysBetween = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start) || isNaN(end)) return 0;
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
};

// فترة الانتظار بين الدخول والخروج — تُحسب آلياً بالساعات والدقائق.
// الدقائق الصفرية تُعرض "--" مطابقةً للمستند الرسمي.
const waitingPeriod = (admissionDate, admissionTime, dischargeDate, dischargeTime) => {
  const startMinutes = parseTimeMinutes(admissionTime);
  const endMinutes = parseTimeMinutes(dischargeTime);
  if (startMinutes === null || endMinutes === null) {
    return { en: '-- hours and -- mins', ar: '-- ساعة و -- دقيقة' };
  }
  const total = daysBetween(admissionDate, dischargeDate) * 1440 + (endMinutes - startMinutes);
  if (total < 0) return { en: '-- hours and -- mins', ar: '-- ساعة و -- دقيقة' };

  const hours = Math.floor(total / 60);
  const mins = total % 60;
  const minsLabel = mins > 0 ? String(mins) : '--';
  return {
    en: `${hours} ${hours === 1 ? 'hour' : 'hours'} and ${minsLabel} mins`,
    ar: `${hours} ساعة و ${minsLabel} دقيقة`,
  };
};

// تهريب النصوص القادمة من قاعدة البيانات قبل حقنها في قالب HTML.
// اسم فيه <>&"' كان يكسر بنية الصفحة المطبوعة (أو يحقن وسماً)؛ التهريب يجعل
// أي نص مهما كان محتواه يُعرض كنص عادي.
const escapeHtml = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

module.exports = {
  padTwo,
  formatDate,
  formatHijriDate,
  parseTimeMinutes,
  formatTime12,
  arabicMeridiem,
  daysBetween,
  waitingPeriod,
  escapeHtml,
};

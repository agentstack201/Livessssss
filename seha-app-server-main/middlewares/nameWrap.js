// ───────────────────────────────────────────────────────────────────────────
// التفاف أسماء الأشخاص داخل خلايا التقرير.
//
// المشكلة: خلية الاسم تلتف على حدود الكلمة، فاسم مثل
//
//     ABDULMOEEN ZAHER AHMED AL BARAKATI
//
// كان يُطبع هكذا:
//
//     ABDULMOEEN ZAHER AHMED AL
//     BARAKATI
//
// أي أن أداة الوصل «AL» تُترك يتيمة في آخر السطر منفصلةً عن الكلمة التي تخصّها.
// ونفس الشيء في العربية: «... بن محمد آل / عبد الله ...».
//
// الحل: أداة الوصل تُربط بالكلمة التي تليها في وحدة واحدة لا تنكسر
// (<span class="nb">)، فيقع الالتفاف قبلها لا بعدها. الحل عامّ تماماً: يعتمد على
// قائمة أدوات الوصل المعروفة في الأسماء العربية والمنقولة عنها، ولا يعرف أي اسم
// بعينه ولا يحوي أي استثناء لسجلّ محدّد.
//
// شبكة أمان: لا تتجاوز الوحدة الواحدة MAX_UNIT حرفاً. الوحدة التي لا تنكسر إذا
// طالت أكثر من عرض العمود ستخرج منه، فالربط يتوقف قبل أن يصل إلى هذا الحد —
// والكلمة الطويلة أصلاً تأخذ سطراً كاملاً فلا تنشأ عنها كلمة يتيمة.
//
// نسخة مطابقة لما في الواجهة (seha.sa-main/src/utils/nameWrap.js) — أي انحراف
// بين النسختين يعني أن المعاينة لا تطابق الـ PDF المطبوع.
// ───────────────────────────────────────────────────────────────────────────

const { escapeHtml } = require('./documentFormat');

// أقصى طول لوحدة لا تنكسر (بالمحارف).
const MAX_UNIT = 24;

// كلمة واحدة أطول من هذا الحد لا يمكن لأي عمود أن يسعها، فتُسمح بالكسر داخلها
// (class="brk"). لا تُوضع إلا عليها وحدها حتى لا يتغيّر ترتيب أي بيانات عادية.
const MAX_TOKEN = 28;

// أدوات الوصل التي تنتمي إلى الكلمة التي بعدها — عربية ومنقولة عنها بالحروف
// اللاتينية، ومعها أدوات الأسماء الأوروبية المركّبة (van der / de la ...).
const CONNECTORS = new Set([
  // منقولة بالحروف اللاتينية
  'al', 'el', 'ad', 'abu', 'abo', 'abd', 'abdul', 'abdel', 'abdol',
  'bin', 'ben', 'bn', 'ibn', 'bint', 'bnt', 'um', 'umm',
  // أسماء أوروبية مركّبة
  'van', 'von', 'der', 'den', 'de', 'del', 'della', 'da', 'di', 'du', 'la', 'le',
  // عربية (بعد توحيد الهمزات، فـ«آل» و«أبو» تصلان إلى هنا كـ«ال» و«ابو»)
  'ال', 'بن', 'ابن', 'بنت', 'عبد', 'ابو', 'ابا', 'ام', 'ذو', 'ذي',
]);

// توحيد شكل الكلمة قبل مطابقتها: حروف صغيرة، بلا علامات ترقيم أو تشكيل، وبألف
// موحّدة — حتى تُعامل «آل» و«ال» و«أبو» و«ابو» و"AL-" و"Al." معاملة واحدة.
const normalizeToken = (token) => String(token)
  .toLowerCase()
  .replace(/[.,'’`\-_]/g, '')
  .replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه');

const isConnector = (token) => CONNECTORS.has(normalizeToken(token));

// كلمة واحدة → HTML مهرَّب، مع السماح بالكسر داخلها إن كانت أطول من أي عمود.
const token = (word) => (word.length > MAX_TOKEN
  ? `<span class="brk">${escapeHtml(word)}</span>`
  : escapeHtml(word));

// نص حرّ (جهة عمل، مسمى وظيفي، اسم منشأة…): يُهرَّب ويُحمى من الكلمة الطويلة
// جداً، بلا أي ربط لأدوات الوصل — فهذه ليست أسماء أشخاص.
function wrapText(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return '';
  return text.split(/\s+/).map(token).join(' ');
}

// الاسم → HTML: أدوات الوصل مربوطة بما بعدها في وحدات لا تنكسر، وكل ما عداها
// كلمات عادية تلتف كالمعتاد. النص نفسه لا يتغيّر — لا محارف تُضاف ولا تُحذف —
// فاستخراج النص من الـ PDF والبحث فيه يبقيان كما هما (المسافات مسافات عادية).
function wrapName(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return '';

  const tokens = text.split(/\s+/);
  const units = [];
  let i = 0;

  while (i < tokens.length) {
    const unit = [tokens[i]];
    let length = tokens[i].length;
    // أداة الوصل تسحب الكلمة التي بعدها، وإن كانت تلك أداة وصل أيضاً تسحب ما
    // بعدها («بن عبد العزيز») ما دامت الوحدة تحت الحد الآمن.
    while (
      isConnector(unit[unit.length - 1]) &&
      i + unit.length < tokens.length &&
      length + 1 + tokens[i + unit.length].length <= MAX_UNIT
    ) {
      const next = tokens[i + unit.length];
      unit.push(next);
      length += 1 + next.length;
    }
    units.push(unit);
    i += unit.length;
  }

  return units
    .map((unit) => (unit.length > 1
      ? `<span class="nb">${unit.map(token).join(' ')}</span>`
      : token(unit[0])))
    .join(' ');
}

module.exports = { wrapName, wrapText, MAX_UNIT, MAX_TOKEN, _isConnector: isConnector };

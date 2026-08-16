// ───────────────────────────────────────────────────────────────────────────
// التفاف أسماء الأشخاص داخل خلايا التقرير — التفافٌ يفهم بنية الاسم
// (SEMANTIC NAME-AWARE WRAPPING).
//
// المشكلة: خلية الاسم تلتف على حدود الكلمة، فتتعامل مع كل كلمة كعنصر مستقل
// وتملأ السطر الأول إلى آخره ثم ترمي ما تبقّى إلى السطر التالي. ينتج عن ذلك
// خطآن مختلفان:
//
//   ١) كلمة مرتبطة بما بعدها تُترك يتيمة في آخر السطر:
//
//        ABDOULMOEEN ZAHER AHMED AL
//        BARAKATI                        ← «AL» انفصلت عن اللقب الذي تخصّه
//
//   ٢) توزيعٌ غير متوازن يترك اللقب وحده في سطر:
//
//        MESHARY MUBARAK MOHAMMED
//        ALSHAHRANY                      ← ثلاث كلمات ثم كلمة واحدة
//
// الحل طبقتان متكاملتان:
//
//   الطبقة الأولى (هذا الملف): تجميع دلالي. الاسم يُقسَّم إلى «وحدات» بدل
//   كلمات مفردة، والوحدة لا تنكسر (<span class="nb">)، فيقع الالتفاف بين
//   الوحدات لا داخلها:
//
//        ABDOULMOEEN | ZAHER | AHMED | AL BARAKATI
//
//   الطبقة الثانية (CSS): ‏text-wrap: balance على خلية الاسم، فيوزّع المتصفّح
//   الوحدات على الأسطر توزيعاً متوازناً بدل ملء السطر الأول:
//
//        ABDOULMOEEN ZAHER
//        AHMED AL BARAKATI
//
// الطبقتان معاً تحقّقان: لا كلمة مكسورة، ولا مجموعة منطقية مفصولة، ولا كلمة
// قصيرة يتيمة في آخر السطر، مع أفضل توازن بصري — بلا تغيير حجم الخط ولا عرض
// الخلية، والارتفاع يتكيّف طبيعياً.
//
// الحل عامّ تماماً: يعتمد على بنية الاسم (أدوات الوصل والكلمات القصيرة) لا على
// أي اسم بعينه، فلا يحوي أي استثناء لسجلّ محدّد ولا أي تقسيم ثابت.
//
// النص نفسه لا يتغيّر — لا محارف تُضاف ولا تُحذف — فاستخراج النص من الـ PDF
// والبحث فيه يبقيان كما هما (المسافات مسافات عادية).
//
// نسخة مطابقة لما في الخادم (seha-app-server-main/middlewares/nameWrap.js) —
// أي انحراف بين النسختين يعني أن المعاينة لا تطابق الـ PDF المطبوع.
// ───────────────────────────────────────────────────────────────────────────

import { escapeHtml } from './documentFormat'

// أقصى طول لوحدة لا تنكسر (بالمحارف). الوحدة التي تطول أكثر من عرض العمود
// ستخرج منه، فالتجميع يتوقّف قبل أن يصل إلى هذا الحدّ.
export const MAX_UNIT = 24

// كلمة واحدة أطول من هذا الحد لا يمكن لأي عمود أن يسعها، فتُسمح بالكسر داخلها
// (class="brk"). لا تُوضع إلا عليها وحدها حتى لا يتغيّر ترتيب أي بيانات عادية.
export const MAX_TOKEN = 28

// كلمة بهذا الطول أو أقل لا تقف وحدها في آخر السطر: حرف الاسم الأوسط المختصر
// (‏M‏ في ‏AMJAD AMEEN M SAIFALDEIN‏) وأدوات الوصل القصيرة. تُضمّ إلى ما بعدها.
export const MAX_SHORT = 2

// أدوات الوصل التي تنتمي إلى الكلمة التي بعدها — عربية ومنقولة عنها بالحروف
// اللاتينية، ومعها أدوات الأسماء الأوروبية المركّبة (van der / de la ...).
const CONNECTORS = new Set([
  // منقولة بالحروف اللاتينية
  'al', 'el', 'ad', 'abu', 'abo', 'abou', 'aboo', 'aba', 'abd', 'abdul', 'abdel',
  'abdol', 'abdal', 'bin', 'ben', 'bn', 'ibn', 'bint', 'bnt', 'um', 'umm',
  'bani', 'banu', 'beni', 'ould', 'ait', 'ul', 'ud',
  // أسماء أوروبية مركّبة
  'van', 'von', 'der', 'den', 'de', 'del', 'della', 'da', 'das', 'dos', 'do',
  'di', 'du', 'la', 'le', 'ter', 'ten', 'af', 'av', 'zu', 'san', 'santa',
  // عربية (بعد توحيد الهمزات، فـ«آل» و«أبو» تصلان إلى هنا كـ«ال» و«ابو»)
  'ال', 'بن', 'ابن', 'بنت', 'عبد', 'ابو', 'ابا', 'ام', 'ذو', 'ذي', 'بني', 'بنو',
])

// توحيد شكل الكلمة قبل مطابقتها: حروف صغيرة، بلا علامات ترقيم أو تشكيل، وبألف
// موحّدة — حتى تُعامل «آل» و«ال» و«أبو» و«ابو» و"AL-" و"Al." معاملة واحدة.
const normalizeToken = (word) => String(word)
  .toLowerCase()
  .replace(/[.,'’`\-_]/g, '')
  .replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')

// كلمة تسحب ما بعدها إلى وحدتها: إمّا أداة وصل معروفة («AL» و«بن» و«VAN»…)،
// وإمّا كلمة أقصر من أن تقف وحدها في آخر السطر (حرف مختصر أو أداة غير مدرجة).
// الشرط الثاني يجعل القاعدة عامّة: لا تحتاج إلى معرفة كل أدوات الوصل في العالم.
const bindsForward = (word) => {
  const normalized = normalizeToken(word)
  return normalized.length <= MAX_SHORT || CONNECTORS.has(normalized)
}

// كلمة واحدة → HTML مهرَّب، مع السماح بالكسر داخلها إن كانت أطول من أي عمود.
const token = (word) => (word.length > MAX_TOKEN
  ? `<span class="brk">${escapeHtml(word)}</span>`
  : escapeHtml(word))

// الاسم → مصفوفة وحدات، كل وحدة مصفوفة كلمات تنتقل معاً عند كسر السطر.
//
// الكلمة الرابطة تسحب التي بعدها، وإن كانت تلك رابطة أيضاً تسحب ما بعدها
// («بن عبد العزيز»، «DE LA CRUZ»، «VAN DER BERG») ما دامت الوحدة تحت الحدّ
// الآمن. المصدَّرة للاختبار.
export function groupName(tokens) {
  const units = []
  let i = 0

  while (i < tokens.length) {
    const unit = [tokens[i]]
    let length = tokens[i].length

    while (
      bindsForward(unit[unit.length - 1]) &&
      i + unit.length < tokens.length &&
      length + 1 + tokens[i + unit.length].length <= MAX_UNIT
    ) {
      const next = tokens[i + unit.length]
      unit.push(next)
      length += 1 + next.length
    }

    units.push(unit)
    i += unit.length
  }

  // كلمة رابطة في آخر الاسم لا تجد ما تسحبه (اسم ينتهي بحرف مختصر مثلاً)،
  // فتُضمّ إلى الوحدة التي قبلها بدل أن تبقى وحدها في سطر.
  if (units.length > 1) {
    const last = units[units.length - 1]
    const previous = units[units.length - 2]
    const merged = previous.concat(last).join(' ').length
    if (last.length === 1 && bindsForward(last[0]) && merged <= MAX_UNIT) {
      units.splice(units.length - 2, 2, previous.concat(last))
    }
  }

  return units
}

// نص حرّ (جهة عمل، مسمى وظيفي، اسم منشأة…): يُهرَّب ويُحمى من الكلمة الطويلة
// جداً، بلا أي تجميع دلالي — فهذه ليست أسماء أشخاص.
export function wrapText(value) {
  const text = String(value == null ? '' : value).trim()
  if (!text) return ''
  return text.split(/\s+/).map(token).join(' ')
}

// الاسم → HTML: كل وحدة دلالية داخل <span class="nb"> لا تنكسر، وما عداها
// كلمات عادية تلتف كالمعتاد. التوزيع المتوازن على الأسطر يتكفّل به
// ‏text-wrap: balance‏ على الخلية نفسها (class="name-cell").
export function wrapName(value) {
  const text = String(value == null ? '' : value).trim()
  if (!text) return ''

  return groupName(text.split(/\s+/))
    .map((unit) => (unit.length > 1
      ? `<span class="nb">${unit.map(token).join(' ')}</span>`
      : token(unit[0])))
    .join(' ')
}

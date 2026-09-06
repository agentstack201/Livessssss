// Post-extraction sanitizers.
//
// The LLM extracts values as it reads them, and Saudi medical documents often
// crowd the hospital header, the doctor line, and the patient row with
// neighboring labels (cashier, reception, section, badge number, courtesy
// titles). A crisper prompt cuts most of that; these functions catch what
// still leaks through so the extracted record is presentable without manual
// cleanup.
//
// Every function is idempotent and safe on empty input.

// Words that mean the line is NOT part of the facility's name — anything from
// one of them onward is dropped.
const HOSPITAL_NOISE = [
  // Arabic — front-desk / logistics
  "الكاشير", "كاشير", "الاستقبال", "استقبال", "الاستعلامات", "استعلامات",
  "المحاسبة", "محاسبة", "الحسابات", "أمين الصندوق", "امين الصندوق",
  "أمينة الصندوق", "امينة الصندوق", "الخزنة", "خزنة",
  "قسم", "القسم", "الأقسام", "الطابق", "طابق", "الدور",
  "المدخل", "مدخل", "العيادة", "عيادة", "الجناح", "جناح",
  "رقم الهاتف", "رقم الجوال", "رقم الفاكس", "هاتف", "جوال", "تليفون", "فاكس",
  "ص.ب", "ص ب", "الرمز البريدي", "الرقم الضريبي",
  // Arabic — Seha / ministry banners (specific phrases only, to avoid
  // false-positives on legitimate facility names that contain "صحة")
  "وزارة الصحة", "المركز الوطني للمعلومات", "المركز الوطني للمعلوميات",
  "منصة صحة", "للتحقق من", "الموقع الرسمي",
  // English — front-desk / logistics
  "cashier", "reception", "receptionist", "accounting", "accounts",
  "department", "dept", "floor", "unit", "ward", "clinic",
  "phone", "tel", "telephone", "fax", "mobile", "ext", "extension",
  "p\\.o\\. box", "p\\.o box", "po box", "postal code", "vat",
  // English — Seha / ministry banners (specific phrases)
  "ministry of health", "national health information", "alihealth",
];

// URLs are stripped in a separate pre-pass because the noise-word regex uses
// (?![A-Za-z]) to protect against eating longer ASCII words, and that guard
// blocks a URL match (the char after "www." is a letter).
const URL_RE = /\s*(?:https?:\/\/|www\.)\S*/gi;

// Titles/prefixes that should never appear inside a person-name value.
const NAME_TITLES = [
  // Arabic
  "الدكتور", "الدكتوره", "الدكتورة", "دكتور", "دكتوره", "دكتورة",
  "د\\.", "د\\s", "أ\\.د\\.?", "أ د",
  "الأستاذ الدكتور", "الأستاذ", "الأستاذة",
  "المستشار", "الاستاذ", "الاستاذة",
  "السيد", "السيدة", "الأخ", "الأخت", "المريض", "المريضة",
  // English
  "Dr\\.?", "Doctor", "Prof\\.?", "Professor", "Mr\\.?", "Mrs\\.?", "Ms\\.?",
  "Miss", "Sir", "Madam", "Patient",
];

// From the first occurrence of any noise term, drop to end. The trailing
// (?![A-Za-z]) guards against eating a longer ASCII word (e.g. "receptionist"
// inside "receptionists"); we can't rely on \b because it only fires on ASCII
// word chars, so it never triggers between two Arabic tokens.
const HOSPITAL_NOISE_RE = new RegExp(
  `(?:^|[\\s،,:.\\-–—/|(\\[])\\s*(?:${HOSPITAL_NOISE.join("|")})(?![A-Za-z])[\\s\\S]*$`,
  "i"
);

const NAME_TITLE_RE = new RegExp(
  `^\\s*(?:${NAME_TITLES.join("|")})[\\s.:،,]+`,
  "i"
);

// Also strip title tokens that appear MID-name after a break.
const NAME_TITLE_INLINE_RE = new RegExp(
  `[\\s،,][\\s]*(?:${NAME_TITLES.join("|")})[\\s.:،,]+`,
  "gi"
);

// Zero-width and Arabic tatweel/diacritics that add noise.
const TATWEEL_DIACRITICS_RE = /[ـً-ْٰ​-‏﻿]/g;

/**
 * A hospital name is a single-line facility name. Drop anything after the
 * first line break, and cut off at the first noise word (cashier, reception,
 * department, phone …). Collapse whitespace.
 *
 * Example:
 *   "مستشفى الملك فهد التخصصي\nالكاشير - محمد أحمد\nهاتف: 011..."
 *     → "مستشفى الملك فهد التخصصي"
 */
function sanitizeHospitalName(raw) {
  if (raw == null) return "";
  let s = String(raw).replace(TATWEEL_DIACRITICS_RE, "").trim();
  if (!s) return "";

  // 1. Multiline hospital names are always a paste of the whole header. Keep
  //    the FIRST non-empty line — the facility name typically sits on it.
  const firstLine = s.split(/\r?\n/).find((l) => l.trim());
  s = (firstLine || s).trim();

  // 2. Strip any URLs first (see comment on URL_RE).
  s = s.replace(URL_RE, "").trim();

  // 3. Cut at the first noise word (with a boundary so it doesn't eat the name).
  s = s.replace(HOSPITAL_NOISE_RE, "").trim();

  // 4. Strip trailing bare digits / separators left over from truncated info.
  s = s.replace(/[\s\d:،,.\-–—|/(\[]+$/g, "").trim();

  // 5. Collapse internal whitespace.
  s = s.replace(/\s{2,}/g, " ");
  return s;
}

/**
 * A person name should carry no honorific prefix and no trailing role/badge.
 * We strip Dr./الدكتور at the start, any inline title after a comma, and any
 * suffix from the first parenthesis or from an explicit role separator.
 */
function sanitizePersonName(raw) {
  if (raw == null) return "";
  let s = String(raw).replace(TATWEEL_DIACRITICS_RE, "").trim();
  if (!s) return "";

  // 1. Keep only the first non-empty line — same reasoning as hospital.
  const firstLine = s.split(/\r?\n/).find((l) => l.trim());
  s = (firstLine || s).trim();

  // 2. Strip a leading title.
  s = s.replace(NAME_TITLE_RE, "").trim();

  // 3. Strip any inline title after a comma/space.
  s = s.replace(NAME_TITLE_INLINE_RE, " ").trim();

  // 4. Drop anything from the first parenthesis onward (usually specialty).
  s = s.split(/\s*[\(（\[]/)[0].trim();

  // 5. Drop role/badge suffixes that got glued on.
  s = s
    .replace(
      /\s*[-–—|/,،:]\s*(?:طبيب|طبيبة|أخصائي|اختصاصي|استشاري|مقيم|specialist|consultant|resident|badge|رقم|license|رخصة)\b[\s\S]*$/i,
      ""
    )
    .trim();

  // 6. Collapse internal whitespace.
  s = s.replace(/\s{2,}/g, " ");
  return s;
}

/**
 * IDs are digits only. Any prefix ("رقم الهوية:") or separators get stripped.
 * Returns "" for anything that is not a plausible ID (< 6 digits).
 */
function sanitizeNationalId(raw) {
  if (raw == null) return "";
  const digits = String(raw).replace(/\D+/g, "");
  return digits.length >= 6 ? digits : "";
}

/**
 * Phone: keep an optional leading + and digits only, drop everything else.
 * Returns "" if fewer than 6 digits remain.
 */
function sanitizePhone(raw) {
  if (raw == null) return "";
  const s = String(raw).trim();
  const plus = s.startsWith("+") ? "+" : "";
  const digits = s.replace(/\D+/g, "");
  return digits.length >= 6 ? plus + digits : "";
}

module.exports = {
  sanitizeHospitalName,
  sanitizePersonName,
  sanitizeNationalId,
  sanitizePhone,
};

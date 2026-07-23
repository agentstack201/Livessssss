const { toHijri } = require("hijri-converter");

// Convert a Gregorian date string (expected format: YYYY-MM-DD) to a Hijri
// date string (DD-MM-YYYY). Returns '' for a missing/invalid input instead of
// throwing, so a badly-formatted date can never crash leave creation/update.
module.exports = (gregorianDate) => {
  if (!gregorianDate || typeof gregorianDate !== "string") return "";

  const match = gregorianDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return "";

  try {
    const hijriDate = toHijri(year, month, day);
    return `${hijriDate.hd}-${hijriDate.hm}-${hijriDate.hy}`;
  } catch (error) {
    return "";
  }
};

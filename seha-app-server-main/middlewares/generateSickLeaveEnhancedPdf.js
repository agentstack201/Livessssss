// ───────────────────────────────────────────────────────────────────────────
// مولّد الـ PDF للقالب الخامس — «تقرير إجازة مرضية - محسن»
//
// لا يبني هذا الملف مستنداً ولا يرسم تخطيطاً: القالب هو ملف PDF الأصلي نفسه
// (templates/template5/master.pdf)، وكل ما يجري هنا هو تمرير السجلّ إلى محرّك
// ربط البيانات الذي يستبدل نصوص الحقول داخل الملف ويترك كل شيء آخر كما هو.
//
// لذلك لا حاجة هنا إلى متصفح ولا إلى HTML: التوليد عملية على الملف مباشرة،
// أسرع وأخف من بقية القوالب، ومخرَجه نصٌّ متجهٌ قابل للنسخ والبحث.
//
// التوقيع مطابق لبقية المولّدات (data, leave_days, DateObj, country) فيعمل
// عبر نفس مُرسِل القوالب في المتحكّم بلا أي تعديل فيه.
// ───────────────────────────────────────────────────────────────────────────
const { renderTemplate5Pdf } = require('../templates/template5');

module.exports = async (data, leave_days, DateObj, country) => {
  try {
    return renderTemplate5Pdf({
      data,
      leaveDays: leave_days,
      country,
      reportDate: (DateObj && DateObj.currentDate) || '',
      reportTime: (DateObj && DateObj.currentTime) || '',
    });
  } catch (error) {
    console.error('❌ Template-5 PDF Generation Error:', error);
    throw new Error(`Failed to generate template-5 PDF: ${error.message}`);
  }
};

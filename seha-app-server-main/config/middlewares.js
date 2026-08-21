// const { generateInvoicePdf } = require("../middlewares/generatePdf");
const mwError = require("../middlewares/validationMW");
const auth = require("../middlewares/authMW");
const createPDF = require("../middlewares/generatePdf"); // استخدام النسخة المحدثة مع dynamic imports
const createCompanionPDF = require("../middlewares/generateCompanionPdf"); // قالب «مشهد مراجعة لمرافق»
const createVisitStatementPDF = require("../middlewares/generateVisitStatementPdf"); // قالب «مشهد مراجعة»
const createCompanionSickLeavePDF = require("../middlewares/generateCompanionSickLeavePdf"); // قالب «تقرير مرافقة مريض»
const createSickLeaveEnhancedPDF = require("../middlewares/generateSickLeaveEnhancedPdf"); // القالب الخامس «تقرير إجازة مرضية - محسن»
const generatePaperPdf = require("../middlewares/generatePaperPdf"); // المولّد العام للقوالب الورقية
const calcDays = require("../middlewares/calcDays");

// موزِّع القوالب الورقية: يبقي توقيع الاستدعاء في المتحكّم كما هو تماماً
// (data, leave_days, DateObj, country)، ويستنتج التصميم من نوع المستند.
const createPaperPDF = (data, leave_days, DateObj, country) => {
  const { paperTemplateFor } = require("./documentTypes");
  const templateId = paperTemplateFor(data.document_type);
  if (!templateId) throw new Error(`No paper template for document_type=${data.document_type}`);
  return generatePaperPdf(templateId, data, leave_days, DateObj, country);
};
const convertDates = require("../middlewares/convertDates");
const permission = require("../middlewares/permissionMW");

module.exports = {
  mwError,
  auth,
  createPDF,
  createCompanionPDF,
  createVisitStatementPDF,
  createCompanionSickLeavePDF,
  createSickLeaveEnhancedPDF,
  createPaperPDF,
  calcDays,
  convertDates,
  permission
};

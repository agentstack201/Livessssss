// const { generateInvoicePdf } = require("../middlewares/generatePdf");
const mwError = require("../middlewares/validationMW");
const auth = require("../middlewares/authMW");
const createPDF = require("../middlewares/generatePdf"); // استخدام النسخة المحدثة مع dynamic imports
const createCompanionPDF = require("../middlewares/generateCompanionPdf"); // قالب «مشهد مراجعة لمرافق»
const calcDays = require("../middlewares/calcDays");
const convertDates = require("../middlewares/convertDates");
const permission = require("../middlewares/permissionMW");

module.exports = {
  mwError,
  auth,
  createPDF,
  createCompanionPDF,
  calcDays,
  convertDates,
  permission
};

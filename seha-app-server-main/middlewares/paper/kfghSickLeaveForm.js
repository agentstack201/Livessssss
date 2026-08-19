// ───────────────────────────────────────────────────────────────────────────
// «تقرير إجازة مرضية» ثنائي اللغة — مستشفى الملك فهد العام (نموذج Word)
// مستنسخ عن الملف المرفق: ترويسة صورة بعرض الصفحة، عمودان (إنجليزي يسار /
// عربي يمين) لبيانات المريض، ثم كتلة التوصيات ومدة الإجازة، ثم ثلاثة صفوف
// أطباء وتواقيع، ثم الأختام، ثم حاشية إلكترونية مسطّرة.
// ───────────────────────────────────────────────────────────────────────────

const css = `
.sheet { width: 210mm; height: 297mm; padding: 8mm 12mm 6mm; direction: ltr; overflow: hidden; position: relative; }

.lh { text-align: center; margin-bottom: 4px; }
.lh img { max-width: 100%; max-height: 84px; object-fit: contain; }
.lh .txt { display: flex; align-items: center; gap: 10px; }
.lh .txt .en { flex: 1; text-align: left; font-size: 12.4px; font-weight: 700; line-height: 1.55; }
.lh .txt .ar { flex: 1; text-align: right; font-size: 12.8px; font-weight: 700; line-height: 1.55; }
.lh .txt .mid { width: 130px; }
.lh .txt .mid img { max-height: 72px; }

/* ── صفوف ثنائية اللغة ────────────────────────────────────────────────── */
.brow { display: flex; align-items: baseline; gap: 16px; padding: 4.4px 0; font-size: 13px; font-weight: 700; }
.brow .en { flex: 1; text-align: left; }
.brow .ar { flex: 1; text-align: right; }
.gap { height: 10px; }

/* ── كتلة التوصيات ────────────────────────────────────────────────────── */
.reco { margin-top: 4px; }
.reco .brow { padding: 5.5px 0; }

/* ── صفوف الأطباء ─────────────────────────────────────────────────────── */
.docs { margin-top: 14px; }
.drow { display: flex; align-items: flex-end; gap: 12px; padding: 7px 0; font-size: 13px; font-weight: 700; }
.drow .en { flex: 1; text-align: left; display: flex; gap: 46px; }
.drow .ar { flex: 1; text-align: right; position: relative; }
.drow .ar img { position: absolute; right: 60px; bottom: 2px; max-height: 42px; max-width: 150px; object-fit: contain; }

/* ── الأختام ──────────────────────────────────────────────────────────── */
.seals { display: flex; align-items: flex-start; gap: 12px; margin-top: 10px; font-size: 13px; font-weight: 700; }
.seals .en { flex: 1; text-align: left; }
.seals .ar { flex: 1; text-align: right; }
.seals img { max-height: 120px; max-width: 190px; object-fit: contain; vertical-align: middle; }

.efoot { position: absolute; left: 12mm; right: 12mm; bottom: 7mm; text-align: center;
         font-size: 10.6px; font-weight: 700; text-decoration: underline; line-height: 1.65; }
`;

const HDR_EN = ['Kingdom of Saudi Arabia', 'Ministry of Health', 'King Fahad General Hospital'];
const HDR_AR = ['المملكة العربية السعودية', 'وزارة الصحة', 'مستشفى الملك فهد العام'];

function lines(ctx, key, fallback, cls) {
  const raw = ctx.raw(key);
  const arr = typeof raw === 'string' && raw.trim() ? raw.split('\n') : fallback;
  return arr.map((l) => `<div class="${cls}">${ctx.esc(l)}</div>`).join('');
}

function body(ctx) {
  const { f, fml, esc, data, raw, check, facilityLogo } = ctx;
  const img = (v) => (v ? `<img src="${esc(v)}" alt="">` : '');
  const row = (en, ar) => `<div class="brow"><span class="en en">${en}</span><span class="ar ar">${ar}</span></div>`;

  // الترويسة: صورة بعرض الصفحة إن وُجدت، وإلا نصّ ثلاثي كما في الأصل.
  const header = raw('header_image')
    ? `<div class="lh">${img(raw('header_image'))}</div>`
    : `<div class="lh"><div class="txt">
         <div class="en">${lines(ctx, 'header_en', HDR_EN, 'en')}</div>
         <div class="mid">${img(facilityLogo)}</div>
         <div class="ar">${lines(ctx, 'header_ar', HDR_AR, 'ar')}</div>
       </div></div>`;

  return `
<div class="sheet">
  ${header}

  ${row(`Full Name: ${esc(data.name_en)}`, `اسم المريض الكامل : ${esc(data.name_ar)}`)}
  ${row(`Sex : ${check(raw('sex') === 'M')} Male &nbsp;&nbsp;&nbsp; ${check(raw('sex') === 'F')} Female`,
        `${check(raw('sex') === 'F')} انثى &nbsp;&nbsp;&nbsp; ${check(raw('sex') === 'M')} ذكر &nbsp;&nbsp; : الجنس`)}
  ${row(`Patient File NO : ${f('medical_record_no')}`, `رقم الملف الطبي : ${f('medical_record_no')}`)}
  ${row(`Age : ${f('age')}`, `العمر : ${f('age')}`)}
  ${row(`Nationality: ${esc(ctx.country?.country_name_en || '')}`, `الجنسية : ${esc(ctx.country?.country_name_ar || data.nationality || '')}`)}
  ${row(`Address : ${f('address')}`, `رقم الهوية : ${esc(data.national_id)}`)}
  ${row(`Place of work : ${esc(data.employer_en)}`, `جهة العمل : ${esc(data.employer_ar)}`)}
  ${row(`Date of Clinic visit : ${f('visit_date')}`, `تاريخ مراجعة العيادة : ${f('visit_date')}`)}
  ${row(`Admission date: ${esc(data.admission_date_en)}`, `تاريخ دخول المستشفى : ${f('adm_date_ar', esc(data.admission_date_en))}`)}
  ${row(`Date  of discharge: ${esc(data.discharge_date_en)}`, `تاريخ الخروج من المستشفى : ${f('dis_date_ar', esc(data.discharge_date_en))}`)}
  ${row(`Diagnosis: ${f('diagnosis_en')}`, `التشخيص : ${f('diagnosis_ar')}`)}

  <div class="gap"></div>
  <div class="reco">
    ${row(`Recommendations:`, `التوصيــات :`)}
    ${row(`${f('followup_en')}`, `يراجع المستشفى في ${f('followup_date')}`)}
    ${row(`The individual named above is in need for sick leave For ( ${f('leave_days_en')} ) Days`,
          `يحتاج إلى اجازة مرضية لمدة ( ${f('leave_days_ar', String(ctx.leave_days || ''))} ) أيام`)}
    ${row(`sick leave starting from : ${f('leave_from_en')}`, `اعتبارا من تاريخ : ${f('leave_from_ar')}`)}
    ${row(`to : ${f('leave_to_en')}`, `الى تاريخ : ${f('leave_to_ar')}`)}
  </div>

  <div class="docs">
    <div class="drow">
      <span class="en"><span>Name of physician:</span><span>signature:</span></span>
      <span class="ar">${img(raw('signature_image'))} التوقيع : &nbsp; ${f('physician1', esc(data.physician_name_ar))} : الطبيب</span>
    </div>
    <div class="drow">
      <span class="en"><span>Name of physician:</span><span>signature:</span></span>
      <span class="ar">${img(raw('signature2_image'))} التوقيع : &nbsp; ${f('physician2')} : الطبيب</span>
    </div>
    <div class="drow">
      <span class="en"><span>Name of physician:</span><span>signature:</span></span>
      <span class="ar">${img(raw('signature3_image'))} التوقيع : &nbsp; ${f('physician3')} : الطبيب</span>
    </div>
  </div>

  <div class="seals">
    <span class="en">the seal : ${img(raw('seal2_image'))}</span>
    <span class="ar">${img(raw('stamp_image'))} &nbsp; الختم :</span>
  </div>

  <div class="efoot ar">${fml('efoot_note', 'هذه الوثيقة صادرة من قسم التقارير الطبية عن طريق الحاسب الآلي معتمدة بالتوقيع الألكتروني ولا تحتاج إلى توقيع يدوي ويكتفى بالختم الرسمي لمستشفى الملك فهد العام')}</div>
</div>`;
}

module.exports = { css, body };

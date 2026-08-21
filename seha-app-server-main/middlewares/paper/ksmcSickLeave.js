// ───────────────────────────────────────────────────────────────────────────
// «تقرير إجازة مرضية» — SICK LEAVE REPORT — مدينة الملك سعود الطبية
// مستنسخ عن ملف Word المرفق: ترويسة صورة، عنوان مؤطَّر، عمودان لبيانات
// المريض (إنجليزي يسار / عربي يمين)، كتلة توصيات بخانات اختيار، ثم
// خطاب إداري ختامي.
//
// «KINGDOM OF SAUDA ARABIA» مكتوبة هكذا في ترويسة الأصل — أُبقيت مطابقةً له.
// ───────────────────────────────────────────────────────────────────────────

const css = `
.sheet { width: 210mm; height: 297mm; padding: 8mm 12mm 6mm; direction: ltr; overflow: hidden; position: relative; }

.lh { text-align: center; margin-bottom: 6px; }
.lh > img { width: 100%; height: auto; object-fit: contain; display: block; }
.lh .txt { display: flex; align-items: center; gap: 10px; }
.lh .txt .en { flex: 1; text-align: left; font-size: 13px; font-weight: 700; line-height: 1.9; }
.lh .txt .ar { flex: 1; text-align: right; font-size: 13px; font-weight: 700; line-height: 1.9; }
.lh .txt .mid { width: 135px; }
.lh .txt .mid img { max-height: 80px; }

/* عنوان مؤطَّر في الوسط */
.title { display: flex; justify-content: center; margin: 4px 0 12px; }
.title > span { display: inline-block; border: 1.4px solid #000; padding: 3px 26px;
                font-size: 14.5px; font-weight: 700; line-height: 1.45; text-align: center; }

/* ── بيانات المريض ────────────────────────────────────────────────────── */
.brow { display: flex; align-items: baseline; gap: 16px; padding: 4px 0; font-size: 13px; font-weight: 700; }
.brow .en { flex: 1; text-align: left; }
.brow .ar { flex: 1; text-align: right; }
.brow .ar .two { display: inline-block; min-width: 150px; }

/* ── التوصيات ─────────────────────────────────────────────────────────── */
.reco { margin-top: 10px; border-top: 1.1px solid #000; padding-top: 8px; }
.rhead { display: flex; font-size: 13.5px; font-weight: 700; }
.rhead .en { flex: 1; text-align: left; }
.rhead .ar { flex: 1; text-align: right; }
.ritem { display: flex; align-items: baseline; gap: 10px; padding: 4px 0; font-size: 12.7px; font-weight: 700; }
.ritem .en { flex: 1; text-align: left; display: flex; gap: 8px; align-items: baseline; }
.ritem .ar { flex: 1; text-align: right; display: flex; gap: 8px; align-items: baseline; justify-content: flex-end; }

/* ── الخطاب الإداري ───────────────────────────────────────────────────── */
.letter { margin-top: 8px; direction: rtl; text-align: right; font-size: 12.6px; font-weight: 700; line-height: 1.85; }
.letter .greet { display: flex; justify-content: space-between; }
.sig { margin-top: 10px; display: flex; align-items: flex-end; justify-content: space-between; }
.sig img { max-height: 84px; max-width: 165px; object-fit: contain; }

/* صفوف الأطباء ومربّعات الأسماء — كما في تذييل المستند الأصلي */
.docs { margin-top: 8px; border-top: 1.1px solid #000; padding-top: 8px; position: relative; }
.docs .drow { display: flex; align-items: baseline; gap: 12px; padding: 5px 0; font-size: 12.6px; font-weight: 700; }
.docs .drow .en { flex: 1; text-align: left; display: flex; gap: 40px; }
.docs .drow .ar { flex: 1; text-align: right; }
.docs .boxes { position: absolute; left: 44%; top: 4px; max-height: 96px; object-fit: contain; }
.note-imp { margin-top: 6px; font-size: 11.6px; font-weight: 700; text-align: right; }
`;

const HDR_EN = ['KINGDOM OF SAUDA ARABIA', 'Ministry of health', 'King Saud Medical City'];
const HDR_AR = ['المملكة العربية السعودية', 'وزارة الصحة', 'مدينة الملك سعود الطبية'];

function lines(ctx, key, fallback, cls) {
  const raw = ctx.raw(key);
  const arr = typeof raw === 'string' && raw.trim() ? raw.split('\n') : fallback;
  return arr.map((l) => `<div class="${cls}">${ctx.esc(l)}</div>`).join('');
}

function body(ctx) {
  const { f, fml, esc, data, raw, asset, check, facilityLogo } = ctx;
  const on = (k) => raw(k) === true || raw(k) === 'true';
  const img = (v) => (v ? `<img src="${esc(v)}" alt="">` : '');
  const row = (en, ar) => `<div class="brow"><span class="en en">${en}</span><span class="ar ar">${ar}</span></div>`;
  const item = (k, en, ar) => `<div class="ritem">
      <span class="en en">${check(on(k))} ${en}</span>
      <span class="ar ar">${ar} ${check(on(k))}</span>
    </div>`;

  const header = asset('header_image')
    ? `<div class="lh">${img(asset('header_image'))}</div>`
    : `<div class="lh"><div class="txt">
         <div class="en">${lines(ctx, 'header_en', HDR_EN, 'en')}</div>
         <div class="mid">${img(facilityLogo)}</div>
         <div class="ar">${lines(ctx, 'header_ar', HDR_AR, 'ar')}</div>
       </div></div>`;

  return `
<div class="sheet">
  ${header}

  <div class="title">
    <span><span class="ar">${f('title_ar', 'تقرير إجازة مرضية')}</span><br><span class="en">${f('title_en', 'SICK LEAVE REPORT')}</span></span>
  </div>

  ${row(`Patient Name: ${esc(data.name_en)}`, `اسم المريض : ${esc(data.name_ar)}`)}
  ${row(`Medical Record No: ${f('medical_record_no')} &nbsp;&nbsp;&nbsp; Sex: ${f('sex_en')}`,
        `<span class="two">الجنس : ${f('sex_ar')}</span> رقم السجل الطبي : ${f('medical_record_no')}`)}
  ${row(`Nationality: ${esc(ctx.country?.country_name_en || '')}`, `الجنسية: ${esc(ctx.country?.country_name_ar || data.nationality || '')}`)}
  ${row(`Data Of Birth: ${f('date_of_birth')}`, `السجل المدني : ${esc(data.national_id)}`)}
  ${row(`Occupation: ${f('occupation_en')}`, `المهنة: ${f('occupation_ar')}`)}
  ${row(`Place Of Work: ${esc(data.employer_en)}`, `جهة العمل : ${esc(data.employer_ar)}`)}
  ${row(`Date Of Visit: ${f('visit_date')}`, `تاريخ المراجعة: ${f('visit_date')}`)}
  ${row(`Adm.Date: ${esc(data.admission_date_en)}`, `تاريخ الدخول: ${f('adm_date_ar', esc(data.admission_date_en))}`)}
  ${row(`Discharge Date: ${esc(data.discharge_date_en)}`, `تاريخ الخروج: ${f('dis_date_ar', esc(data.discharge_date_en))}`)}

  <div class="reco">
    <div class="rhead"><span class="en">Recommendation</span><span class="ar">التوصيات</span></div>
    <div class="rhead" style="font-size:12.7px;padding-top:2px">
      <span class="en">Following Medical Examination, It Is Recommend:</span>
      <span class="ar">بالكشف الطبي على المريض نوصي :</span>
    </div>

    ${item('rec_sick_leave', `Sick Leave……..Day(s).`, `منحه إجازة مرضية لمدة ( ${f('leave_days_ar', String(ctx.leave_days || ''))} ) يوم فقط`)}
    ${item('rec_period', `Starting From…………To……….`, `ورقما (${f('leave_days_num')}) يوم /يوماً إلى تاريخ: ${f('leave_to_ar')}`)}
    ${item('rec_follow_up', `Follow up before end sick leave.`, `مراجعة الطبيب المعالج قبل انتهاء إجازته`)}
    ${item('rec_referral', `Referral up to Medical committee for following reason:`, `إحالته إلى الهيئة الطبية العامة لأحد الأسباب التالية:`)}
    ${item('rec_approval', `Approval of sick leave`, `اعتماد التقرير الطبي .`)}
    ${item('rec_cannot_treat', `Cannot be treated at this facility.`, `من غير الممكن علاجه في المشفى .`)}
    ${item('rec_disability', `Permanent or partial disability.`, `حالته تدل على عجزه الصحي عن العمل بصورة جزئية او قطعية`)}
    ${item('rec_others', `Others:`, `أخرى : ${f('others_text')}`)}
  </div>

  <div class="docs">
    ${asset('doctor_boxes_image') ? `<img class="boxes" src="${esc(asset('doctor_boxes_image'))}" alt="">` : ''}
    <div class="drow">
      <span class="en en"><span>Treating physician Name:</span><span>Signature:</span></span>
      <span class="ar ar">${f('physician1', esc(data.physician_name_ar))} : اسم الطبيب</span>
    </div>
    <div class="drow">
      <span class="en en"><span>physician Name:</span><span>Signature:</span></span>
      <span class="ar ar">${f('physician2')} : اسم الطبيب المعالج</span>
    </div>
  </div>

  <div class="letter ar">
    <div class="greet"><span>سعادة/ ${f('addressee')}</span><span>المحترم</span></div>
    <div>${f('salutation', 'السلام عليكم ورحمة الله وبركاته')}</div>
    <div>${f('letter_line1', 'إشارة الى مراجعة الموظف لديكم الموضح اسمه اعلاها للكشف')}</div>
    <div>${f('letter_line2', 'عليه تجدون بعالية التقرير الصادر بشأنه')}</div>
    <div class="sig">
      <span>${img(asset('stamp_image'))}</span>
      <span>${img(asset('signature_image'))}</span>
    </div>
    <div class="note-imp">${f('important_note', 'ملاحظة هامة : لا يعتمد هذا التقرير مالم يحمل الختم الرسمي')}</div>
  </div>
</div>`;
}

module.exports = { css, body };

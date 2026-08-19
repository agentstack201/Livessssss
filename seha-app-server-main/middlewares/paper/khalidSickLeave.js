// ───────────────────────────────────────────────────────────────────────────
// «تقرير بأجازة مرضية (ج)» — SICK LEAVE REPORT ( C )
// مجمع خالد المتميز الطبي للطب العام — مستنسخ عن النموذج الورقي المرفق.
//
// التخطيط والمسافات والحدود والترتيب منقولة عن الورقة الأصلية كما هي؛ الجديد
// هو أن كل قيمة صارت حقلاً ديناميكياً. الأخطاء المطبعية في النموذج الأصلي
// («bate of BIrth»، «Adm, Dato»، «Discharge Dato»، «committe») مُبقاة عمداً
// مطابقةً للأصل — ليست أخطاءً من عندنا.
// ───────────────────────────────────────────────────────────────────────────

const css = `
.sheet { width: 210mm; height: 297mm; padding: 6mm 6mm 4mm; direction: ltr; overflow: hidden; }

/* ── الترويسة: إنجليزي يسار، شعار وسط، عربي يمين ───────────────────────── */
.hdr { display: flex; align-items: flex-start; gap: 6px; }
.hdr-en { flex: 1; font-size: 11px; font-weight: 700; line-height: 1.28; text-align: left; }
.hdr-ar { flex: 1; font-size: 11.5px; font-weight: 700; line-height: 1.38; text-align: right; }
.hdr-logo { width: 108px; flex-shrink: 0; text-align: center; padding-top: 2px; }
.hdr-logo img { max-width: 100%; max-height: 78px; object-fit: contain; }

/* ── شريط العنوان المؤطَّر ─────────────────────────────────────────────── */
.title-row { display: flex; justify-content: center; margin: 2px 0 6px; }
.title-box {
  border: 1.6px solid #000; padding: 2px 14px;
  display: flex; gap: 26px; align-items: center;
  font-size: 14.5px; font-weight: 700;
}

/* ── الصندوق الرئيسي ──────────────────────────────────────────────────── */
.box { border: 1.6px solid #000; }
.box + .box { border-top: 0; }
.sec { padding: 4px 9px; }

/* صف: تسمية إنجليزية يسار، قيمة وسط، تسمية عربية يمين */
.row { display: flex; align-items: baseline; gap: 8px; padding: 1.7px 0; }
.row .l { flex: 0 0 34%; font-size: 12.8px; font-weight: 700; text-align: left; }
.row .v { flex: 1; font-size: 12.8px; font-weight: 700; text-align: center; }
.row .r { flex: 0 0 34%; font-size: 12.8px; font-weight: 700; text-align: right; }

/* صف الجنس: خانتان على كل جهة */
.sex { display: flex; align-items: center; gap: 8px; padding: 1.7px 0; font-size: 12.8px; font-weight: 700; }
.sex .side { flex: 0 0 34%; display: flex; gap: 26px; }
.sex .side.rt { justify-content: flex-end; direction: rtl; }
.sex .mid { flex: 1; }

/* ── التوصيات ─────────────────────────────────────────────────────────── */
.reco-head { display: flex; align-items: baseline; padding: 1px 0 4px; }
.reco-head .en { flex: 1; font-size: 15px; font-weight: 700; text-align: left; padding-left: 62px; }
.reco-head .ar { flex: 1; font-size: 14px; font-weight: 700; text-align: right; letter-spacing: .5px; }
.reco-sub { display: flex; align-items: baseline; font-size: 12.6px; font-weight: 700; padding-bottom: 4px; }
.reco-sub .en { flex: 1; text-align: left; }
.reco-sub .ar { flex: 1; text-align: right; }

/* بند توصية: خانة+نص إنجليزي يسار، نص عربي+خانة يمين */
.item { display: flex; align-items: baseline; gap: 8px; padding: 2.2px 0; font-size: 12.8px; font-weight: 700; }
.item .en { flex: 1; display: flex; align-items: baseline; gap: 7px; text-align: left; }
.item .ar { flex: 1; display: flex; align-items: baseline; gap: 7px; justify-content: flex-end; text-align: right; }
.item .mid { flex: 0 0 auto; text-align: center; font-size: 12.6px; }
.sub { padding-right: 0; padding-left: 30px; }

/* ── كتلة الأطباء ─────────────────────────────────────────────────────── */
.pline { display: flex; align-items: baseline; gap: 8px; padding: 2.6px 0; font-size: 12.8px; font-weight: 700; }
.pline .en { flex: 1; text-align: left; }
.pline .ar { flex: 1; text-align: right; }
.dash { display: inline-block; min-width: 120px; border-bottom: 1.2px solid #000; height: 11px; }
.sig-img { max-height: 46px; max-width: 190px; object-fit: contain; }

/* ── التذييل الإداري + الختم ───────────────────────────────────────────── */
.foot { position: relative; padding: 5px 9px 3px; font-size: 12.4px; font-weight: 700; line-height: 1.72; }
.foot .ln { display: flex; justify-content: space-between; }
.stamp { position: absolute; left: 12px; bottom: 6px; max-width: 190px; max-height: 150px; object-fit: contain; }
`;

// أسطر الترويسة قابلة للتعديل بالكامل — لكل منشأة ترويستها.
const HDR_EN_DEFAULT = [
  'Khalid Distinct Medical Center', 'FOR GENERAL MEDICINE',
  'Jeddah-Kilo 8-baladiya Al-Jamea', 'St.-Al-Rawaby dist',
  'Tel: 6255555 (20 Lines) - Fax: 6242924',
  'P.B.box 30059 Jeddah 21477-VAT No.', '300241963900003',
];
const HDR_AR_DEFAULT = [
  'مجمع خالد المتميز الطبي', 'للطــب العــام',
  'جده – كيلو 8 – شارع بلدية الجامعة – حي الروابي',
  '6242924 (20) 6255555 ملف',
  'ص ب 30050 جده 21477 – الرقم الضريبي', '300241963900003',
];

function lines(ctx, key, fallback) {
  const raw = ctx.raw(key);
  const arr = typeof raw === 'string' && raw.trim() ? raw.split('\n') : fallback;
  return arr.map((l) => `<div>${ctx.esc(l)}</div>`).join('');
}

function body(ctx) {
  const { f, check, esc, data, raw, facilityLogo } = ctx;
  const on = (k) => raw(k) === true || raw(k) === 'true';

  return `
<div class="sheet">

  <header class="hdr">
    <div class="hdr-en en">${lines(ctx, 'header_en', HDR_EN_DEFAULT)}</div>
    <div class="hdr-logo">${facilityLogo ? `<img src="${esc(facilityLogo)}" alt="">` : ''}</div>
    <div class="hdr-ar ar">${lines(ctx, 'header_ar', HDR_AR_DEFAULT)}</div>
  </header>

  <div class="title-row">
    <span class="title-box">
      <span class="en">SICK LEAVE REPORT ( C )</span>
      <span class="ar">تقرير بأجازة مرضية (ج)</span>
    </span>
  </div>

  <!-- بيانات المريض -->
  <div class="box"><div class="sec">
    <div class="row"><span class="l en">Patient Name: ${esc((data.name_en || '').toUpperCase())}</span><span class="v"></span><span class="r ar">${esc(data.name_ar)}&nbsp;&nbsp;: اسم المريض</span></div>
    <div class="row"><span class="l en">Medical Record No:</span><span class="v en">${f('medical_record_no')}</span><span class="r ar">رقم السجل الطبي :</span></div>
    <div class="sex">
      <span class="side en">${check(raw('sex') === 'M')} M &nbsp;&nbsp;&nbsp; ${check(raw('sex') === 'F')} F</span>
      <span class="mid"></span>
      <span class="side rt ar">${check(raw('sex') === 'F')} انثى &nbsp;&nbsp;&nbsp; ${check(raw('sex') === 'M')} ذكر</span>
    </div>
    <div class="row"><span class="l en">Nationality:</span><span class="v ar">${esc(ctx.country?.country_name_ar || data.nationality || '')}</span><span class="r ar">الجنسية :</span></div>
    <div class="row"><span class="l en">bate of BIrth:</span><span class="v en">${f('date_of_birth')}</span><span class="r ar">تاريخ الميلاد:</span></div>
    <div class="row"><span class="l en">Occupation :</span><span class="v">${f('occupation')}</span><span class="r ar">المهنة :</span></div>
    <div class="row"><span class="l en">Place of work:</span><span class="v">${esc(data.employer_ar || data.employer_en || '')}</span><span class="r ar">جهة العمل :</span></div>
    <div class="row"><span class="l en">Date of visit:</span><span class="v en">${f('visit_date')}</span><span class="r ar">تاريخ المراجعة :</span></div>
    <div class="row"><span class="l en">Adm, Dato:</span><span class="v en">${esc(data.admission_date_en)}</span><span class="r ar">تاريخ الدخول :</span></div>
    <div class="row"><span class="l en">Discharge Dato:</span><span class="v en">${esc(data.discharge_date_en)}</span><span class="r ar">تاريخ الخروج :</span></div>
  </div></div>

  <!-- التوصيات -->
  <div class="box"><div class="sec">
    <div class="reco-head"><span class="en">Recommendation</span><span class="ar">التوصــــيات</span></div>
    <div class="reco-sub"><span class="en">Following medical examination, It is recommended:</span><span class="ar">بالكشف على المريض نوصي بالآتي :</span></div>

    <div class="item">
      <span class="en">${check(on('rec_sick_leave'))} Sick leave for ${f('leave_days_text', String(ctx.leave_days || ''))} day(s)</span>
      <span class="ar">منحه اجازة مرضية لمدة ${f('leave_days_text', String(ctx.leave_days || ''))} يوم ${check(on('rec_sick_leave'))}</span>
    </div>
    <div class="item sub">
      <span class="en">Starting from: ${f('leave_from', esc(data.admission_date_en))} To ${f('leave_to', esc(data.discharge_date_en))}</span>
      <span class="ar">اعتبارا من ${f('leave_from_ar')} إلى ${f('leave_to_ar')}</span>
    </div>
    <div class="item">
      <span class="en">${check(on('rec_follow_up'))} Follow up before end of sick leave</span>
      <span class="ar">مراجعة الطبيب المعالج قبل إنتهاء أجازته . ${check(on('rec_follow_up'))}</span>
    </div>
    <div class="item">
      <span class="en">${check(on('rec_referral'))} Referral to medical committe for following reasons:</span>
      <span class="ar">إحالته إلى الهيئة الطبية العامة لأحد الأسباب التالية : ${check(on('rec_referral'))}</span>
    </div>
    <div style="height:13px"></div>
    <div class="item">
      <span class="en">${check(on('rec_approval'))} Approval of sick leave:</span>
      <span class="ar">اعتماد التقرير الطبي : ${check(on('rec_approval'))}</span>
    </div>
    <div class="item">
      <span class="en">${check(on('rec_cannot_treat'))} Can not be treated at this Facility:</span>
      <span class="ar">من غير الممكن علاجه في المستشفى : ${check(on('rec_cannot_treat'))}</span>
    </div>
    <div class="item">
      <span class="en">${check(on('rec_disability'))} Permanent or partial disability:</span>
      <span class="ar">حالته تدل على عجزه الصحي عن العمل بصورة جزئية أو قطعية : ${check(on('rec_disability'))}</span>
    </div>
    <div class="item">
      <span class="en">${check(on('rec_others'))} Others</span>
      <span class="mid">${f('others_text')}</span>
      <span class="ar">اخرى ${check(on('rec_others'))}</span>
    </div>
  </div></div>

  <!-- الأطباء -->
  <div class="box"><div class="sec">
    <div class="pline"><span class="en">Treating Physician Name: ${esc((data.physician_name_en || '').toUpperCase())}</span><span class="ar">${esc(data.physician_name_ar)} :إسم الطبيب المعالج</span></div>
    <div class="pline"><span class="en">Signature: <span class="dash"></span> Badge No: ${f('badge_no')}</span><span class="ar"><span class="dash"></span> : التوقيع</span></div>
    <div class="pline">
      <span class="en">Physician Name: ${esc((data.physician_name_en || '').toUpperCase())}</span>
      <span class="ar">${ctx.raw('signature_image') ? `<img class="sig-img" src="${esc(ctx.raw('signature_image'))}" alt="">` : ''} &nbsp; ${esc(data.physician_name_ar)} : إسم الطبيب</span>
    </div>
    <div class="pline"><span class="en">Signature: <span class="dash"></span></span><span class="ar"><span class="dash"></span> : التوقيع</span></div>
    <div class="pline"><span class="en">Approval of the Director: <span class="dash" style="min-width:250px"></span></span><span class="ar">${f('director_title', 'تصديق مدير المجمع الطبي العام')}</span></div>
    <div class="pline"><span class="en">Name:</span><span class="ar">: الاسم</span></div>
    <div class="pline"><span class="en">Signature: <span class="dash"></span> Date:<span class="dash"></span></span><span class="ar"><span class="dash"></span> :التاريخ &nbsp;&nbsp; <span class="dash"></span> :التوقيع</span></div>
  </div></div>

  <!-- التذييل الإداري -->
  <div class="box"><div class="foot ar">
    ${ctx.raw('stamp_image') ? `<img class="stamp" src="${esc(ctx.raw('stamp_image'))}" alt="">` : ''}
    <div class="ln"><span>سعادة : ${f('addressee')}</span><span>المحترم</span></div>
    <div class="ln"><span>إشارة إلى إحالتكم رقم : ${f('referral_no')}</span><span>وتاريخ ${f('referral_date')}</span></div>
    <div>بشأن طلب الكشف على الموضح اسمه أعلاه</div>
    <div>إشارة إلى مراجعة الموظف لديكم الموضح اسمه أعلاه للكشف عليه :</div>
    <div>تجدون بعالية التقرير الصادر بشأنه</div>
    <div>${f('director_line', 'مدير المجمع الطبي العام')} :..............................</div>
    <div>الاسم :</div>
    <div>التوقيع :..............................</div>
  </div></div>

</div>`;
}

module.exports = { css, body };

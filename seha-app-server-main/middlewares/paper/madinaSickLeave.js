// ───────────────────────────────────────────────────────────────────────────
// «تقرير إجازة مرضية» — Sick Leave Report — مستشفى المدينة الوطني
// مستنسخ عن النموذج الورقي المرفق: ترويسة بثلاثة شعارات، فقرة تمهيدية
// ثنائية اللغة، ثم عمودان يفصلهما خط رأسي، وأقسام معنونة بخطوط أفقية.
// ───────────────────────────────────────────────────────────────────────────

const css = `
.sheet { width: 210mm; height: 297mm; padding: 10mm 12mm; direction: ltr; overflow: hidden; }

/* ── الترويسة: شعار المركز الوطني يسار، العنوان وسط، شعار المستشفى يمين ── */
.hdr { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.hdr .side { width: 150px; flex-shrink: 0; text-align: center; }
.hdr .side img { max-width: 100%; max-height: 62px; object-fit: contain; }
.hdr .mid { flex: 1; text-align: center; line-height: 1.35; }
.hdr .t-ar { font-size: 16px; font-weight: 700; }
.hdr .t-en { font-size: 15px; font-weight: 700; }
.hdr .t-no { font-size: 15px; font-weight: 700; }

/* ── الفقرة التمهيدية ─────────────────────────────────────────────────── */
.intro { display: flex; gap: 20px; margin-bottom: 16px; font-size: 12.4px; line-height: 1.75; }
.intro .en { flex: 1; text-align: left; font-weight: 600; }
.intro .ar { flex: 1; text-align: right; font-weight: 700; }

/* ── جسم ثنائي العمود بخط فاصل رأسي ───────────────────────────────────── */
.grid { border-top: 1.4px solid #000; }
.srow { display: flex; align-items: stretch; }
.srow > .en, .srow > .ar { flex: 1; padding: 5px 14px; font-size: 12.2px; line-height: 1.5; }
.srow > .en { text-align: left; border-right: 1.4px solid #000; }
.srow > .ar { text-align: right; font-weight: 600; }
/* عنوان قسم: عريض ووسط مع خط أفقي أسفله */
.srow.head > .en, .srow.head > .ar { font-size: 13.2px; font-weight: 700; text-align: center; }
.srow.head { border-bottom: 1.4px solid #000; }
.srow.rule { border-top: 1.4px solid #000; }
.indent { padding-left: 26px !important; }
.indent-ar { padding-right: 26px !important; }

/* ── التذييل: شعار صحة ─────────────────────────────────────────────────── */
.foot { margin-top: 22px; text-align: center; }
.foot img { max-height: 60px; object-fit: contain; }
.foot .cap { font-size: 13px; font-weight: 700; color: #1f8a80; margin-top: 2px; }
`;

function body(ctx) {
  const { f, esc, data, raw, facilityLogo } = ctx;
  const days = ctx.leave_days || '';
  const img = (v, cls) => (v ? `<img class="${cls}" src="${esc(v)}" alt="">` : '');

  // صفّ ثنائي اللغة عادي
  const row = (en, ar, cls = '') =>
    `<div class="srow ${cls}"><div class="en">${en}</div><div class="ar">${ar}</div></div>`;

  return `
<div class="sheet">

  <header class="hdr">
    <div class="side">${img(raw('nhic_logo'), '')}</div>
    <div class="mid">
      <div class="t-ar ar">تقرير إجازة مرضية</div>
      <div class="t-en en">Sick Leave</div>
      <div class="t-en en">Report</div>
      <div class="t-no en">${f('report_no', esc(data.leave_id))}</div>
      <div class="t-no en">(tel:${f('report_tel')})</div>
    </div>
    <div class="side">${img(facilityLogo, '')}</div>
  </header>

  <div class="intro">
    <div class="en">
      Benefits ${f('facility_en', esc(data.hospital_name_en))}<br>
      That the patient, ${esc(data.name_en)}, is the owner of<br>
      ID ${esc(data.national_id)}${f('patient_tel') ? ` (tel:${f('patient_tel')})` : ''}<br>
      He was granted sick leave for ${days} days from ${f('leave_from_ar')} to ${f('leave_to_ar')} as follows:
    </div>
    <div class="ar">
      يفيد ${f('facility_ar', esc(data.hospital_name_ar))}<br>
      بان المريض ${esc(data.name_ar)} صاحب<br>
      الهوية ${esc(data.national_id)}${f('patient_tel') ? ` (tel:${f('patient_tel')})` : ''}<br>
      قد منح إجازة مرضية لـ ${days} من الايام من تاريخ ${f('leave_from_ar')} إلى تاريخ ${f('leave_to_ar')} حسب التالي :
    </div>
  </div>

  <div class="grid">
    ${row(`<span style="font-weight:700">Patient's Information</span>`, `<span style="font-weight:700">بيانات المريض</span>`, 'head')}
    ${row(`<span class="indent">Medical record number: ${f('medical_record_no')}</span>`, `<span class="indent-ar">رقم السجل الطبي : ${f('medical_record_no')}</span>`)}
    ${row(`<span class="indent">National ID/residence number: ${esc(data.national_id)}${f('patient_tel') ? `<br><span class="indent">(tel:${f('patient_tel')})</span>` : ''}</span>`,
          `<span class="indent-ar">رقم الهوية الوطنية / الإقامة : ${esc(data.national_id)}${f('patient_tel') ? `<br>(tel:${f('patient_tel')})` : ''}</span>`)}
    ${row(`<span class="indent">Full name: ${esc(data.name_en)}</span>`, `<span class="indent-ar">الاسم الكامل : ${esc(data.name_ar)}</span>`)}
    ${row(`<span class="indent">Vacation date: ${f('vacation_date')}</span>`, `<span class="indent-ar">تاريخ الاجازة : ${f('vacation_date')}</span>`)}
    ${row(`<span class="indent">Gender: ${f('gender_en')}</span>`, `<span class="indent-ar">الجنس : ${f('gender_ar')}</span>`)}
    ${row(`<span class="indent">Date of birth: ${f('date_of_birth')}</span>`, `<span class="indent-ar">تاريخ الميلاد : ${f('date_of_birth')}</span>`)}
    ${row(`<span class="indent">${esc(ctx.country?.country_name_en || '')} nationality</span>`, `<span class="indent-ar">الجنسية : ${esc(ctx.country?.country_name_ar || data.nationality || '')}</span>`)}
    ${row(`<span class="indent">Employer : ${esc(data.employer_en)}</span>`, `<span class="indent-ar">جهة العمل : ${esc(data.employer_ar)}</span>`)}
    ${row(`<span class="indent">Profession: ${f('profession_en')}</span>`, `<span class="indent-ar">المهنة : ${f('profession_ar')}</span>`)}
    ${row(`<span class="indent">Date of entry: ${f('entry_date', esc(data.admission_date_en))}</span>`, `<span class="indent-ar">تاريخ الدخول : ${f('entry_date', esc(data.admission_date_en))}</span>`)}
    ${row(`<span class="indent">Exit date: ${f('exit_date', esc(data.discharge_date_en))}</span>`, `<span class="indent-ar">تاريخ الخروج : ${f('exit_date', esc(data.discharge_date_en))}</span>`)}
    ${row(`<span class="indent">Diagnosis: ${f('diagnosis_en')}</span>`, `<span class="indent-ar">التشخيص : ${f('diagnosis_ar')}</span>`)}

    ${row(`<span style="font-weight:700">Recommendation</span>`, `<span style="font-weight:700">التوصيات</span>`, 'head rule')}
    ${row(`<span class="indent">He was given sick leave for ${days} days</span>`, `<span class="indent-ar">تم منحه إجازة مرضية لمدة ${days} أيام</span>`)}
    ${row(`<span class="indent">From the date: ${f('leave_from_ar')}</span>`, `<span class="indent-ar">من تاريخ : ${f('leave_from_ar')}</span>`)}
    ${row(`<span class="indent">Until the date: ${f('leave_to_ar')}</span>`, `<span class="indent-ar">حتى تاريخ : ${f('leave_to_ar')}</span>`)}
    ${raw('rec_follow_up') ? row(`<span class="indent">See the treating physician before the end of his leave</span>`, `<span class="indent-ar">مراجعة الطبيب المعالج قبل انتهاء إجازته</span>`) : ''}

    ${row(`<span style="font-weight:700">Attending Physician Information</span>`, `<span style="font-weight:700">بيانات الطبيب المعالج</span>`, 'head rule')}
    ${row(`<span class="indent">Name: ${esc(data.physician_name_en)}</span>`, `<span class="indent-ar">الاسم : ${esc(data.physician_name_ar)}</span>`)}
    ${row(`<span class="indent">Position: ${esc(data.position_en)}</span>`, `<span class="indent-ar">المسمى الوظيفي : ${esc(data.position_ar)}</span>`)}

    ${row(`<span style="font-weight:700">Alternate Physician Information.</span>`, `<span style="font-weight:700">بيانات الطبيب المناوب</span>`, 'head rule')}
    ${row(`<span class="indent">the name : ${f('alt_physician_en')}</span>`, `<span class="indent-ar">الاسم : ${f('alt_physician_ar')}</span>`)}
    ${row(`<span class="indent">Position : ${f('alt_position_en')}</span>`, `<span class="indent-ar">المسمى الوظيفي : ${f('alt_position_ar')}</span>`)}
  </div>

  <div class="foot">
    ${img(raw('platform_logo'), '')}
    <div class="cap ar">${f('platform_caption', 'منصة الخدمات الصحية')}</div>
  </div>

</div>`;
}

module.exports = { css, body };

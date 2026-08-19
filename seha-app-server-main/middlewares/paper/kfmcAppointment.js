// ───────────────────────────────────────────────────────────────────────────
// «إشعار موعد» — Appointment Notice — مدينة الملك فهد الطبية، الرياض
// مستنسخ عن النموذج الورقي المرفق: ترويسة بثلاثة عناصر، عنوان تحته خط،
// صندوق بحواف دائرية يحوي صفوفاً ثنائية اللغة، ثم كتلة أختام وتواقيع،
// ثم «تعليمات هامة» مرقّمة والعنوان في الأسفل.
//
// هذا المستند ليس إجازة مرضية — لا يحمل مدة ولا تواريخ دخول/خروج.
// ───────────────────────────────────────────────────────────────────────────

const css = `
.sheet { width: 210mm; height: 297mm; padding: 12mm 14mm 8mm; direction: ltr; overflow: hidden; position: relative; }

/* ── الترويسة ─────────────────────────────────────────────────────────── */
.hdr { display: flex; align-items: flex-start; gap: 10px; }
.hdr .side { width: 155px; flex-shrink: 0; text-align: center; }
.hdr .side img { max-width: 100%; max-height: 74px; object-fit: contain; }
.hdr .mid { flex: 1; text-align: center; }
.hdr .mid img { max-height: 92px; object-fit: contain; }
.hdr .ar-block { width: 230px; flex-shrink: 0; text-align: right; font-size: 13px; font-weight: 700; line-height: 1.65; padding-top: 4px; }

/* ── العنوان ──────────────────────────────────────────────────────────── */
.title { text-align: center; margin: 26px 0 22px; }
.title span { font-size: 20px; font-weight: 700; border-bottom: 1.6px solid #000; padding-bottom: 2px; }

/* ── الصندوق الرئيسي بحواف دائرية ─────────────────────────────────────── */
.card { border: 1.2px solid #000; border-radius: 14px; padding: 20px 22px; }
.arow { display: flex; align-items: baseline; gap: 14px; padding: 4.2px 0; font-size: 12.6px; }
.arow .en { flex: 1; text-align: left; }
.arow .ar { flex: 1; text-align: right; font-weight: 700; }
.arow .en b, .arow .ar b { font-weight: 700; }

/* ── كتلة الأختام والتواقيع ───────────────────────────────────────────── */
.signs { display: flex; align-items: flex-start; justify-content: space-between; margin-top: 34px; }
.signs .dept { text-align: center; font-size: 17px; font-weight: 700; }
.signs .dept img { display: block; margin: 10px auto 0; max-width: 165px; max-height: 150px; object-fit: contain; }
.signs .doc { text-align: center; font-size: 13.5px; font-weight: 700; line-height: 1.7; }
.signs .doc .box { border: 1.2px solid #1a3fa0; color: #1a3fa0; padding: 3px 10px; font-size: 11.5px; display: inline-block; margin-bottom: 8px; text-align: left; }
.signs .doc img { display: block; margin: 4px auto 0; max-width: 175px; max-height: 95px; object-fit: contain; }

/* ── تعليمات هامة + العنوان ───────────────────────────────────────────── */
.notes { position: absolute; left: 14mm; right: 14mm; bottom: 8mm; direction: rtl; }
.notes h4 { margin: 0 0 4px; font-size: 14px; font-weight: 700; text-align: right; }
.notes p { margin: 0 0 2px; font-size: 10.4px; line-height: 1.55; text-align: right; }
.notes .addr { display: flex; justify-content: flex-end; margin-top: 10px; font-size: 11px; font-weight: 700; direction: ltr; }
.notes .addr .line { border-top: 1px solid #000; padding-top: 3px; min-width: 250px; text-align: center; }
`;

function body(ctx) {
  const { f, fml, esc, data, raw, facilityLogo } = ctx;
  const img = (v, extra = '') => (v ? `<img src="${esc(v)}" alt="" ${extra}>` : '');

  const row = (en, ar) => `<div class="arow"><span class="en en">${en}</span><span class="ar ar">${ar}</span></div>`;

  return `
<div class="sheet">

  <header class="hdr">
    <div class="side">${img(raw('vision_logo'))}</div>
    <div class="mid">${img(facilityLogo)}</div>
    <div class="ar-block ar">
      <div>${f('country_line', 'المملكة العربية السعودية')}</div>
      <div>${f('facility_ar', esc(data.hospital_name_ar))}</div>
      <div class="en" style="direction:ltr;text-align:right">${f('facility_en', esc(data.hospital_name_en))}</div>
    </div>
  </header>

  <div class="title"><span class="ar">${f('doc_title', 'إشعار موعد')}</span></div>

  <div class="card">
    ${row(`Patient Name: ${esc(data.name_en)}`, `اسم المريض: ${esc(data.name_ar)}`)}
    ${row(`National ID: ${esc(data.national_id)}`, `رقم الهوية: ${esc(data.national_id)}`)}
    ${row(`Date of Birth: ${f('date_of_birth')}`, `تاريخ الميلاد: ${f('date_of_birth')}`)}
    ${row(`Occupation: ${f('occupation_en')}`, `المهنة: ${f('occupation_ar')}`)}
    ${row(`Employer: ${esc(data.employer_en)}`, `جهة العمل: ${esc(data.employer_ar)}`)}
    ${row(`Medical Record Number: ${f('medical_record_no')}`, `الرقم الصحي: ${f('medical_record_no')}`)}
    ${row(`Referred by: ${f('referred_by_en')}`, `محول من: ${f('referred_by_ar')}`)}
    ${row(`Appointment Type: ${f('appt_type_en')}`, `نوع الموعد: ${f('appt_type_ar')}`)}
    ${row(`Specialty: ${f('specialty_en')}`, `الاختصاص: ${f('specialty_ar')}`)}
    ${row(`Appointment Location: ${f('appt_location_en')}`, `مكان الموعد: ${f('appt_location_ar')}`)}
    ${row(`Building: ${f('building_en')}`, `المبنى: ${f('building_ar')}`)}
    ${row(`Hospital: ${f('facility_en', esc(data.hospital_name_en))}`, `المستشفى: ${f('facility_ar', esc(data.hospital_name_ar))}`)}
    ${row(`Appointment Date: ${f('appt_date_en')}`, `تاريخ الموعد: ${f('appt_date_ar')}`)}
    ${row(`Appointment Time: ${f('appt_time_en')}`, `وقت الموعد: ${f('appt_time_ar')}`)}
    ${row(`Corresponding to: ${f('appt_gregorian')}`, `الموافق: ${f('appt_gregorian')}`)}
    <div style="height:16px"></div>
    ${row(`Appointments Phone: ${f('appt_phone')}`, `هاتف المواعيد: ${f('appt_phone')}`)}
  </div>

  <div class="signs">
    <div class="dept ar">
      ${f('dept_name', 'إدارة شئون المرضى')}
      ${img(raw('stamp_image'))}
    </div>
    <div class="doc">
      ${f('clinic_box') ? `<div class="box en">${fml('clinic_box')}</div>` : ''}
      <div class="ar">${f('doctor_name_ar', esc(data.physician_name_ar))}</div>
      <div class="en">${f('doctor_name_en', esc(data.physician_name_en))}</div>
      ${img(raw('signature_image'))}
    </div>
  </div>

  <div class="notes ar">
    <h4>${f('notes_title', 'تعليمات هامة')}</h4>
    <p>${f('notes_intro', 'عزيزي المريض:')}</p>
    <p>${f('note_1', '1- في حال عدم تمكنك من الحضور للموعد المحدد ولإتاحة الفرصة لمريض آخر هو في أمس الحاجة لهذا الموعد الرجاء الإتصال قبل الموعد المحدد ( يومين على الأقل )من خلال الأرقام الموضحة بورقة الموعد.')}</p>
    <p>${f('note_2', '2- في حال تغيير أرقام الإتصال يمكنك تحديث كافة بياناتك من خلال مكتب التسجيل في زيارتك القادمة. مع تمنياتنا لك بدوام الصحة والعافية...')}</p>
    <div class="addr">
      <span class="line ar">${fml('address_line', '')}</span>
    </div>
  </div>

</div>`;
}

module.exports = { css, body };

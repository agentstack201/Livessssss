// ───────────────────────────────────────────────────────────────────────────
// «تقرير إجازة مرضية» — Sick Leave Report — مستشفى حقل العام
// مستنسخ عن النموذج الورقي المرفق: شريط زخرفي أخضر أعلى الصفحة، ترويسة
// ثلاثية، عنوان مؤطَّر بظل، صندوق بيانات بحواف دائرية، صفوف تواريخ رمادية،
// قسم توصيات بخانات ونقاط فرعية، وثلاث كتل توقيع أسفل الصفحة.
// ───────────────────────────────────────────────────────────────────────────

const css = `
.sheet { width: 210mm; height: 297mm; padding: 0 10mm 6mm; direction: ltr; overflow: hidden; position: relative; }

/* الشريط الزخرفي الأخضر أعلى اليمين */
.wave { position: absolute; top: 0; right: 0; width: 62%; height: 30mm; overflow: hidden; z-index: 0; }
.wave img { width: 100%; height: 100%; object-fit: cover; object-position: top right; }
.layer { position: relative; z-index: 1; padding-top: 6mm; }

/* ── الترويسة ─────────────────────────────────────────────────────────── */
.moh { text-align: center; }
.moh img { max-height: 62px; object-fit: contain; }
.hdr { display: flex; align-items: flex-start; gap: 8px; margin-top: 2px; }
.hdr .en { flex: 1; direction: ltr; text-align: left; font-size: 11.6px; font-weight: 700; line-height: 1.62; }
.hdr .ar { flex: 1; text-align: right; font-size: 12.4px; font-weight: 700; line-height: 1.62; }

/* عنوان مؤطَّر بظل كما في الأصل */
.title { display: flex; justify-content: center; margin: 10px 0 12px; }
.title > span { display: inline-block; border: 1.4px solid #000; box-shadow: 3px 3px 0 #000;
              padding: 4px 24px; font-size: 14px; font-weight: 700; line-height: 1.4; text-align: center; }

/* ── صندوق البيانات ───────────────────────────────────────────────────── */
.card { border: 1.3px solid #000; border-radius: 12px; overflow: hidden; }
.crow { display: flex; align-items: baseline; gap: 18px; padding: 3.4px 12px; font-size: 12.4px; font-weight: 700; }
.crow .en { flex: 1; direction: ltr; text-align: left; }
.crow .ar { flex: 1; text-align: right; }
.pad { padding: 6px 0 4px; }

/* صفوف التواريخ الرمادية */
.drow { display: flex; align-items: stretch; border-top: 1.2px solid #000; background: #d9d9d9; font-size: 12.4px; font-weight: 700; }
.drow > div { padding: 4px 10px; display: flex; align-items: center; }
.drow .k-en { width: 26%; direction: ltr; }
.drow .v-en { width: 22%; direction: ltr; justify-content: center; }
.drow .tag { width: 16%; justify-content: center; background: #c9c9c9; }
.drow .v-ar { flex: 1; justify-content: center; }
.drow .k-ar { width: 20%; justify-content: flex-end; }

/* ── التوصيات ─────────────────────────────────────────────────────────── */
.reco { border-top: 1.2px solid #000; padding: 6px 12px 10px; }
.reco-h { display: flex; font-size: 12.6px; font-weight: 700; padding-bottom: 3px; }
.reco-h .en { flex: 1; direction: ltr; text-align: left; }
.reco-h .ar { flex: 1; text-align: right; }
.ritem { display: flex; align-items: baseline; gap: 8px; padding: 2.6px 0; font-size: 12.3px; font-weight: 700; }
.ritem .en { flex: 1; direction: ltr; text-align: left; display: flex; gap: 7px; align-items: baseline; }
.ritem .ar { flex: 1; text-align: right; display: flex; gap: 7px; align-items: baseline; justify-content: flex-end; }
.rsub { padding-right: 26px; padding-left: 26px; }
.dot { display: inline-block; width: 7px; height: 7px; border: 1.2px solid #000; border-radius: 50%; vertical-align: 1px; }

/* ── كتل التواقيع ─────────────────────────────────────────────────────── */
.signs { display: flex; align-items: flex-start; gap: 6px; border-top: 1.2px solid #000; padding-top: 6px; margin-top: 4px; direction: rtl; }
.signs > div { flex: 1; text-align: center; font-size: 12.2px; font-weight: 700; line-height: 1.8; }
.signs img { display: block; margin: 4px auto 0; max-width: 96%; max-height: 105px; object-fit: contain; }
.lic { border: 1.1px solid #1a3fa0; color: #1a3fa0; font-size: 10px; padding: 3px 6px; display: inline-block; text-align: left; direction: ltr; }
`;

const HDR_EN = ['KINGDOM OF SAUDI ARABIA', 'MINISTRY OF HEALTH', 'HAQL GENERAL HOSPITAL', 'MEDICAL SERVICES CENTER', 'MEDICAL RECORDS DEPARTMENT - MEDICAL REPORTS'];
const HDR_AR = ['المملكة العربية السعودية', 'وزارة الصــــحة', 'مستشفى حقل العام', 'مركز الخدمات الطبية', 'إدارة السجلات الطبية – التقارير الطبية'];

function lines(ctx, key, fallback, cls) {
  const raw = ctx.raw(key);
  const arr = typeof raw === 'string' && raw.trim() ? raw.split('\n') : fallback;
  return arr.map((l) => `<div class="${cls}">${ctx.esc(l)}</div>`).join('');
}

function body(ctx) {
  const { f, fml, esc, data, raw, check, facilityLogo } = ctx;
  const on = (k) => raw(k) === true || raw(k) === 'true';
  const img = (v) => (v ? `<img src="${esc(v)}" alt="">` : '');
  const crow = (en, ar) => `<div class="crow"><span class="en en">${en}</span><span class="ar ar">${ar}</span></div>`;

  return `
<div class="sheet">
  ${raw('wave_image') ? `<div class="wave">${img(raw('wave_image'))}</div>` : ''}
  <div class="layer">

    <div class="moh">${img(facilityLogo)}</div>
    <header class="hdr">
      <div class="en">${lines(ctx, 'header_en', HDR_EN, 'en')}</div>
      <div class="ar">${lines(ctx, 'header_ar', HDR_AR, 'ar')}</div>
    </header>

    <div class="title">
      <span><span class="ar">${f('title_ar', 'تقرير إجازة مرضية')}</span><br><span class="en">${f('title_en', 'Sick Leave Report')}</span></span>
    </div>

    <div class="card">
      <div class="pad">
        ${crow(`patient name : ${esc(data.name_en)}`, `اسم المريض : ${esc(data.name_ar)}`)}
        ${crow(`medical record no : ${f('medical_record_no')}`, `رقم السجل الطبي : ${f('medical_record_no')}`)}
        ${crow(`id no : ${esc(data.national_id)}`, `رقم الهوية : ${esc(data.national_id)}`)}
        ${crow(`${check(raw('sex') === 'M')} male &nbsp;&nbsp; ${check(raw('sex') === 'F')} female`,
               `${check(raw('sex') === 'F')} انثى &nbsp;&nbsp; ${check(raw('sex') === 'M')} ذكر`)}
        ${crow(`nationality : ${esc(ctx.country?.country_name_en || '')}`, `الجنسية : ${esc(ctx.country?.country_name_ar || data.nationality || '')}`)}
        ${crow(`date of birth : ${f('date_of_birth')}`, `تاريخ الميلاد : ${f('date_of_birth')}`)}
        ${crow(`occupation : ${f('occupation_en')}`, `المهنة : ${f('occupation_ar')}`)}
        ${crow(`place of work : ${esc(data.employer_en)}`, `جهة العمل : ${esc(data.employer_ar)}`)}
      </div>

      <div class="drow">
        <div class="k-en en">Date of Adm:</div>
        <div class="v-en en">${esc(data.admission_date_en)}</div>
        <div class="tag"></div>
        <div class="v-ar ar">${f('adm_date_ar', esc(data.admission_date_ar))}</div>
        <div class="k-ar ar">تاريخ الدخول :</div>
      </div>
      <div class="drow">
        <div class="k-en en">Date of Discharge:</div>
        <div class="v-en en">${esc(data.discharge_date_en)}</div>
        <div class="tag"><span class="en">${f('visit_tag_en')}</span>&nbsp;<span class="ar">${f('visit_tag_ar')}</span></div>
        <div class="v-ar ar">${f('dis_date_ar', esc(data.discharge_date_ar))}</div>
        <div class="k-ar ar">تاريخ الخروج :</div>
      </div>
      <div class="drow">
        <div class="k-en en">Date of Visit:</div>
        <div class="v-en en">${f('visit_time')}</div>
        <div class="tag"></div>
        <div class="v-ar ar">${f('visit_date_ar')}</div>
        <div class="k-ar ar">تاريخ المراجعة :</div>
      </div>

      <div class="reco">
        <div class="reco-h"><span class="en">Recommendation:</span><span class="ar">التقرير الطبي والتوصيات:</span></div>

        <div class="ritem">
          <span class="en">${check(on('rec_sick_leave'))} Sick Leave for ${f('leave_days_en')} day (s)</span>
          <span class="ar">منحه إجازة مرضية لمدة :${f('leave_days_ar')} ${check(on('rec_sick_leave'))}</span>
        </div>
        <div class="ritem rsub">
          <span class="en">Starting from ${f('leave_from_en', '…………')} to ${f('leave_to_en', '………')}</span>
          <span class="ar">إعتباراً من ${f('leave_from_ar')} الى ${f('leave_to_ar')}</span>
        </div>
        <div class="ritem">
          <span class="en">${check(on('rec_follow_up'))} Follow up before end of sick leave</span>
          <span class="ar">مراجعة الطبيب المعالج قبل إنتهاء إجازته ${check(on('rec_follow_up'))}</span>
        </div>
        <div class="ritem">
          <span class="en">${check(on('rec_referral'))} Referral to Medical Committee for following reasons</span>
          <span class="ar">إحالته للهيئة الطبية العامة لأحد الاسباب التالية : ${check(on('rec_referral'))}</span>
        </div>
        <div class="ritem rsub">
          <span class="en"><span class="dot"></span> Approval of Medical Report</span>
          <span class="ar">إعتماد التقرير الطبي <span class="dot"></span></span>
        </div>
        <div class="ritem rsub">
          <span class="en"><span class="dot"></span> Cannot be treated at this facility</span>
          <span class="ar">من غير الممكن علاجه في المستشفي <span class="dot"></span></span>
        </div>
        <div class="ritem rsub">
          <span class="en"><span class="dot"></span> Permanent or partial disability</span>
          <span class="ar">حالته تدل على العجز الصحي بصورة جزئية او قطعية <span class="dot"></span></span>
        </div>
        <div class="ritem">
          <span class="en">${check(on('rec_others'))} Others:</span>
          <span class="ar">${f('diagnosis_label', 'التشخيص')}: ${f('diagnosis_ar')} ${check(on('rec_others'))}</span>
        </div>
      </div>
    </div>

    <div class="signs">
      <div class="ar">
        ${f('sign1_title', 'الطبيب المعالج')}<br>${f('sign1_name', esc(data.physician_name_ar))}
        ${f('license_box') ? `<div class="lic">${fml('license_box')}</div>` : ''}
        ${img(raw('signature_image'))}
      </div>
      <div class="ar">
        ${f('sign2_title', 'تصديق مدير خدمات المرضى والتقارير الطبية.')}<br>${f('sign2_name')}
        ${img(raw('signature2_image'))}
      </div>
      <div class="ar">
        ${f('sign3_title', 'إدارة شؤون المرضى.')}<br>${f('sign3_lines', 'التوقيع :')}
        ${img(raw('stamp_image'))}
      </div>
    </div>

  </div>
</div>`;
}

module.exports = { css, body };

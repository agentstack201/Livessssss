// ───────────────────────────────────────────────────────────────────────────
// «تقرير طبي» — MEDECAL REPORT — مستشفى الملك فهد العام
// مستنسخ عن النموذج الورقي المرفق: ترويسة ثلاثية، مربّع «تقرير طبي»،
// جدول بيانات المريض بخانة شعار، ثم «إلى من يهمه الأمر» ونص التقرير
// والتوصيات، وكتلة الطبيب والختم، وحاشية إلكترونية مسطّرة، وعلامة مائية.
//
// «MEDECAL REPORT» مكتوبة هكذا في الأصل — أُبقيت مطابقةً له.
// ───────────────────────────────────────────────────────────────────────────

const css = `
.sheet { width: 210mm; height: 297mm; padding: 10mm 12mm 8mm; direction: rtl; overflow: hidden; position: relative; }

/* علامة مائية باهتة خلف المحتوى، كما في الأصل */
.wm { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      pointer-events: none; z-index: 0; opacity: .09; }
.wm img { max-width: 78%; max-height: 46%; object-fit: contain; }
.layer { position: relative; z-index: 1; }

/* ── الترويسة ─────────────────────────────────────────────────────────── */
.hdr { display: flex; align-items: flex-start; gap: 8px; direction: ltr; }
.hdr .en { flex: 1; direction: ltr; text-align: left; font-size: 12.6px; font-weight: 700; line-height: 1.95; }
.hdr .ar { flex: 1; text-align: right; font-size: 12.8px; font-weight: 700; line-height: 1.95; }
.hdr .mid { width: 150px; flex-shrink: 0; text-align: center; }
.hdr .mid img { max-width: 100%; max-height: 66px; object-fit: contain; }

.badge { display: flex; justify-content: center; margin-top: 2px; }
.badge span { border: 1.2px solid #000; padding: 2px 16px; font-size: 13px; font-weight: 700; }
.mr-title { text-align: center; font-size: 14px; font-weight: 700; letter-spacing: .6px; margin: 14px 0 12px; direction: ltr; }

/* ── جدول بيانات المريض ───────────────────────────────────────────────── */
table.info { width: 100%; border-collapse: collapse; margin: 0 auto 16px; }
table.info td { border: 1px solid #000; padding: 5px 9px; font-size: 12.4px; font-weight: 700; height: 26px; }
table.info td.lbl { width: 24%; text-align: right; }
table.info td.val { width: 34%; text-align: center; }
table.info td.side { width: 22%; text-align: center; }
table.info td.logo { width: 20%; text-align: center; vertical-align: middle; }
table.info td.logo img { max-width: 96%; max-height: 72px; object-fit: contain; }

/* ── نص التقرير ───────────────────────────────────────────────────────── */
.whom { text-align: center; font-size: 13.5px; font-weight: 700; margin: 16px 0 12px; }
.para { font-size: 13px; font-weight: 700; line-height: 2.1; text-align: justify; }
.reco-t { font-size: 13px; font-weight: 700; margin-top: 16px; }
.reco-v { font-size: 13px; font-weight: 700; margin-top: 8px; }
.closing { font-size: 13px; font-weight: 700; margin-top: 22px; }

/* ── الطبيب والختم ────────────────────────────────────────────────────── */
.sig { margin-top: 14px; }
.sig .who { font-size: 13px; font-weight: 700; text-align: center; }
.sig .imgs { display: flex; align-items: flex-end; justify-content: space-between; margin-top: 6px; }
.sig .imgs img { max-height: 130px; max-width: 230px; object-fit: contain; }
.sig .stamp-lbl { font-size: 12.6px; font-weight: 700; }

/* ── الحاشية ──────────────────────────────────────────────────────────── */
.efoot { position: absolute; left: 12mm; right: 12mm; bottom: 8mm; }
.efoot .note { text-align: center; font-size: 11px; font-weight: 700; text-decoration: underline; line-height: 1.7; }
.efoot .pg { direction: ltr; text-align: left; font-size: 11px; margin-top: 4px; }
`;

const HDR_EN = ['Kingdom of Saudi Arabi', 'General Directorate of Health Affairs', 'Ministry of Health', 'King Fahad General Hospital'];
const HDR_AR = ['المملكة العربية السعودية', 'المديرية العامة للشئون الصحية', 'وزارة الصحة', 'مستشفى الملك فهد العام'];

function lines(ctx, key, fallback, cls) {
  const raw = ctx.raw(key);
  const arr = typeof raw === 'string' && raw.trim() ? raw.split('\n') : fallback;
  return arr.map((l) => `<div class="${cls}">${ctx.esc(l)}</div>`).join('');
}

function body(ctx) {
  const { f, fml, esc, data, raw, asset, facilityLogo } = ctx;
  const img = (v, cls = '') => (v ? `<img class="${cls}" src="${esc(v)}" alt="">` : '');

  return `
<div class="sheet">
  ${asset('watermark_image') ? `<div class="wm">${img(asset('watermark_image'))}</div>` : ''}
  <div class="layer">

    <header class="hdr">
      <div class="en">${lines(ctx, 'header_en', HDR_EN, 'en')}</div>
      <div class="mid">${img(facilityLogo)}</div>
      <div class="ar">${lines(ctx, 'header_ar', HDR_AR, 'ar')}</div>
    </header>

    <div class="badge"><span class="ar">${f('badge_title', 'تقرير طبي')}</span></div>
    <div class="mr-title en">${f('title_en', 'MEDECAL REPORT')}</div>

    <table class="info">
      <tr>
        <td class="lbl ar">رقم الملف الطبي</td>
        <td class="val en">${f('medical_record_no')}</td>
        <td class="logo" rowspan="5">${img(asset('table_logo'))}</td>
      </tr>
      <tr>
        <td class="lbl ar">اسم المريض</td>
        <td class="val ar">${esc(data.name_ar)}</td>
      </tr>
      <tr>
        <td class="lbl ar">الجنسية</td>
        <td class="val ar">${esc(ctx.country?.country_name_ar || data.nationality || '')}</td>
      </tr>
      <tr>
        <td class="lbl ar">رقم الهوية الإقامة</td>
        <td class="val en">${esc(data.national_id)}</td>
      </tr>
      <tr>
        <td class="lbl ar">تاريخ الميلاد</td>
        <td class="val ar">${f('date_of_birth')}</td>
      </tr>
      <tr>
        <td class="lbl ar">الجنس</td>
        <td class="val ar">${f('gender_ar')}</td>
        <td class="side ar">تاريخ الدخول : ${esc(data.admission_date_en)}</td>
      </tr>
      <tr>
        <td class="lbl ar">${f('extra_label')}</td>
        <td class="val ar">${f('extra_value')}</td>
        <td class="side ar">تاريخ الخروج: ${esc(data.discharge_date_en)}</td>
      </tr>
    </table>

    <div class="whom ar">${f('whom_line', '( إلى من يهمه الأمر )')}</div>
    <div class="para ar">${fml('report_body')}</div>

    <div class="reco-t ar">${f('reco_title', 'التوصيات :')}</div>
    <div class="reco-v ar">${fml('reco_body')}</div>

    <div class="closing ar">${f('closing_line', 'وعليه حرر هذا التقرير بناء على طلبه ودون أدنى مسؤولية')}</div>

    <div class="sig">
      <div class="who ar">${f('signer_title', 'الطبيب الاستشاري')}</div>
      <div class="imgs">
        <span class="stamp-lbl ar">${f('stamp_label', 'الختم:')} ${img(asset('stamp_image'))}</span>
        <span>${img(asset('signature_image'))}</span>
      </div>
    </div>

  </div>

  <div class="efoot">
    <div class="note ar">${fml('efoot_note', 'هذا الوثيقة صادرة من قسم التقارير الطبية عن طريق الحاسب الآلي معتمدة بالتوقيع الإلكتروني ولا تحتاج إلى توقيع يدوي ويكتفي بالختم الرسمي المستشفى')}</div>
    <div class="pg en">${f('page_no', '١/١')}</div>
  </div>
</div>`;
}

module.exports = { css, body };

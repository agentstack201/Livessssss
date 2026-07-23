import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import styles from './PdfPreview.module.css';

const PdfPreview = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // Accept snake_case params (used everywhere else in the app) and fall back to
  // the legacy camelCase names.
  const serviceNum = searchParams.get('service_num') || searchParams.get('serviceNum');
  const nationalID = searchParams.get('national_id') || searchParams.get('nationalID');
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const API_SICK_LEAVES = import.meta.env.VITE_API_SICK_LEAVES || '/sick-leaves';
  const API_URL = `${API_BASE_URL}${API_SICK_LEAVES}`;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}?service_num=${serviceNum}&national_id=${nationalID}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      const result = await response.json();
      
      if (response.ok && result.length > 0) {
        setData(result[0]);
        setLoading(false);
      } else {
        setError('لم يتم العثور على البيانات');
        setLoading(false);
      }
    } catch (err) {
      setError('حدث خطأ أثناء جلب البيانات');
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className={styles.loading}>جاري التحميل...</div>;
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p>{error}</p>
        <button onClick={() => navigate(-1)}>رجوع</button>
      </div>
    );
  }

  // حساب عدد الأيام
  const calcDays = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    // Inclusive of both the admission and discharge day (+1), matching the
    // backend calcDays and the PDF renderer so the day count is consistent.
    const diff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    return diff + 1;
  };

  const leaveDays = calcDays(data.admission_date_en, data.discharge_date_en);

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button onClick={() => navigate(-1)} className={styles.backBtn}>
          رجوع
        </button>
        <button onClick={handlePrint} className={styles.printBtn}>
          طباعة
        </button>
      </div>

      <div className={styles.previewContainer}>
        <div className={styles.a4Page}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <img src="/images/seha.jpg" alt="Seha" />
            </div>
            <div className={styles.headerCenter}>
              <div className={styles.kingdomAr}>المملكة العربية السعودية</div>
              <div className={styles.kingdomEn}>Kingdom of Saudi Arabia</div>
            </div>
            <div className={styles.headerRight}>
              <img src="/images/3.PNG" alt="Design" />
            </div>
          </div>

          {/* Title */}
          <div className={styles.titleSection}>
            <div className={styles.titleAr}>تقرير إجازة مرضية</div>
            <div className={styles.titleEn}>Sick Leave Report</div>
          </div>

          {/* Table */}
          <table className={styles.table}>
            <tbody>
              <tr>
                <td className={styles.labelAr}>رقم الإجازة</td>
                <td className={styles.value} colSpan="2">{data.leave_id}</td>
                <td className={styles.labelEn}>Leave ID</td>
              </tr>

              {/* Leave Duration */}
              <tr className={styles.durationRow}>
                <td>مدة الإجازة</td>
                <td>
                  {leaveDays} يوم ({data.admission_date_ar} إلى {data.discharge_date_ar})
                </td>
                <td>
                  {leaveDays} day ( {data.admission_date_en} to {data.discharge_date_en} )
                </td>
                <td>Leave Duration</td>
              </tr>

              <tr>
                <td className={styles.labelAr}>تاريخ الدخول</td>
                <td className={styles.value}>{data.admission_date_ar}</td>
                <td className={styles.value}>{data.admission_date_en}</td>
                <td className={styles.labelEn}>Admission Date</td>
              </tr>
              <tr>
                <td className={styles.labelAr}>تاريخ الخروج</td>
                <td className={styles.value}>{data.discharge_date_ar}</td>
                <td className={styles.value}>{data.discharge_date_en}</td>
                <td className={styles.labelEn}>Discharge Date</td>
              </tr>
              <tr>
                <td className={styles.labelAr}>تاريخ إصدار التقرير</td>
                <td className={styles.value} colSpan="2">{data.issue_date}</td>
                <td className={styles.labelEn}>Issue Date</td>
              </tr>
              <tr>
                <td className={styles.labelAr}>الاسم</td>
                <td className={styles.value}>{data.name_ar}</td>
                <td className={styles.value}>{data.name_en}</td>
                <td className={styles.labelEn}>Name</td>
              </tr>
              <tr>
                <td className={styles.labelAr}>رقم الهوية / الإقامة</td>
                <td className={styles.value} colSpan="2">{data.national_id}</td>
                <td className={styles.labelEn}>National ID / Iqama</td>
              </tr>
              <tr>
                <td className={styles.labelAr}>الجنسية</td>
                <td className={styles.value}>{data.nationality || 'السعودية'}</td>
                <td className={styles.value}>Saudi Arabia</td>
                <td className={styles.labelEn}>Nationality</td>
              </tr>
              <tr>
                <td className={styles.labelAr}>جهة العمل</td>
                <td className={styles.value} colSpan="2">{data.employer_ar || data.employer_en}</td>
                <td className={styles.labelEn}>Employer</td>
              </tr>
              <tr>
                <td className={styles.labelAr}>اسم الطبيب المعالج</td>
                <td className={styles.value}>{data.physician_name_ar}</td>
                <td className={styles.value}>{data.physician_name_en}</td>
                <td className={styles.labelEn}>Physician Name</td>
              </tr>
              <tr>
                <td className={styles.labelAr}>المسمى الوظيفي</td>
                <td className={styles.value}>{data.position_ar}</td>
                <td className={styles.value}>{data.position_en}</td>
                <td className={styles.labelEn}>Position</td>
              </tr>
            </tbody>
          </table>

          {/* Footer */}
          <div className={styles.footer}>
            <div className={styles.qrSection}>
              <img src="/images/barcode.jpg" alt="QR" />
              <div className={styles.qrText}>للتحقق من بيانات التقرير يرجى زيارة موقع منصة صحة الرسمي</div>
              <div className={styles.qrText}>To check the report please visit Seha's official website</div>
              <div className={styles.qrLink}>www.seha.sa</div>
            </div>

            <div className={styles.timestamp}>
              <div>{new Date().toLocaleTimeString('ar-SA')}</div>
              <div>{new Date().toLocaleDateString('ar-SA')}</div>
            </div>

            <div className={styles.logoSection}>
              <img src="/images/1.png" alt="Ministry" />
              <div className={styles.hospitalName}>AL NOOR SPECIALIST HOSPITAL</div>
              <div className={styles.hospitalName}>مستشفى النور التخصصي</div>
              <img src="/images/national-center.jpg" alt="National" style={{marginTop: '15px'}} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfPreview;

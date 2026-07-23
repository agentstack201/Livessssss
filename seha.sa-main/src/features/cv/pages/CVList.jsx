import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CVPreview from '../components/CVPreview'
import styles from '../styles/CVList.module.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

function CVList() {
  const navigate = useNavigate()
  const [cvs, setCvs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCV, setSelectedCV] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const userPermissions = user.permissions || {}

  useEffect(() => {
    fetchCVs()
  }, [])

  const fetchCVs = async () => {
    setLoading(true)
    try {
      // بيانات تجريبية للعرض
      const dummyData = [
        {
          id: 1,
          full_name: 'أحمد محمد العتيبي',
          job_title: 'مطور برمجيات Full Stack',
          email: 'ahmed.otaibi@example.com',
          phone: '0501234567',
          address: 'الرياض، المملكة العربية السعودية',
          date_of_birth: '1995-05-15',
          nationality: 'سعودي',
          summary: 'مطور برمجيات متمرس مع خبرة 5 سنوات في تطوير تطبيقات الويب باستخدام React و Node.js. شغوف بإنشاء حلول تقنية مبتكرة وفعالة.',
          experience: [
            {
              company: 'شركة التقنية المتقدمة',
              position: 'مطور Full Stack',
              start_date: '2021-01-01',
              end_date: '',
              current: true,
              description: 'تطوير وصيانة تطبيقات ويب متقدمة باستخدام React و Node.js. قيادة فريق من 3 مطورين وتحسين أداء التطبيقات بنسبة 40%.'
            },
            {
              company: 'مؤسسة الحلول الرقمية',
              position: 'مطور Frontend',
              start_date: '2019-06-01',
              end_date: '2020-12-31',
              current: false,
              description: 'بناء واجهات مستخدم تفاعلية وتحسين تجربة المستخدم. العمل مع فريق متعدد التخصصات لتسليم مشاريع عالية الجودة.'
            }
          ],
          education: [
            {
              institution: 'جامعة الملك سعود',
              degree: 'بكالوريوس',
              field: 'علوم الحاسب',
              start_date: '2014-09-01',
              end_date: '2018-06-30',
              grade: '4.5 من 5'
            }
          ],
          skills: ['React', 'Node.js', 'JavaScript', 'TypeScript', 'MongoDB', 'PostgreSQL', 'Git', 'Docker', 'AWS'],
          createdAt: '2024-11-01T10:00:00Z'
        },
        {
          id: 2,
          full_name: 'فاطمة عبدالله القحطاني',
          job_title: 'مصممة UI/UX',
          email: 'fatima.qahtani@example.com',
          phone: '0559876543',
          address: 'جدة، المملكة العربية السعودية',
          date_of_birth: '1997-08-20',
          nationality: 'سعودية',
          summary: 'مصممة UI/UX مبدعة مع شغف بتصميم تجارب مستخدم استثنائية. خبرة 3 سنوات في تصميم تطبيقات الجوال والويب.',
          experience: [
            {
              company: 'استوديو التصميم الإبداعي',
              position: 'مصممة UI/UX رئيسية',
              start_date: '2022-03-01',
              end_date: '',
              current: true,
              description: 'قيادة مشاريع التصميم من البداية للنهاية. إنشاء أنظمة تصميم شاملة وتحسين معدلات التحويل بنسبة 35%.'
            }
          ],
          education: [
            {
              institution: 'جامعة الأميرة نورة',
              degree: 'بكالوريوس',
              field: 'التصميم الجرافيكي',
              start_date: '2016-09-01',
              end_date: '2020-06-30',
              grade: '4.8 من 5'
            }
          ],
          skills: ['Figma', 'Adobe XD', 'Sketch', 'Photoshop', 'Illustrator', 'Prototyping', 'User Research', 'Wireframing'],
          createdAt: '2024-11-05T14:30:00Z'
        },
        {
          id: 3,
          full_name: 'خالد سعد الدوسري',
          job_title: 'مدير مشاريع تقنية',
          email: 'khaled.dosari@example.com',
          phone: '0505551234',
          address: 'الدمام، المملكة العربية السعودية',
          date_of_birth: '1990-12-10',
          nationality: 'سعودي',
          summary: 'مدير مشاريع معتمد PMP مع خبرة 8 سنوات في قيادة مشاريع تقنية معقدة. سجل حافل في تسليم المشاريع في الوقت المحدد وضمن الميزانية.',
          experience: [
            {
              company: 'مجموعة الاتصالات السعودية',
              position: 'مدير مشاريع أول',
              start_date: '2020-01-01',
              end_date: '',
              current: true,
              description: 'إدارة محفظة مشاريع بقيمة 50 مليون ريال. قيادة فرق متعددة التخصصات وتحقيق نسبة نجاح 95% في تسليم المشاريع.'
            },
            {
              company: 'شركة الحلول التقنية',
              position: 'مدير مشاريع',
              start_date: '2016-06-01',
              end_date: '2019-12-31',
              current: false,
              description: 'إدارة مشاريع تطوير البرمجيات وتنسيق العمل بين الفرق المختلفة.'
            }
          ],
          education: [
            {
              institution: 'جامعة الملك فهد للبترول والمعادن',
              degree: 'ماجستير',
              field: 'إدارة المشاريع',
              start_date: '2013-09-01',
              end_date: '2015-06-30',
              grade: 'امتياز'
            },
            {
              institution: 'جامعة الملك فهد للبترول والمعادن',
              degree: 'بكالوريوس',
              field: 'هندسة الحاسب',
              start_date: '2009-09-01',
              end_date: '2013-06-30',
              grade: '4.2 من 5'
            }
          ],
          skills: ['PMP', 'Agile', 'Scrum', 'JIRA', 'MS Project', 'Risk Management', 'Stakeholder Management', 'Budget Planning'],
          createdAt: '2024-10-28T09:15:00Z'
        }
      ]

      // عرض البيانات التجريبية مباشرة
      console.log('📄 Using dummy CV data for preview')
      setCvs(dummyData)
      
      // يمكنك لاحقاً تفعيل API عند الحاجة
      // const token = localStorage.getItem('token')
      // const response = await fetch(`${API_BASE_URL}/cvs`, {
      //   headers: { 'Authorization': `Bearer ${token}` }
      // })
      // const data = await response.json()
      // if (response.ok && data.success) setCvs(data.data)
    } catch (err) {
      console.error('Error:', err)
      setError('حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه السيرة الذاتية؟')) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/cvs/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        window.showToast?.('تم حذف السيرة الذاتية بنجاح', 'success')
        fetchCVs()
      }
    } catch (err) {
      console.error('Error deleting CV:', err)
      window.showToast?.('فشل في حذف السيرة الذاتية', 'error')
    }
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>السير الذاتية</h1>
          <p className={styles.subtitle}>إدارة وإنشاء السير الذاتية</p>
          {cvs.length > 0 && cvs[0].id <= 3 && (
            <p style={{color: '#f59e0b', fontSize: '0.9rem', marginTop: '0.5rem'}}>
              📌 البيانات المعروضة حالياً هي بيانات تجريبية للعرض
            </p>
          )}
        </div>
        {userPermissions?.can_create_leaves && (
          <div style={{display: 'flex', gap: '1rem'}}>
            <Link to="/cv/ai-extract" className={styles.aiBtn}>
              🤖 استخراج بالذكاء الاصطناعي
            </Link>
            <Link to="/cv/create" className={styles.createBtn}>
              ➕ إنشاء يدوي
            </Link>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
            📄
          </div>
          <div className={styles.statInfo}>
            <h3 className={styles.statValue}>{cvs.length}</h3>
            <p className={styles.statLabel}>إجمالي السير الذاتية</p>
          </div>
        </div>
      </div>

      {/* CV List */}
      {loading ? (
        <div className={styles.loading}>جاري التحميل...</div>
      ) : cvs.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📄</div>
          <h3>لا توجد سير ذاتية</h3>
          <p>ابدأ بإنشاء أول سيرة ذاتية</p>
          {userPermissions?.can_create_leaves && (
            <Link to="/cv/create" className={styles.emptyBtn}>
              إنشاء سيرة ذاتية
            </Link>
          )}
        </div>
      ) : (
        <div className={styles.cvGrid}>
          {cvs.map(cv => (
            <div key={cv.id} className={styles.cvCard}>
              <div className={styles.cvHeader}>
                <h3 className={styles.cvName}>{cv.full_name}</h3>
                <span className={styles.cvDate}>
                  {new Date(cv.createdAt).toLocaleDateString('ar-SA')}
                </span>
              </div>
              
              <div className={styles.cvInfo}>
                <p><strong>المسمى الوظيفي:</strong> {cv.job_title}</p>
                <p><strong>البريد الإلكتروني:</strong> {cv.email}</p>
                <p><strong>الهاتف:</strong> {cv.phone}</p>
              </div>

              <div className={styles.cvActions}>
                <button
                  onClick={() => {
                    setSelectedCV(cv)
                    setShowPreview(true)
                  }}
                  className={styles.viewBtn}
                >
                  👁️ عرض
                </button>
                {userPermissions?.can_edit_leaves && (
                  <button
                    onClick={() => navigate(`/cv/edit/${cv.id}`)}
                    className={styles.editBtn}
                  >
                    ✏️ تعديل
                  </button>
                )}
                {userPermissions?.can_delete_leaves && (
                  <button
                    onClick={() => handleDelete(cv.id)}
                    className={styles.deleteBtn}
                  >
                    🗑️ حذف
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && selectedCV && (
        <CVPreview
          data={selectedCV}
          onClose={() => {
            setShowPreview(false)
            setSelectedCV(null)
          }}
        />
      )}
    </div>
  )
}

export default CVList

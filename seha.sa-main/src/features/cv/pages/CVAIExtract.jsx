import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from '../styles/CVAIExtract.module.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

function CVAIExtract() {
  const navigate = useNavigate()
  const [cvText, setCvText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleExtract = async () => {
    if (!cvText.trim()) {
      setError('يرجى إدخال نص السيرة الذاتية')
      return
    }

    setLoading(true)
    setError('')

    try {
      // مؤقتاً: استخدام endpoint الإجازات المرضية لاستخراج البيانات
      // Backend يحتاج إضافة endpoint خاص بالسير الذاتية لاحقاً
      const response = await fetch(`${API_BASE_URL}/sick-leaves/ai-extract/Nasr4k`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientInfo: cvText })
      })

      const data = await response.json()
      console.log('📊 AI Response:', data)

      if (response.ok && data.success) {
        console.log('✅ Extracted data:', data.data)
        
        // تحويل البيانات من صيغة الإجازة المرضية إلى صيغة السيرة الذاتية
        const extractedData = data.data
        
        const cvData = {
          full_name: extractedData.nameArabic || extractedData.name || '',
          job_title: '',
          email: '',
          phone: '',
          address: '',
          date_of_birth: '',
          nationality: extractedData.nationality || 'سعودي',
          summary: '',
          experience: extractedData.employer ? [{
            company: extractedData.employer,
            position: '',
            start_date: extractedData.startDate || extractedData.admissionDate || '',
            end_date: extractedData.endDate || extractedData.dischargeDate || '',
            current: false,
            description: ''
          }] : [],
          education: [],
          skills: [],
          languages: [],
          certifications: []
        }
        
        // محاولة استخراج معلومات إضافية من النص الأصلي
        const lines = cvText.split('\n').filter(line => line.trim())
        
        lines.forEach((line, index) => {
          const trimmedLine = line.trim()
          const lowerLine = trimmedLine.toLowerCase()
          
          // استخراج البريد الإلكتروني
          if (lowerLine.includes('email') || lowerLine.includes('بريد') || lowerLine.includes('@')) {
            const emailMatch = trimmedLine.match(/[\w.-]+@[\w.-]+\.\w+/)
            if (emailMatch) cvData.email = emailMatch[0]
          }
          
          // استخراج رقم الهاتف
          if (lowerLine.includes('phone') || lowerLine.includes('هاتف') || lowerLine.includes('جوال') || lowerLine.includes('موبايل')) {
            const phoneMatch = trimmedLine.match(/05\d{8}/)
            if (phoneMatch) cvData.phone = phoneMatch[0]
          }
          
          // استخراج المسمى الوظيفي (عادة في السطر الثاني)
          if (index === 1 && !cvData.job_title && trimmedLine.length > 3 && trimmedLine.length < 100) {
            cvData.job_title = trimmedLine
          }
          
          // استخراج الملخص المهني
          if (lowerLine.includes('ملخص') || lowerLine.includes('summary') || lowerLine.includes('نبذة')) {
            const nextLine = lines[index + 1]
            if (nextLine && nextLine.trim().length > 20) {
              cvData.summary = nextLine.trim()
            }
          }
          
          // استخراج المهارات
          if (lowerLine.includes('مهارات') || lowerLine.includes('skills')) {
            const skillsLine = lines[index + 1]
            if (skillsLine) {
              const skills = skillsLine.split(/[,،]/).map(s => s.trim()).filter(s => s.length > 0)
              if (skills.length > 0) {
                cvData.skills = skills
              }
            }
          }
        })
        
        console.log('✅ Converted CV data:', cvData)
        // Navigate to create page with extracted data
        navigate('/cv/create', { state: { extractedData: cvData } })
      } else {
        console.error('❌ API Error:', data)
        setError(data.error || data.message || 'فشل في استخراج البيانات')
      }
    } catch (err) {
      console.error('❌ Error extracting CV data:', err)
      setError('حدث خطأ أثناء معالجة البيانات بالذكاء الاصطناعي. يرجى المحاولة مرة أخرى.')
    } finally {
      setLoading(false)
    }
  }

  const handleManualEntry = () => {
    navigate('/cv/create')
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>استخراج بيانات السيرة الذاتية</h1>
        <p className={styles.subtitle}>استخدم الذكاء الاصطناعي لاستخراج البيانات تلقائياً</p>
      </div>

      <div className={styles.content}>
        {/* AI Extract Section */}
        <div className={styles.extractSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.iconWrapper}>
              <span className={styles.icon}>🤖</span>
            </div>
            <div>
              <h2 className={styles.sectionTitle}>استخراج بالذكاء الاصطناعي</h2>
              <p className={styles.sectionDesc}>الصق نص السيرة الذاتية وسيقوم الذكاء الاصطناعي باستخراج البيانات تلقائياً</p>
            </div>
          </div>

          <div className={styles.inputContainer}>
            <label className={styles.label}>
              <span className={styles.labelText}>نص السيرة الذاتية</span>
              <span className={styles.labelHint}>الصق النص الكامل للسيرة الذاتية هنا</span>
            </label>
            <textarea
              className={styles.textarea}
              value={cvText}
              onChange={(e) => {
                setCvText(e.target.value)
                setError('')
              }}
              placeholder="مثال:&#10;&#10;أحمد محمد العتيبي&#10;مطور برمجيات Full Stack&#10;البريد الإلكتروني: ahmed@example.com&#10;الهاتف: 0501234567&#10;&#10;الخبرات العملية:&#10;- مطور Full Stack في شركة التقنية (2021 - حتى الآن)&#10;- مطور Frontend في مؤسسة الحلول الرقمية (2019 - 2020)&#10;&#10;التعليم:&#10;- بكالوريوس علوم الحاسب - جامعة الملك سعود (2014 - 2018)&#10;&#10;المهارات:&#10;React, Node.js, JavaScript, TypeScript, MongoDB"
              rows={15}
            />
            {error && <p className={styles.error}>{error}</p>}
          </div>

          <div className={styles.actions}>
            <button 
              onClick={handleExtract} 
              className={styles.extractBtn}
              disabled={loading || !cvText.trim()}
            >
              {loading ? (
                <>
                  <span className={styles.spinner}></span>
                  جاري الاستخراج...
                </>
              ) : (
                <>
                  <span>🤖</span>
                  استخراج البيانات بالذكاء الاصطناعي
                </>
              )}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className={styles.divider}>
          <span className={styles.dividerText}>أو</span>
        </div>

        {/* Manual Entry Section */}
        <div className={styles.manualSection}>
          <div className={styles.manualContent}>
            <div className={styles.manualIcon}>✍️</div>
            <h3 className={styles.manualTitle}>إدخال البيانات يدوياً</h3>
            <p className={styles.manualDesc}>
              إذا كنت تفضل إدخال البيانات بنفسك، يمكنك استخدام النموذج التقليدي
            </p>
            <button onClick={handleManualEntry} className={styles.manualBtn}>
              إدخال يدوي
            </button>
          </div>
        </div>

        {/* Tips Section */}
        <div className={styles.tipsSection}>
          <h3 className={styles.tipsTitle}>💡 نصائح للحصول على أفضل النتائج:</h3>
          <ul className={styles.tipsList}>
            <li>تأكد من أن النص واضح ومنظم</li>
            <li>قم بتضمين جميع الأقسام: المعلومات الشخصية، الخبرات، التعليم، المهارات</li>
            <li>استخدم تنسيق بسيط بدون رموز أو أحرف خاصة معقدة</li>
            <li>تأكد من صحة البيانات قبل الإرسال</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default CVAIExtract

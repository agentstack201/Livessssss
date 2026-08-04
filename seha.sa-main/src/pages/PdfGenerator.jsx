import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './SickLeaveForm.module.css'
import SickLeavePDFOriginal from '../components/SickLeavePDFOriginal'
import CompanionVisitPDFOriginal from '../components/CompanionVisitPDFOriginal'

// API Configuration from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const API_SICK_LEAVES = import.meta.env.VITE_API_SICK_LEAVES || '/sick-leaves'
const API_URL = `${API_BASE_URL}${API_SICK_LEAVES}`

function PdfGenerator() {
  const [formData, setFormData] = useState({
    serviceNum: '',
    nationalID: ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [leaveData, setLeaveData] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    // Clear field error
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
    
    // Clear general error
    if (error) {
      setError('')
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.serviceNum || formData.serviceNum.trim() === '') {
      newErrors.serviceNum = 'رقم الخدمة مطلوب'
    }

    if (!formData.nationalID || formData.nationalID.trim() === '') {
      newErrors.nationalID = 'رقم الهوية مطلوب'
    } else if (formData.nationalID.length < 10) {
      newErrors.nationalID = 'رقم الهوية يجب أن يكون 10 أرقام على الأقل'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)
    setError('')

    try {
      // Fetch sick leave data by service number and national ID
        const token = localStorage.getItem('token')
        const response = await fetch(
          `${API_URL}?service_num=${formData.serviceNum}&national_id=${formData.nationalID}`, 
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          }
        )

      const data = await response.json()
      console.log('📊 Response:', data)

      if (!response.ok) {
        let errorMessage = '❌ لم يتم العثور على الإجازة المرضية'
        let errorDetails = 'يرجى التأكد من:\n• رقم الخدمة صحيح\n• رقم الهوية/الإقامة صحيح\n• تم إنشاء الإجازة مسبقاً في النظام'
        
        if (response.status === 404) {
          errorMessage = '❌ لم يتم العثور على الإجازة المرضية'
        } else if (response.status === 500) {
          errorMessage = '⚠️ خطأ في خادم النظام'
          errorDetails = 'حدث خطأ أثناء جلب البيانات. يرجى المحاولة مرة أخرى بعد قليل'
        }
        
        throw new Error(JSON.stringify({ message: errorMessage, details: errorDetails }))
      }

      // Backend returns array, get first element
      if (Array.isArray(data) && data.length > 0) {
        setLeaveData(data[0])
        setShowPdfModal(true)
        console.log('✅ Leave data fetched successfully', data[0])
      } else {
        throw new Error(JSON.stringify({ 
          message: '❌ لم يتم العثور على الإجازة المرضية',
          details: 'يرجى التأكد من:\n• رقم الخدمة صحيح\n• رقم الهوية/الإقامة صحيح\n• تم إنشاء الإجازة مسبقاً في النظام'
        }))
      }
    } catch (err) {
      console.error('❌ Fetch error:', err)
      
      // Parse error if it's JSON stringified
      try {
        const errorObj = JSON.parse(err.message)
        setError(errorObj.message)
        if (errorObj.details) {
          setErrors({ details: errorObj.details })
        }
      } catch {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.slContainer}>
      {/* Title Section */}
      <div className={styles.titleSection}>
        <h1 className={styles.title}>تحميل تقرير الإجازة المرضية</h1>
        <p className={styles.description}>
          أدخل رقم الخدمة ورقم الهوية لتحميل تقرير الإجازة المرضية
        </p>
      </div>

      {/* Form Container */}
      <div className={styles.formContainer}>
        <form onSubmit={handleSubmit} className={styles.slForm}>
          {/* Service Number */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="serviceNum">
              رقم الخدمة *
            </label>
            <input
              className={styles.inputField}
              type="text"
              id="serviceNum"
              name="serviceNum"
              value={formData.serviceNum}
              onChange={handleChange}
              placeholder="أدخل رقم الخدمة"
              required
            />
            {errors.serviceNum && (
              <span className={styles.errorMessage}>{errors.serviceNum}</span>
            )}
          </div>

          {/* National ID */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="nationalID">
              رقم الهوية / الإقامة *
            </label>
            <input
              className={styles.inputField}
              type="text"
              id="nationalID"
              name="nationalID"
              value={formData.nationalID}
              onChange={handleChange}
              placeholder="أدخل رقم الهوية أو الإقامة"
              maxLength="15"
              required
            />
            {errors.nationalID && (
              <span className={styles.errorMessage}>{errors.nationalID}</span>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className={styles.pdfDownloadButton}
            disabled={loading}
          >
            {loading ? 'جاري تحميل PDF...' : 'تحميل تقرير PDF'}
          </button>

          {/* Error Display */}
          {error && (
            <div className={styles.pdfErrorContainer}>
              <p className={styles.pdfErrorMessage}>{error}</p>
              {errors.details && (
                <div className={styles.pdfErrorDetails}>
                  {errors.details.split('\n').map((line, index) => (
                    <p key={index} className={styles.pdfErrorDetailLine}>
                      {line}
                    </p>
                  ))}
                </div>
              )}
              {!errors.details && (
                <p className={styles.pdfErrorHelp}>
                  إذا استمر الخطأ، يرجى التواصل مع الدعم الفني
                </p>
              )}
            </div>
          )}
        </form>

        {/* Back Button */}
        <Link to="/" className={styles.backButton}>
          العودة إلى الصفحة الرئيسية
        </Link>
      </div>

      {/* PDF Modal — القالب يُختار حسب نوع المستند المحفوظ */}
      {showPdfModal && leaveData && (
        leaveData.document_type === 'companion_visit' ? (
          <CompanionVisitPDFOriginal
            data={leaveData}
            onClose={() => setShowPdfModal(false)}
          />
        ) : (
          <SickLeavePDFOriginal
            data={leaveData}
            onClose={() => setShowPdfModal(false)}
          />
        )
      )}
    </div>
  )
}

export default PdfGenerator

import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import CVForm from '../components/CVForm'
import styles from '../styles/CVForm.module.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

function CreateCV() {
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(false)
  
  // Get extracted data from AI if available
  const extractedData = location.state?.extractedData || null

  const handleSubmit = async (formData) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/cvs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        window.showToast?.('تم إنشاء السيرة الذاتية بنجاح', 'success')
        navigate('/cv/list')
      } else {
        window.showToast?.(data.message || 'فشل في إنشاء السيرة الذاتية', 'error')
      }
    } catch (err) {
      console.error('Error creating CV:', err)
      window.showToast?.('حدث خطأ في الاتصال بالخادم', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>إنشاء سيرة ذاتية جديدة</h1>
        <p className={styles.subtitle}>
          {extractedData 
            ? '✨ تم استخراج البيانات بنجاح! راجع البيانات وعدّل حسب الحاجة'
            : 'املأ البيانات التالية لإنشاء سيرة ذاتية احترافية'
          }
        </p>
      </div>

      <CVForm 
        initialData={extractedData || undefined}
        onSubmit={handleSubmit}
        loading={loading}
        submitText="إنشاء السيرة الذاتية"
      />
    </div>
  )
}

export default CreateCV

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CVForm from '../components/CVForm'
import styles from '../styles/CVForm.module.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

function EditCV() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [initialData, setInitialData] = useState(null)
  const [fetchLoading, setFetchLoading] = useState(true)

  useEffect(() => {
    fetchCV()
  }, [id])

  const fetchCV = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/cvs/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (response.ok && data.success) {
        setInitialData(data.data)
      } else {
        window.showToast?.('فشل في جلب بيانات السيرة الذاتية', 'error')
        navigate('/cv/list')
      }
    } catch (err) {
      console.error('Error fetching CV:', err)
      window.showToast?.('حدث خطأ في الاتصال بالخادم', 'error')
      navigate('/cv/list')
    } finally {
      setFetchLoading(false)
    }
  }

  const handleSubmit = async (formData) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/cvs/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        window.showToast?.('تم تحديث السيرة الذاتية بنجاح', 'success')
        navigate('/cv/list')
      } else {
        window.showToast?.(data.message || 'فشل في تحديث السيرة الذاتية', 'error')
      }
    } catch (err) {
      console.error('Error updating CV:', err)
      window.showToast?.('حدث خطأ في الاتصال بالخادم', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (fetchLoading) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          جاري تحميل البيانات...
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>تعديل السيرة الذاتية</h1>
        <p className={styles.subtitle}>قم بتحديث البيانات حسب الحاجة</p>
      </div>

      {initialData && (
        <CVForm 
          initialData={initialData}
          onSubmit={handleSubmit}
          loading={loading}
          submitText="تحديث السيرة الذاتية"
        />
      )}
    </div>
  )
}

export default EditCV

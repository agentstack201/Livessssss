import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './HospitalManagement.module.css'
import MediaPicker from '../components/MediaPicker'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const DEFAULT_LOGO = '/images/1.png'

function HospitalManagement() {
  const navigate = useNavigate()
  const [hospitals, setHospitals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [editingHospital, setEditingHospital] = useState(null)
  const [formData, setFormData] = useState({
    name_ar: '',
    name_en: '',
    license_number: '',
    logo: ''
  })
  const [searchTerm, setSearchTerm] = useState('')

  const token = localStorage.getItem('token')
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const userPermissions = user.permissions || {}
  const canManageHospitals = userPermissions.can_manage_hospitals || user.role === 'admin'

  useEffect(() => {
    if (!canManageHospitals) {
      navigate('/dashboard')
      return
    }
    fetchHospitals()
  }, [])

  const fetchHospitals = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/all-hospitals`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (response.ok && data.data) {
        setHospitals(data.data)
      }
    } catch (error) {
      console.error('Error fetching hospitals:', error)
      window.showToast?.('فشل في جلب المستشفيات', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.name_ar || !formData.name_en) {
      window.showToast?.('يرجى ملء الاسم بالعربية والإنجليزية', 'error')
      return
    }

    try {
      const url = editingHospital 
        ? `${API_BASE_URL}/hospitals/${editingHospital.id}`
        : `${API_BASE_URL}/hospitals`
      
      const method = editingHospital ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        window.showToast?.(
          editingHospital ? 'تم تحديث بيانات المستشفى بنجاح' : 'تم إضافة المستشفى بنجاح',
          'success'
        )
        setShowModal(false)
        resetForm()
        fetchHospitals()
      } else {
        window.showToast?.(data.message || 'فشلت العملية', 'error')
      }
    } catch (error) {
      console.error('Error:', error)
      window.showToast?.('حدث خطأ أثناء حفظ البيانات', 'error')
    }
  }

  const handleDelete = async (hospitalId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المستشفى؟')) return

    try {
      const response = await fetch(`${API_BASE_URL}/hospitals/${hospitalId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        window.showToast?.('تم حذف المستشفى بنجاح', 'success')
        fetchHospitals()
      }
    } catch (error) {
      console.error('Error:', error)
      window.showToast?.('فشل في حذف المستشفى', 'error')
    }
  }

  const openAddModal = () => {
    resetForm()
    setEditingHospital(null)
    setShowModal(true)
  }

  const openEditModal = (hospital) => {
    setFormData({
      name_ar: hospital.name_ar,
      name_en: hospital.name_en,
      license_number: hospital.license_number || '',
      logo: hospital.logo || ''
    })
    setEditingHospital(hospital)
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({
      name_ar: '',
      name_en: '',
      license_number: '',
      logo: ''
    })
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  const filteredHospitals = hospitals.filter(hospital => 
    hospital.name_ar.includes(searchTerm) ||
    hospital.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (hospital.license_number && hospital.license_number.includes(searchTerm))
  )

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>⏳ جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🏥 إدارة المستشفيات</h1>
        <div className={styles.headerButtons}>
          <button className={styles.addBtn} onClick={openAddModal}>
            ➕ إضافة مستشفى
          </button>
          <button 
            className={styles.backBtn} 
            onClick={() => navigate('/dashboard')}
          >
            ← رجوع
          </button>
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchContainer}>
        <input
          type="text"
          placeholder="🔍 ابحث عن مستشفى بالاسم أو الترخيص..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {/* Hospitals Table */}
      <div className={styles.tableContainer}>
        <table className={styles.countriesTable}>
          <thead>
            <tr>
              <th>#</th>
              <th>الشعار</th>
              <th>الاسم (عربي)</th>
              <th>الاسم (إنجليزي)</th>
              <th>رقم الترخيص</th>
              <th>أضافه</th>
              <th>تاريخ الإضافة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredHospitals.map((hospital, index) => {
              const logoUrl = hospital.logo 
                ? (hospital.logo.startsWith('http') || hospital.logo.startsWith('data:') ? hospital.logo : `${API_BASE_URL}${hospital.logo}`)
                : DEFAULT_LOGO;

              return (
                <tr key={hospital.id}>
                  <td>{index + 1}</td>
                  <td>
                    <img 
                      src={logoUrl} 
                      alt="Logo" 
                      className={styles.tableLogo} 
                    />
                  </td>
                  <td className={styles.countryNameAr}>{hospital.name_ar}</td>
                  <td className={styles.countryNameEn}>{hospital.name_en}</td>
                  <td className={styles.licenseCell}>{hospital.license_number || '-'}</td>
                  <td>
                    <span className={styles.createdBy}>
                      {hospital.created_by || 'النظام'}
                    </span>
                  </td>
                  <td className={styles.dateCell}>{formatDate(hospital.createdAt)}</td>
                  <td>
                    <div className={styles.actionBtns}>
                      <button 
                        className={styles.editBtn}
                        onClick={() => openEditModal(hospital)}
                      >
                        ✏️ تعديل
                      </button>
                      <button 
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(hospital.id)}
                      >
                        🗑️ حذف
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        
        {filteredHospitals.length === 0 && (
          <div className={styles.noData}>
            📭 لا توجد مستشفيات مطابقة للبحث
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingHospital ? '✏️ تعديل بيانات مستشفى' : '➕ إضافة مستشفى جديد'}</h2>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label>🇸🇦 اسم المستشفى (عربي) *</label>
                <input
                  type="text"
                  value={formData.name_ar}
                  onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                  placeholder="مثال: مستشفى النور التخصصي"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>🌐 اسم المستشفى (إنجليزي) *</label>
                <input
                  type="text"
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  placeholder="Example: AL NOOR SPECIALIST HOSPITAL"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>💳 رقم الترخيص للمستشفى</label>
                <input
                  type="text"
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                  placeholder="مثال: 1410845906"
                />
              </div>

              <div className={styles.formGroup}>
                <label>🖼️ الشعار / الشتم</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowMediaPicker(true)}
                    className={styles.pickerBtn}
                  >
                    📁 اختر من المعرض
                  </button>
                  {formData.logo && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, logo: '' })}
                      className={styles.resetBtn}
                    >
                      إعادة الافتراضي
                    </button>
                  )}
                </div>
                <div className={styles.logoPreview}>
                  <p style={{ margin: '5px 0', fontSize: '0.85rem' }}>المعاينة:</p>
                  <img
                    src={formData.logo 
                      ? (formData.logo.startsWith('http') || formData.logo.startsWith('data:') ? formData.logo : `${API_BASE_URL}${formData.logo}`)
                      : DEFAULT_LOGO
                    }
                    alt="Preview"
                    style={{ height: '60px', width: 'auto', border: '1px solid #ddd', padding: '4px', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div className={styles.modalActions}>
                <button type="submit" className={styles.submitBtn}>
                  {editingHospital ? '💾 تحديث' : '➕ إضافة'}
                </button>
                <button 
                  type="button" 
                  className={styles.cancelBtn}
                  onClick={() => setShowModal(false)}
                >
                  ❌ إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Media Picker Component */}
      {showMediaPicker && (
        <MediaPicker
          onSelect={(url) => {
            setFormData(prev => ({ ...prev, logo: url }))
            setShowMediaPicker(false)
          }}
          onClose={() => setShowMediaPicker(false)}
        />
      )}
    </div>
  )
}

export default HospitalManagement

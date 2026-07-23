import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './DoctorManagement.module.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

function DoctorManagement() {
  const navigate = useNavigate()
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState(null)
  const [formData, setFormData] = useState({
    name_ar: '',
    name_en: '',
    position_ar: '',
    position_en: ''
  })
  const [searchTerm, setSearchTerm] = useState('')

  const token = localStorage.getItem('token')
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const userPermissions = user.permissions || {}
  const canManageDoctors = userPermissions.can_manage_doctors || user.role === 'admin'

  useEffect(() => {
    if (!canManageDoctors) {
      navigate('/dashboard')
      return
    }
    fetchDoctors()
  }, [])

  const fetchDoctors = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/all-doctors`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (response.ok && data.data) {
        setDoctors(data.data)
      }
    } catch (error) {
      console.error('Error fetching doctors:', error)
      window.showToast?.('فشل في جلب الأطباء', 'error')
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
      const url = editingDoctor 
        ? `${API_BASE_URL}/doctors/${editingDoctor.id}`
        : `${API_BASE_URL}/doctors`
      
      const method = editingDoctor ? 'PUT' : 'POST'
      
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
          editingDoctor ? 'تم تحديث بيانات الطبيب بنجاح' : 'تم إضافة الطبيب بنجاح',
          'success'
        )
        setShowModal(false)
        resetForm()
        fetchDoctors()
      } else {
        window.showToast?.(data.message || 'فشلت العملية', 'error')
      }
    } catch (error) {
      console.error('Error:', error)
      window.showToast?.('حدث خطأ أثناء حفظ البيانات', 'error')
    }
  }

  const handleDelete = async (doctorId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطبيب؟')) return

    try {
      const response = await fetch(`${API_BASE_URL}/doctors/${doctorId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        window.showToast?.('تم حذف الطبيب بنجاح', 'success')
        fetchDoctors()
      }
    } catch (error) {
      console.error('Error:', error)
      window.showToast?.('فشل في حذف الطبيب', 'error')
    }
  }

  const openAddModal = () => {
    resetForm()
    setEditingDoctor(null)
    setShowModal(true)
  }

  const openEditModal = (doctor) => {
    setFormData({
      name_ar: doctor.name_ar,
      name_en: doctor.name_en,
      position_ar: doctor.position_ar || '',
      position_en: doctor.position_en || ''
    })
    setEditingDoctor(doctor)
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({
      name_ar: '',
      name_en: '',
      position_ar: '',
      position_en: ''
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

  const filteredDoctors = doctors.filter(doctor => 
    doctor.name_ar.includes(searchTerm) ||
    doctor.name_en.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (doctor.position_ar && doctor.position_ar.includes(searchTerm)) ||
    (doctor.position_en && doctor.position_en.toLowerCase().includes(searchTerm.toLowerCase()))
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
        <h1>🥼 إدارة الأطباء</h1>
        <div className={styles.headerButtons}>
          <button className={styles.addBtn} onClick={openAddModal}>
            ➕ إضافة طبيب
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
          placeholder="🔍 ابحث عن طبيب بالاسم، المسمى، أو الترخيص..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {/* Doctors Table */}
      <div className={styles.tableContainer}>
        <table className={styles.countriesTable}>
          <thead>
            <tr>
              <th>#</th>
              <th>الاسم (عربي)</th>
              <th>الاسم (إنجليزي)</th>
              <th>التخصص (عربي)</th>
              <th>التخصص (إنجليزي)</th>
              <th>أضافه</th>
              <th>تاريخ الإضافة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredDoctors.map((doctor, index) => (
              <tr key={doctor.id}>
                <td>{index + 1}</td>
                <td className={styles.countryNameAr}>{doctor.name_ar}</td>
                <td className={styles.countryNameEn}>{doctor.name_en}</td>
                <td>{doctor.position_ar || '-'}</td>
                <td>{doctor.position_en || '-'}</td>
                <td>
                  <span className={styles.createdBy}>
                    {doctor.created_by || 'النظام'}
                  </span>
                </td>
                <td className={styles.dateCell}>{formatDate(doctor.createdAt)}</td>
                <td>
                  <div className={styles.actionBtns}>
                    <button 
                      className={styles.editBtn}
                      onClick={() => openEditModal(doctor)}
                    >
                      ✏️ تعديل
                    </button>
                    <button 
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(doctor.id)}
                    >
                      🗑️ حذف
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredDoctors.length === 0 && (
          <div className={styles.noData}>
            📭 لا يوجد أطباء مطابقين للبحث
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingDoctor ? '✏️ تعديل بيانات طبيب' : '➕ إضافة طبيب جديد'}</h2>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label>🇸🇦 اسم الطبيب (عربي) *</label>
                <input
                  type="text"
                  value={formData.name_ar}
                  onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                  placeholder="مثال: د. خالد الحربي"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>🌐 اسم الطبيب (إنجليزي) *</label>
                <input
                  type="text"
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  placeholder="Example: Dr. Khalid Al-Harbi"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>🇸🇦 التخصص/المنصب (عربي)</label>
                <input
                  type="text"
                  value={formData.position_ar}
                  onChange={(e) => setFormData({ ...formData, position_ar: e.target.value })}
                  placeholder="مثال: طبيب مقيم"
                />
              </div>

              <div className={styles.formGroup}>
                <label>🌐 التخصص/المنصب (إنجليزي)</label>
                <input
                  type="text"
                  value={formData.position_en}
                  onChange={(e) => setFormData({ ...formData, position_en: e.target.value })}
                  placeholder="Example: Resident Physician"
                />
              </div>



              <div className={styles.modalActions}>
                <button type="submit" className={styles.submitBtn}>
                  {editingDoctor ? '💾 تحديث' : '➕ إضافة'}
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
    </div>
  )
}

export default DoctorManagement

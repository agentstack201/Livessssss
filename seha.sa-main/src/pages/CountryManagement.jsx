import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './CountryManagement.module.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

function CountryManagement() {
  const navigate = useNavigate()
  const [countries, setCountries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCountry, setEditingCountry] = useState(null)
  const [formData, setFormData] = useState({
    country_name_ar: '',
    country_name_en: ''
  })
  const [searchTerm, setSearchTerm] = useState('')

  const token = localStorage.getItem('token')
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const userPermissions = user.permissions || {}
  const canManageCountries = userPermissions.can_manage_countries || user.role === 'admin'

  useEffect(() => {
    if (!canManageCountries) {
      navigate('/dashboard')
      return
    }
    fetchCountries()
  }, [])

  const fetchCountries = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/all-countries`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (response.ok && data.data) {
        setCountries(data.data)
      }
    } catch (error) {
      console.error('Error fetching countries:', error)
      window.showToast?.('فشل في جلب الدول', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.country_name_ar || !formData.country_name_en) {
      window.showToast?.('يرجى ملء جميع الحقول', 'error')
      return
    }

    try {
      const url = editingCountry 
        ? `${API_BASE_URL}/countries/${editingCountry.id}`
        : `${API_BASE_URL}/countries`
      
      const method = editingCountry ? 'PUT' : 'POST'
      
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
          editingCountry ? 'تم تحديث الدولة بنجاح' : 'تم إضافة الدولة بنجاح',
          'success'
        )
        setShowModal(false)
        resetForm()
        fetchCountries()
      } else {
        window.showToast?.(data.message || 'فشلت العملية', 'error')
      }
    } catch (error) {
      console.error('Error:', error)
      window.showToast?.('حدث خطأ', 'error')
    }
  }

  const handleDelete = async (countryId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الدولة؟')) return

    try {
      const response = await fetch(`${API_BASE_URL}/countries/${countryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        window.showToast?.('تم حذف الدولة بنجاح', 'success')
        fetchCountries()
      }
    } catch (error) {
      console.error('Error:', error)
      window.showToast?.('فشل في حذف الدولة', 'error')
    }
  }

  const openAddModal = () => {
    resetForm()
    setEditingCountry(null)
    setShowModal(true)
  }

  const openEditModal = (country) => {
    setFormData({
      country_name_ar: country.country_name_ar,
      country_name_en: country.country_name_en
    })
    setEditingCountry(country)
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({
      country_name_ar: '',
      country_name_en: ''
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

  const filteredCountries = countries.filter(country => 
    country.country_name_ar.includes(searchTerm) ||
    country.country_name_en.toLowerCase().includes(searchTerm.toLowerCase())
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
        <h1>🌍 إدارة الدول</h1>
        <div className={styles.headerButtons}>
          <button className={styles.addBtn} onClick={openAddModal}>
            ➕ إضافة دولة
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
          placeholder="🔍 ابحث عن دولة..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {/* Countries Table */}
      <div className={styles.tableContainer}>
        <table className={styles.countriesTable}>
          <thead>
            <tr>
              <th>#</th>
              <th>اسم الدولة (عربي)</th>
              <th>اسم الدولة (إنجليزي)</th>
              <th>أضافها</th>
              <th>تاريخ الإضافة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredCountries.map((country, index) => (
              <tr key={country.id}>
                <td>{index + 1}</td>
                <td className={styles.countryNameAr}>{country.country_name_ar}</td>
                <td className={styles.countryNameEn}>{country.country_name_en}</td>
                <td>
                  <span className={styles.createdBy}>
                    {country.created_by || 'النظام'}
                  </span>
                </td>
                <td className={styles.dateCell}>{formatDate(country.createdAt)}</td>
                <td>
                  <div className={styles.actionBtns}>
                    <button 
                      className={styles.editBtn}
                      onClick={() => openEditModal(country)}
                    >
                      ✏️ تعديل
                    </button>
                    <button 
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(country.id)}
                    >
                      🗑️ حذف
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredCountries.length === 0 && (
          <div className={styles.noData}>
            📭 لا توجد دول مطابقة للبحث
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editingCountry ? '✏️ تعديل دولة' : '➕ إضافة دولة جديدة'}</h2>
              <button className={styles.closeBtn} onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label>🇸🇦 اسم الدولة (عربي) *</label>
                <input
                  type="text"
                  value={formData.country_name_ar}
                  onChange={(e) => setFormData({ ...formData, country_name_ar: e.target.value })}
                  placeholder="مثال: السعودية"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>🌐 اسم الدولة (إنجليزي) *</label>
                <input
                  type="text"
                  value={formData.country_name_en}
                  onChange={(e) => setFormData({ ...formData, country_name_en: e.target.value })}
                  placeholder="Example: Saudi Arabia"
                  required
                />
              </div>

              <div className={styles.modalActions}>
                <button type="submit" className={styles.submitBtn}>
                  {editingCountry ? '💾 تحديث' : '➕ إضافة'}
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

export default CountryManagement

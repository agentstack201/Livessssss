import { useState, useEffect, useCallback } from 'react'
import styles from './MediaPicker.module.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const API_MEDIA = `${API_BASE_URL}/media`

/**
 * مكون اختيار الوسائط - قابل لإعادة الاستخدام
 * @param {Object} props
 * @param {boolean} props.isOpen - حالة فتح النافذة
 * @param {function} props.onClose - دالة إغلاق النافذة
 * @param {function} props.onSelect - دالة الاختيار (تمرر الملف المختار)
 * @param {boolean} props.multiple - السماح باختيار أكثر من ملف
 * @param {string} props.accept - أنواع الملفات المقبولة (image, pdf, all)
 * @param {string} props.category - تصنيف الوسائط للفلترة
 */
function MediaPicker({ 
  isOpen, 
  onClose, 
  onSelect, 
  multiple = false, 
  accept = 'all',
  category = 'all'
}) {
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [selectedItems, setSelectedItems] = useState([])
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('library') // 'library' or 'upload'

  // جلب الوسائط
  const fetchMedia = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: 50,
        ...(category !== 'all' && { category }),
        ...(accept === 'image' && { type: 'image' }),
        ...(accept === 'pdf' && { type: 'application/pdf' }),
        ...(search && { search })
      })

      const response = await fetch(`${API_MEDIA}?${params}`)
      const data = await response.json()

      if (data.success) {
        setMedia(data.data)
      }
    } catch (err) {
      setError('فشل في تحميل الوسائط')
    } finally {
      setLoading(false)
    }
  }, [category, accept, search])

  useEffect(() => {
    if (isOpen) {
      fetchMedia()
      setSelectedItems([])
    }
  }, [isOpen, fetchMedia])

  // رفع ملف جديد
  const handleUpload = async (files) => {
    if (!files || files.length === 0) return

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', files[0])
      formData.append('category', category !== 'all' ? category : 'general')

      const response = await fetch(`${API_MEDIA}/upload`, {
        method: 'POST',
        body: formData
      })
      const data = await response.json()

      if (data.success) {
        // إضافة الملف المرفوع واختياره مباشرة
        setMedia(prev => [data.data, ...prev])
        if (!multiple) {
          onSelect(data.data)
          onClose()
        } else {
          setSelectedItems(prev => [...prev, data.data.id])
        }
        setActiveTab('library')
      } else {
        setError(data.message || 'فشل في رفع الملف')
      }
    } catch (err) {
      setError('حدث خطأ أثناء رفع الملف')
    } finally {
      setUploading(false)
    }
  }

  // تحديد/إلغاء تحديد ملف
  const toggleSelect = (item) => {
    if (multiple) {
      setSelectedItems(prev =>
        prev.includes(item.id)
          ? prev.filter(id => id !== item.id)
          : [...prev, item.id]
      )
    } else {
      setSelectedItems([item.id])
    }
  }

  // تأكيد الاختيار
  const confirmSelection = () => {
    const selected = media.filter(m => selectedItems.includes(m.id))
    if (multiple) {
      onSelect(selected)
    } else {
      onSelect(selected[0])
    }
    onClose()
  }

  // اختيار سريع (نقرة مزدوجة)
  const handleDoubleClick = (item) => {
    if (!multiple) {
      onSelect(item)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2>اختر من الوسائط</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'library' ? styles.active : ''}`}
            onClick={() => setActiveTab('library')}
          >
            📁 مكتبة الوسائط
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'upload' ? styles.active : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            📤 رفع جديد
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {activeTab === 'library' ? (
            <>
              {/* Search */}
              <div className={styles.searchBar}>
                <input
                  type="text"
                  placeholder="بحث في الوسائط..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Error */}
              {error && <div className={styles.error}>{error}</div>}

              {/* Media Grid */}
              {loading ? (
                <div className={styles.loadingState}>
                  <div className={styles.spinner}></div>
                  <p>جاري التحميل...</p>
                </div>
              ) : media.length === 0 ? (
                <div className={styles.emptyState}>
                  <span>📂</span>
                  <p>لا توجد وسائط</p>
                  <button onClick={() => setActiveTab('upload')}>
                    رفع ملف جديد
                  </button>
                </div>
              ) : (
                <div className={styles.mediaGrid}>
                  {media.map(item => (
                    <div
                      key={item.id}
                      className={`${styles.mediaItem} ${selectedItems.includes(item.id) ? styles.selected : ''}`}
                      onClick={() => toggleSelect(item)}
                      onDoubleClick={() => handleDoubleClick(item)}
                    >
                      {item.mime_type.startsWith('image/') ? (
                        <img src={item.url.startsWith('http') || item.url.startsWith('data:') ? item.url : `${API_BASE_URL}${item.url}`} alt={item.alt_text} />
                      ) : (
                        <div className={styles.fileIcon}>📄</div>
                      )}
                      {selectedItems.includes(item.id) && (
                        <div className={styles.checkmark}>✓</div>
                      )}
                      <div className={styles.itemName}>{item.original_name}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Upload Tab */
            <div className={styles.uploadArea}>
              <div
                className={styles.dropZone}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  handleUpload(e.dataTransfer.files)
                }}
              >
                <input
                  type="file"
                  accept={accept === 'image' ? 'image/*' : accept === 'pdf' ? 'application/pdf' : 'image/*,application/pdf'}
                  onChange={(e) => handleUpload(e.target.files)}
                  id="mediaPickerUpload"
                  style={{ display: 'none' }}
                />
                <label htmlFor="mediaPickerUpload">
                  {uploading ? (
                    <>
                      <div className={styles.spinner}></div>
                      <p>جاري الرفع...</p>
                    </>
                  ) : (
                    <>
                      <span className={styles.uploadIcon}>📤</span>
                      <p>اسحب الملف هنا أو انقر للاختيار</p>
                      <small>JPG, PNG, GIF, WebP, PDF (حتى 10MB)</small>
                    </>
                  )}
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.selectedCount}>
            {selectedItems.length > 0 && (
              <span>تم تحديد {selectedItems.length} ملف</span>
            )}
          </div>
          <div className={styles.footerActions}>
            <button className={styles.cancelBtn} onClick={onClose}>
              إلغاء
            </button>
            <button
              className={styles.selectBtn}
              onClick={confirmSelection}
              disabled={selectedItems.length === 0}
            >
              اختيار
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MediaPicker

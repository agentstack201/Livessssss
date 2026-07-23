import { useState, useEffect, useCallback } from 'react'
import styles from './MediaManager.module.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const API_MEDIA = `${API_BASE_URL}/media`

function MediaManager() {
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [selectedMedia, setSelectedMedia] = useState([])
  const [filters, setFilters] = useState({
    category: 'all',
    type: 'all',
    search: ''
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  const [stats, setStats] = useState(null)
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [editingMedia, setEditingMedia] = useState(null)
  const [previewMedia, setPreviewMedia] = useState(null)

  // جلب الوسائط
  const fetchMedia = useCallback(async () => {
    setLoading(true)
    setError('')
    
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.category !== 'all' && { category: filters.category }),
        ...(filters.type !== 'all' && { type: filters.type }),
        ...(filters.search && { search: filters.search })
      })

      const response = await fetch(`${API_MEDIA}?${params}`)
      const data = await response.json()

      if (data.success) {
        setMedia(data.data)
        setPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages
        }))
      } else {
        setError(data.message || 'فشل في جلب الوسائط')
      }
    } catch (err) {
      setError('حدث خطأ أثناء الاتصال بالسيرفر')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, filters])

  // جلب الإحصائيات
  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_MEDIA}/stats`)
      const data = await response.json()
      if (data.success) {
        setStats(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  useEffect(() => {
    fetchMedia()
    fetchStats()
  }, [fetchMedia])

  // رفع ملفات
  const handleUpload = async (files) => {
    if (!files || files.length === 0) return

    setUploading(true)
    setError('')
    setSuccess('')

    try {
      const formData = new FormData()
      
      if (files.length === 1) {
        formData.append('file', files[0])
        const response = await fetch(`${API_MEDIA}/upload`, {
          method: 'POST',
          body: formData
        })
        const data = await response.json()
        
        if (data.success) {
          setSuccess('تم رفع الملف بنجاح')
          fetchMedia()
          fetchStats()
          setShowUploadModal(false)
        } else {
          setError(data.message || 'فشل في رفع الملف')
        }
      } else {
        for (let file of files) {
          formData.append('files', file)
        }
        const response = await fetch(`${API_MEDIA}/upload-multiple`, {
          method: 'POST',
          body: formData
        })
        const data = await response.json()
        
        if (data.success) {
          setSuccess(`تم رفع ${files.length} ملف بنجاح`)
          fetchMedia()
          fetchStats()
          setShowUploadModal(false)
        } else {
          setError(data.message || 'فشل في رفع الملفات')
        }
      }
    } catch (err) {
      setError('حدث خطأ أثناء رفع الملفات')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  // حذف ملف
  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الملف؟')) return

    try {
      const response = await fetch(`${API_MEDIA}/${id}`, {
        method: 'DELETE'
      })
      const data = await response.json()

      if (data.success) {
        setSuccess('تم حذف الملف بنجاح')
        fetchMedia()
        fetchStats()
      } else {
        setError(data.message || 'فشل في حذف الملف')
      }
    } catch (err) {
      setError('حدث خطأ أثناء حذف الملف')
    }
  }

  // حذف ملفات متعددة
  const handleDeleteSelected = async () => {
    if (selectedMedia.length === 0) return
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedMedia.length} ملف؟`)) return

    try {
      const response = await fetch(`${API_MEDIA}/delete-multiple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedMedia })
      })
      const data = await response.json()

      if (data.success) {
        setSuccess(`تم حذف ${selectedMedia.length} ملف بنجاح`)
        setSelectedMedia([])
        fetchMedia()
        fetchStats()
      } else {
        setError(data.message || 'فشل في حذف الملفات')
      }
    } catch (err) {
      setError('حدث خطأ أثناء حذف الملفات')
    }
  }

  // تحديث معلومات ملف
  const handleUpdateMedia = async (id, updates) => {
    try {
      const response = await fetch(`${API_MEDIA}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      const data = await response.json()

      if (data.success) {
        setSuccess('تم تحديث معلومات الملف بنجاح')
        setEditingMedia(null)
        fetchMedia()
      } else {
        setError(data.message || 'فشل في تحديث الملف')
      }
    } catch (err) {
      setError('حدث خطأ أثناء تحديث الملف')
    }
  }

  // تحديد/إلغاء تحديد ملف
  const toggleSelectMedia = (id) => {
    setSelectedMedia(prev => 
      prev.includes(id) 
        ? prev.filter(mediaId => mediaId !== id)
        : [...prev, id]
    )
  }

  // تحديد الكل
  const selectAll = () => {
    if (selectedMedia.length === media.length) {
      setSelectedMedia([])
    } else {
      setSelectedMedia(media.map(m => m.id))
    }
  }

  // تنسيق حجم الملف
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // نسخ الرابط
  const copyToClipboard = (url) => {
    navigator.clipboard.writeText(url.startsWith('http') ? url : `${API_BASE_URL}${url}`)
    setSuccess('تم نسخ الرابط!')
    setTimeout(() => setSuccess(''), 2000)
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>📁 إدارة الوسائط</h1>
          <p className={styles.subtitle}>إدارة الصور والملفات المرفوعة</p>
        </div>
        <button 
          className={styles.uploadBtn}
          onClick={() => setShowUploadModal(true)}
        >
          ➕ رفع ملف جديد
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>📊</span>
            <div>
              <div className={styles.statValue}>{stats.totalCount}</div>
              <div className={styles.statLabel}>إجمالي الملفات</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statIcon}>💾</span>
            <div>
              <div className={styles.statValue}>{stats.totalSizeFormatted}</div>
              <div className={styles.statLabel}>الحجم الكلي</div>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {error && <div className={styles.errorMessage}>{error}</div>}
      {success && <div className={styles.successMessage}>{success}</div>}

      {/* Filters & Actions */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <input
            type="text"
            placeholder="بحث..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className={styles.searchInput}
          />
          <select
            value={filters.category}
            onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
            className={styles.filterSelect}
          >
            <option value="all">جميع التصنيفات</option>
            <option value="logos">شعارات</option>
            <option value="headers">ترويسات</option>
            <option value="general">عام</option>
          </select>
          <select
            value={filters.type}
            onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
            className={styles.filterSelect}
          >
            <option value="all">جميع الأنواع</option>
            <option value="image">صور</option>
            <option value="application/pdf">PDF</option>
          </select>
        </div>

        <div className={styles.actions}>
          {selectedMedia.length > 0 && (
            <button 
              className={styles.deleteSelectedBtn}
              onClick={handleDeleteSelected}
            >
              🗑️ حذف المحدد ({selectedMedia.length})
            </button>
          )}
          <button
            className={`${styles.viewModeBtn} ${viewMode === 'grid' ? styles.active : ''}`}
            onClick={() => setViewMode('grid')}
          >
            ⊞
          </button>
          <button
            className={`${styles.viewModeBtn} ${viewMode === 'list' ? styles.active : ''}`}
            onClick={() => setViewMode('list')}
          >
            ☰
          </button>
          <button className={styles.selectAllBtn} onClick={selectAll}>
            {selectedMedia.length === media.length ? '✗ إلغاء التحديد' : '✓ تحديد الكل'}
          </button>
        </div>
      </div>

      {/* Media Grid/List */}
      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>جاري تحميل الوسائط...</p>
        </div>
      ) : media.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📂</span>
          <h3>لا توجد وسائط</h3>
          <p>قم برفع ملفات جديدة للبدء</p>
          <button 
            className={styles.uploadBtn}
            onClick={() => setShowUploadModal(true)}
          >
            ➕ رفع ملف
          </button>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? styles.mediaGrid : styles.mediaList}>
          {media.map((item) => (
            <div 
              key={item.id} 
              className={`${styles.mediaCard} ${selectedMedia.includes(item.id) ? styles.selected : ''}`}
            >
              <div 
                className={styles.mediaCheckbox}
                onClick={() => toggleSelectMedia(item.id)}
              >
                {selectedMedia.includes(item.id) ? '✓' : ''}
              </div>
              
              <div 
                className={styles.mediaPreview}
                onClick={() => setPreviewMedia(item)}
              >
                {item.mime_type.startsWith('image/') ? (
                  <img src={item.url.startsWith('http') ? item.url : `${API_BASE_URL}${item.url}`} alt={item.alt_text} />
                ) : (
                  <div className={styles.fileIcon}>📄</div>
                )}
              </div>
              
              <div className={styles.mediaInfo}>
                <div className={styles.mediaName} title={item.original_name}>
                  {item.original_name}
                </div>
                <div className={styles.mediaMeta}>
                  <span>{formatFileSize(item.size)}</span>
                  <span className={styles.mediaCategory}>{item.category}</span>
                </div>
              </div>
              
              <div className={styles.mediaActions}>
                <button 
                  className={styles.actionBtn}
                  onClick={() => copyToClipboard(item.url.startsWith('http') ? item.url : `${API_BASE_URL}${item.url}`)}
                  title="نسخ الرابط"
                >
                  📋
                </button>
                <button 
                  className={styles.actionBtn}
                  onClick={() => setEditingMedia(item)}
                  title="تعديل"
                >
                  ✏️
                </button>
                <button 
                  className={`${styles.actionBtn} ${styles.deleteBtn}`}
                  onClick={() => handleDelete(item.id)}
                  title="حذف"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            disabled={pagination.page === 1}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
          >
            السابق
          </button>
          <span>
            صفحة {pagination.page} من {pagination.totalPages}
          </span>
          <button
            disabled={pagination.page === pagination.totalPages}
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
          >
            التالي
          </button>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className={styles.modalOverlay} onClick={() => setShowUploadModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>رفع ملفات جديدة</h2>
              <button onClick={() => setShowUploadModal(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
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
                  multiple
                  accept="image/*,application/pdf"
                  onChange={(e) => handleUpload(e.target.files)}
                  id="fileInput"
                  style={{ display: 'none' }}
                />
                <label htmlFor="fileInput" className={styles.dropZoneLabel}>
                  <span className={styles.dropIcon}>📤</span>
                  <p>اسحب الملفات هنا أو انقر للاختيار</p>
                  <small>JPG, PNG, GIF, WebP, SVG, PDF (حتى 10MB)</small>
                </label>
              </div>
              {uploading && (
                <div className={styles.uploadingState}>
                  <div className={styles.spinner}></div>
                  <p>جاري رفع الملفات...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingMedia && (
        <div className={styles.modalOverlay} onClick={() => setEditingMedia(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>تعديل معلومات الملف</h2>
              <button onClick={() => setEditingMedia(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>النص البديل</label>
                <input
                  type="text"
                  value={editingMedia.alt_text || ''}
                  onChange={(e) => setEditingMedia(prev => ({ ...prev, alt_text: e.target.value }))}
                />
              </div>
              <div className={styles.formGroup}>
                <label>التصنيف</label>
                <select
                  value={editingMedia.category || 'general'}
                  onChange={(e) => setEditingMedia(prev => ({ ...prev, category: e.target.value }))}
                >
                  <option value="general">عام</option>
                  <option value="logos">شعارات</option>
                  <option value="headers">ترويسات</option>
                </select>
              </div>
              <button 
                className={styles.saveBtn}
                onClick={() => handleUpdateMedia(editingMedia.id, {
                  alt_text: editingMedia.alt_text,
                  category: editingMedia.category
                })}
              >
                حفظ التغييرات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewMedia && (
        <div className={styles.previewOverlay} onClick={() => setPreviewMedia(null)}>
          <div className={styles.previewContent}>
            <button className={styles.previewClose} onClick={() => setPreviewMedia(null)}>✕</button>
            {previewMedia.mime_type.startsWith('image/') ? (
              <img src={previewMedia.url.startsWith('http') ? previewMedia.url : `${API_BASE_URL}${previewMedia.url}`} alt={previewMedia.alt_text} />
            ) : (
              <iframe src={previewMedia.url.startsWith('http') ? previewMedia.url : `${API_BASE_URL}${previewMedia.url}`} title={previewMedia.original_name} />
            )}
            <div className={styles.previewInfo}>
              <h3>{previewMedia.original_name}</h3>
              <p>{formatFileSize(previewMedia.size)} • {previewMedia.category}</p>
              <button onClick={() => copyToClipboard(previewMedia.url.startsWith('http') ? previewMedia.url : `${API_BASE_URL}${previewMedia.url}`)}>📋 نسخ الرابط</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MediaManager

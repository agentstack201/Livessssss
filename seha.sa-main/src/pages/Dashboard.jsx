import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import styles from './Dashboard.module.css'
import SickLeavePDFOriginal from '../components/SickLeavePDFOriginal'
import WelcomePopup from '../components/WelcomePopup'
import { sendLeaveViaWhatsApp } from '../utils/whatsapp'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

function Dashboard() {
  const navigate = useNavigate()
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState('')
  const [user, setUser] = useState(null)
  const [userPermissions, setUserPermissions] = useState(null)
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [selectedLeave, setSelectedLeave] = useState(null)
  const [sendingWaId, setSendingWaId] = useState(null) // id السجل الجاري إرساله عبر واتساب
  const [stats, setStats] = useState({
    total: 0,
    thisMonth: 0,
    thisWeek: 0,
    today: 0,
    users: 0
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Real-time search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setPagination(prev => ({ ...prev, page: 1 }))
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  // Initial load: auth + static stats
  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    if (userData) {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
      setUserPermissions(parsedUser.permissions || {})
    }

    // Fetch stats once (total leaves + users)
    fetchLeavesCount(token)
    fetchUsersCount(token)
  }, [navigate])

  // Fetch leaves when search or page changes
  useEffect(() => {
    const token = localStorage.getItem('token')

    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    fetchLeaves(token)
  }, [debouncedSearch, pagination.page, navigate])

  // Helper: get creation date from possible backend fields
  const getLeaveCreatedDate = (leave) => {
    const rawDate = leave.createdAt || leave.created_at || leave.issue_date
    if (!rawDate) return null
    const date = new Date(rawDate)
    return isNaN(date.getTime()) ? null : date
  }

  const calculateStats = (leavesData) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const todayCount = leavesData.filter(leave => {
      const createdDate = getLeaveCreatedDate(leave)
      return createdDate && createdDate >= today
    }).length

    const weekCount = leavesData.filter(leave => {
      const createdDate = getLeaveCreatedDate(leave)
      return createdDate && createdDate >= weekAgo
    }).length

    const monthCount = leavesData.filter(leave => {
      const createdDate = getLeaveCreatedDate(leave)
      return createdDate && createdDate >= monthStart
    }).length

    setStats(prev => ({
      ...prev,
      thisMonth: monthCount,
      thisWeek: weekCount,
      today: todayCount
    }))
  }

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  const handleSearch = (e) => {
    setSearchTerm(e.target.value)
  }

  const handlePrevPage = () => {
    if (pagination.hasPrev) {
      handlePageChange(pagination.page - 1)
    }
  }

  const handleNextPage = () => {
    if (pagination.hasNext) {
      handlePageChange(pagination.page + 1)
    }
  }

  const fetchLeavesCount = async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/sick-leaves/count`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      // Check for unauthorized
      if (response.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/login', { replace: true })
        return
      }

      const data = await response.json()
      if (response.ok && data.success) {
        setStats(prev => ({ ...prev, total: data.data.total }))
      }
    } catch (err) {
      console.error('Fetch leaves count error:', err)
    }
  }

  const fetchUsersCount = async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      // Check for unauthorized
      if (response.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/login', { replace: true })
        return
      }

      const data = await response.json()
      if (response.ok && data.success) {
        setStats(prev => ({ ...prev, users: data.data.length }))
      }
    } catch (err) {
      console.error('Fetch users error:', err)
    }
  }

  const fetchLeaves = async (token) => {
    try {
      setLoading(true)

      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearch
      })

      const response = await fetch(`${API_BASE_URL}/sick-leaves/all?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      // Check for unauthorized
      if (response.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/login', { replace: true })
        return
      }

      const data = await response.json()

      if (response.ok && data.success) {
        setLeaves(data.data)
        setPagination(data.pagination)

        // Calculate stats only for the first page and when no search
        if (pagination.page === 1 && !debouncedSearch) {
          calculateStats(data.data)
        }
      } else {
        console.error('API Error:', data)
        setError(data.message || 'فشل في جلب البيانات')
      }
    } catch (err) {
      console.error('Fetch leaves error:', err)
      console.error('Error details:', err.message)
      setError('فشل في الاتصال بالخادم')
    } finally {
      setLoading(false)
      if (initialLoading) {
        setInitialLoading(false)
      }
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const handleDownloadPDF = (leave) => {
    setSelectedLeave(leave)
    setShowPdfModal(true)
  }

  // إرسال التقرير مباشرة عبر واتساب من قائمة السجلات (دون فتح التقرير أولاً).
  // يستخدم رقم جوال الزبون المخزَّن مع السجل تلقائياً.
  const handleSendWhatsApp = async (leave) => {
    if (sendingWaId) return
    setSendingWaId(leave.id)
    try {
      await sendLeaveViaWhatsApp(leave)
    } catch (error) {
      console.error('❌ WhatsApp share error:', error)
      window.showToast?.('حدث خطأ أثناء الإرسال عبر واتساب', 'error')
    } finally {
      setSendingWaId(null)
    }
  }

  const handleEdit = (leave) => {
    // Navigate to sick leave form with leave data in state
    navigate('/sl-form', {
      state: {
        editMode: true,
        leaveData: leave
      }
    })
  }

  const handleDelete = async (leave) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الإجازة المرضية؟')) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${API_BASE_URL}/sick-leaves?service_num=${leave.service_num}&national_id=${leave.national_id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      const data = await response.json()

      if (response.ok) {
        // Remove from state
        setLeaves(leaves.filter(l => l.leave_id !== leave.leave_id))
        window.showToast?.('تم حذف الإجازة المرضية بنجاح', 'success')
      } else {
        window.showToast?.(data.message || 'فشل في حذف الإجازة المرضية', 'error')
      }
    } catch (err) {
      console.error('Delete error:', err)
      window.showToast?.('حدث خطأ أثناء حذف الإجازة المرضية', 'error')
    }
  }

  // Don't render anything if no token
  if (!localStorage.getItem('token')) {
    return null
  }

  return (
    <div className={styles.dashboardContainer}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logoSection}>
            <div className={styles.logoIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#306db5" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <h1>لوحة التحكم</h1>
              <p>إدارة الإجازات المرضية - منصة صحة</p>
            </div>
          </div>
          <div className={styles.userSection}>
            <div className={styles.userInfo}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>مرحباً، {user?.name}</span>
            </div>
            <button onClick={handleLogout} className={styles.logoutBtn}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Statistics Cards */}
      <div className={styles.statsContainer}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
            📊
          </div>
          <div className={styles.statInfo}>
            <h3 className={styles.statValue}>{stats.total}</h3>
            <p className={styles.statLabel}>إجمالي الإجازات</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
            📅
          </div>
          <div className={styles.statInfo}>
            <h3 className={styles.statValue}>{stats.thisMonth}</h3>
            <p className={styles.statLabel}>هذا الشهر</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            📆
          </div>
          <div className={styles.statInfo}>
            <h3 className={styles.statValue}>{stats.thisWeek}</h3>
            <p className={styles.statLabel}>هذا الأسبوع</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
            🕐
          </div>
          <div className={styles.statInfo}>
            <h3 className={styles.statValue}>{stats.today}</h3>
            <p className={styles.statLabel}>اليوم</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
            👥
          </div>
          <div className={styles.statInfo}>
            <h3 className={styles.statValue}>{Math.max(0, stats.users - 1)}</h3>
            <p className={styles.statLabel}>المستخدمين</p>
          </div>
        </div>

      </div>

      {/* Action Buttons */}
      <div className={styles.actionsBar}>
        {(userPermissions?.can_create_leaves || user?.role === 'admin') && (
          <Link to="/sl-form" className={styles.actionBtn}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>إضافة إجازة مرضية</span>
          </Link>
        )}
        <Link to="/pdf-generator" className={styles.actionBtn}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          <span>تحميل إجازة موجودة</span>
        </Link>
        {(userPermissions?.can_view_users || user?.role === 'admin') && (
          <Link to="/users" className={styles.actionBtn}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>إدارة المستخدمين</span>
          </Link>
        )}
        <Link to="/inquiries/slenquiry" className={styles.actionBtn}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <span>الاستعلام عن إجازة</span>
        </Link>
        {(userPermissions?.can_manage_media || user?.role === 'admin') && (
          <Link to="/media" className={styles.actionBtn}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span>إدارة الوسائط</span>
          </Link>
        )}
        {(userPermissions?.can_manage_countries || user?.role === 'admin') && (
          <Link to="/countries" className={styles.actionBtn}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span>إدارة الدول</span>
          </Link>
        )}
        {(userPermissions?.can_manage_doctors || user?.role === 'admin') && (
          <Link to="/doctors" className={styles.actionBtn}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>إدارة الأطباء</span>
          </Link>
        )}
        {(userPermissions?.can_manage_hospitals || user?.role === 'admin') && (
          <Link to="/hospitals" className={styles.actionBtn}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <path d="M9 22V12h6v10" />
              <path d="M12 5v4M10 7h4" />
            </svg>
            <span>إدارة المستشفيات</span>
          </Link>
        )}
        {(userPermissions?.can_manage_settings || user?.role === 'admin') && (
          <Link to="/settings" className={styles.actionBtn}>
            <div className={styles.btnIconWrapper}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span className={styles.newBadge}>جديد</span>
            </div>
            <span>إعدادات النظام</span>
          </Link>
        )}
        {user?.role === 'admin' && (
          <Link to="/keys" className={styles.actionBtn}>
            <div className={styles.btnIconWrapper}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
              <span className={styles.newBadge}>AI</span>
            </div>
            <span>مفاتيح الذكاء الاصطناعي</span>
          </Link>
        )}
      </div>

      {/* Main Content */}
      <main className={styles.mainContent}>
        {/* Leaves Table */}
        <div className={styles.tableCard}>
          <h2>📋 سجل الإجازات المرضية</h2>

          {initialLoading ? (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>جاري التحميل...</p>
            </div>
          ) : error ? (
            <div className={styles.error}>
              <span>⚠️</span>
              <p>{error}</p>
            </div>
          ) : leaves.length === 0 && !debouncedSearch ? (
            <div className={styles.empty}>
              <span>📭</span>
              <p>لا توجد إجازات مسجلة</p>
              <Link to="/sl-form" className={styles.addBtn}>
                إضافة إجازة جديدة
              </Link>
            </div>
          ) : (
            <>
              {/* Search and Pagination Controls */}
              <div className={styles.controlsSection}>
                <div className={styles.searchBox}>
                  <input
                    type="text"
                    placeholder="ابحث عن إجازة بالاسم، رقم الهوية، رقم الخدمة، الطبيب، المستشفى..."
                    value={searchTerm}
                    onChange={handleSearch}
                    className={styles.searchInput}
                  />
                  <span className={`${styles.searchIcon} ${loading ? styles.searchIconLoading : ''}`}>
                    {loading ? '⏳' : '🔍'}
                  </span>
                </div>

                <div className={styles.paginationInfo}>
                  <span>إجمالي النتائج: {pagination.total}</span>
                  <span>صفحة {pagination.page} من {pagination.totalPages}</span>
                </div>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>رقم الخدمة</th>
                      <th>الاسم</th>
                      <th>رقم الهوية</th>
                      <th>أضافها</th>
                      <th>تاريخ الإضافة</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves && leaves.length > 0 ? (
                      leaves.map((leave, index) => {
                        const createdDate = getLeaveCreatedDate(leave)
                        const rawCreated = leave.createdAt || leave.created_at || leave.issue_date
                        return (
                          <tr key={leave.id}>
                            <td>{index + 1}</td>
                            <td>
                              <span className={styles.badge}>{leave.service_num}</span>
                            </td>
                            <td>
                              <div className={styles.nameCell}>
                                <strong>{leave.name_ar}</strong>
                                <small>{leave.name_en}</small>
                              </div>
                            </td>
                            <td>{leave.national_id}</td>
                            <td>
                              <span className={styles.userBadge}>
                                {leave.creator?.name || leave.created_by || 'نظام'}
                              </span>
                            </td>
                            <td>
                              <span className={styles.dateCell}>
                                {createdDate
                                  ? createdDate.toLocaleDateString('ar-EG', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit'
                                  })
                                  : (rawCreated || '-')}
                              </span>
                            </td>
                            <td>
                              <div className={styles.actionButtons}>
                                <button
                                  onClick={() => handleDownloadPDF(leave)}
                                  className={styles.downloadBtn}
                                  title="تحميل PDF"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                  <span>تحميل</span>
                                </button>
                                <button
                                  onClick={() => handleSendWhatsApp(leave)}
                                  className={styles.whatsappBtn}
                                  disabled={sendingWaId === leave.id}
                                  title="إرسال عبر واتساب"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.695.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                  </svg>
                                  <span>{sendingWaId === leave.id ? '...' : 'واتساب'}</span>
                                </button>
                                {(userPermissions?.can_edit_leaves || user?.name === 'simo') && (
                                  <button
                                    onClick={() => handleEdit(leave)}
                                    className={styles.editBtn}
                                    title="تعديل"
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                    <span>تعديل</span>
                                  </button>
                                )}
                                {(userPermissions?.can_delete_leaves || user?.name === 'simo') && (
                                  <button
                                    onClick={() => handleDelete(leave)}
                                    className={styles.deleteBtn}
                                    title="حذف"
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                      <line x1="10" y1="11" x2="10" y2="17" />
                                      <line x1="14" y1="11" x2="14" y2="17" />
                                    </svg>
                                    <span>حذف</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan="7" className={styles.noResultsCell}>
                          <div className={styles.noResultsContent}>
                            <div className={styles.noResultsIcon}>
                              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.35-4.35" />
                              </svg>
                            </div>
                            <div className={styles.noResultsText}>
                              <h3>لا توجد نتائج</h3>
                              <p>
                                {searchTerm
                                  ? `لم يتم العثور على نتائج لبحثك عن "${searchTerm}"`
                                  : 'لا توجد سجلات في النظام'
                                }
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className={styles.paginationControls}>
                  <button
                    onClick={handleNextPage}
                    disabled={!pagination.hasNext}
                    className={`${styles.paginationBtn} ${!pagination.hasNext ? styles.disabled : ''}`}
                  >
                    التالي
                  </button>

                  <div className={styles.pageNumbers}>
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      let pageNum
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1
                      } else if (pagination.page >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i
                      } else {
                        pageNum = pagination.page - 2 + i
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`${styles.pageBtn} ${pagination.page === pageNum ? styles.active : ''}`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                  </div>


                  <button
                    onClick={handlePrevPage}
                    disabled={!pagination.hasPrev}
                    className={`${styles.paginationBtn} ${!pagination.hasPrev ? styles.disabled : ''}`}
                  >
                    السابق
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* PDF Modal */}
      {showPdfModal && selectedLeave && (
        <SickLeavePDFOriginal
          data={selectedLeave}
          onClose={() => setShowPdfModal(false)}
        />
      )}

      {/* Welcome Popup - يظهر كل 5 دقائق للمستخدمين غير simo */}
      <WelcomePopup />
    </div>
  )
}

export default Dashboard

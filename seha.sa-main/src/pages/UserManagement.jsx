import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './UserManagement.module.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

function UserManagement() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    permissions: {
      can_view_leaves: true,
      can_create_leaves: false,
      can_edit_leaves: false,
      can_delete_leaves: false,
      can_view_users: false,
      can_create_users: false,
      can_edit_users: false,
      can_delete_users: false,
      can_manage_media: false,
      can_manage_countries: false,
      can_manage_doctors: false,
      can_manage_hospitals: false,
      can_manage_settings: false
    }
  })

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
  const [userPermissions, setUserPermissions] = useState(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      console.log('🔍 Fetching users from:', `${API_BASE_URL}/users`)
      console.log('🔑 Token:', token ? 'موجود' : 'غير موجود')

      const response = await fetch(`${API_BASE_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      console.log('📊 Response:', data)
      console.log('✅ Response OK:', response.ok)

      if (response.ok && data.success) {
        console.log('👥 عدد المستخدمين من API:', data.data?.length || 0)
        // تصفية المستخدم simo
        const filteredUsers = data.data.filter(user => user.email !== 'simo@seha.sa')
        console.log('👥 عدد المستخدمين بعد التصفية:', filteredUsers.length)
        setUsers(filteredUsers)

        // Get current user permissions
        const currentUserData = data.data.find(u => u.email === currentUser.email)
        if (currentUserData && currentUserData.permissions) {
          setUserPermissions(currentUserData.permissions)
          console.log('🔐 صلاحيات المستخدم:', currentUserData.permissions)
        }
      } else {
        console.error('❌ خطأ في الاستجابة:', data.message)
        window.showToast?.(data.message || 'فشل في جلب المستخدمين', 'error')
      }
    } catch (error) {
      console.error('❌ Error fetching users:', error)
      window.showToast?.('فشل في جلب المستخدمين', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      const token = localStorage.getItem('token')
      const url = editingUser
        ? `${API_BASE_URL}/users/${editingUser.id}`
        : `${API_BASE_URL}/users`

      const method = editingUser ? 'PUT' : 'POST'

      console.log('📤 Submitting to:', url)
      console.log('📝 Method:', method)
      console.log('📋 Data:', formData)

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      console.log('📊 Submit Response:', data)

      if (response.ok && data.success) {
        window.showToast?.(
          editingUser ? 'تم تحديث المستخدم بنجاح' : 'تم إضافة المستخدم بنجاح',
          'success'
        )
        setShowModal(false)
        resetForm()
        fetchUsers()
      } else {
        console.error('❌ خطأ:', data.message)
        window.showToast?.(data.message || 'فشلت العملية', 'error')
      }
    } catch (error) {
      console.error('❌ Error:', error)
      window.showToast?.('حدث خطأ', 'error')
    }
  }

  const handleDelete = async (userId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        window.showToast?.('تم حذف المستخدم بنجاح', 'success')
        fetchUsers()
      }
    } catch (error) {
      console.error('Error:', error)
      window.showToast?.('فشل في حذف المستخدم', 'error')
    }
  }

  const openAddModal = () => {
    resetForm()
    setEditingUser(null)
    setShowModal(true)
  }

  const openEditModal = (user) => {
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      permissions: user.permissions || {
        can_view_leaves: true,
        can_create_leaves: false,
        can_edit_leaves: false,
        can_delete_leaves: false,
        can_view_users: false,
        can_create_users: false,
        can_edit_users: false,
        can_delete_users: false,
        can_manage_media: false,
        can_manage_countries: true,
        can_manage_doctors: false,
        can_manage_hospitals: false,
        can_manage_settings: false
      }
    })
    setEditingUser(user)
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'user',
      permissions: {
        can_view_leaves: true,
        can_create_leaves: false,
        can_edit_leaves: false,
        can_delete_leaves: false,
        can_view_users: false,
        can_create_users: false,
        can_edit_users: false,
        can_delete_users: false,
        can_manage_media: false,
        can_manage_countries: true,
        can_manage_doctors: false,
        can_manage_hospitals: false,
        can_manage_settings: false
      }
    })
  }

  const handlePermissionChange = (permission) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: !prev.permissions[permission]
      }
    }))
  }

  const handleRoleChange = (role) => {
    const allPermissions = {
      can_view_leaves: true,
      can_create_leaves: true,
      can_edit_leaves: true,
      can_delete_leaves: true,
      can_view_users: true,
      can_create_users: true,
      can_edit_users: true,
      can_delete_users: true,
      can_manage_media: true,
      can_manage_countries: true,
      can_manage_doctors: true,
      can_manage_hospitals: true,
      can_manage_settings: true
    }

    const userPermissions = {
      can_view_leaves: true,
      can_create_leaves: false,
      can_edit_leaves: false,
      can_delete_leaves: false,
      can_view_users: false,
      can_create_users: false,
      can_edit_users: false,
      can_delete_users: false,
      can_manage_media: false,
      can_manage_countries: true,
      can_manage_doctors: false,
      can_manage_hospitals: false,
      can_manage_settings: false
    }

    setFormData(prev => ({
      ...prev,
      role,
      permissions: role === 'admin' ? allPermissions : userPermissions
    }))
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>إدارة المستخدمين</h1>
        {userPermissions?.can_create_users && (
          <button className={styles.addBtn} onClick={openAddModal}>
            ➕ إضافة مستخدم جديد
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.loading}>جاري التحميل...</div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>البريد الإلكتروني</th>
                <th>الصلاحية</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`${styles.badge} ${styles[user.role]}`}>
                      {user.role === 'admin' ? 'مدير' : 'مستخدم'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      {userPermissions?.can_edit_users && (
                        <button
                          className={styles.editBtn}
                          onClick={() => openEditModal(user)}
                        >
                          ✏️ تعديل
                        </button>
                      )}
                      {userPermissions?.can_delete_users && (
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDelete(user.id)}
                        >
                          🗑️ حذف
                        </button>
                      )}
                      {!userPermissions?.can_edit_users && !userPermissions?.can_delete_users && (
                        <span style={{ color: '#64748b', fontSize: '0.875rem' }}>لا توجد صلاحيات</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2>{editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label>الاسم</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>البريد الإلكتروني</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label>كلمة المرور {editingUser && '(اتركها فارغة إذا لم ترد التغيير)'}</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                />
              </div>

              <div className={styles.formGroup}>
                <label>الصلاحية</label>
                <select
                  value={formData.role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                >
                  <option value="user">مستخدم</option>
                  <option value="admin">مدير</option>
                </select>
              </div>

              {/* رمز الإحالة — يُسنَد مرة واحدة عند الإنشاء ولا يتغيّر بعدها،
                  فلا يظهر عند التعديل. بدونه تبقى الإحالة بلا مُحيل. */}
              {!editingUser && (
                <div className={styles.formGroup}>
                  <label>رمز الإحالة (اختياري)</label>
                  <input
                    type="text"
                    value={formData.referral_code || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      referral_code: e.target.value.trim().toUpperCase(),
                    })}
                    placeholder="إن وصل هذا العميل عبر زميل، أدخل رمزه هنا"
                  />
                </div>
              )}

              {/* Permissions Section */}
              <div className={styles.permissionsSection}>
                <h3>الصلاحيات التفصيلية</h3>
                {!userPermissions?.can_edit_users && (
                  <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    ⚠️ ليس لديك صلاحية لتعديل الصلاحيات
                  </p>
                )}

                <div className={styles.permissionsGrid}>
                  <div className={styles.permissionCategory}>
                    <h4>📋 إدارة الإجازات</h4>
                    <label className={styles.permissionItem}>
                      <input
                        type="checkbox"
                        checked={formData.permissions.can_view_leaves}
                        onChange={() => handlePermissionChange('can_view_leaves')}
                        disabled={!userPermissions?.can_edit_users}
                      />
                      <span>عرض الإجازات</span>
                    </label>
                    <label className={styles.permissionItem}>
                      <input
                        type="checkbox"
                        checked={formData.permissions.can_create_leaves}
                        onChange={() => handlePermissionChange('can_create_leaves')}
                        disabled={!userPermissions?.can_edit_users}
                      />
                      <span>إنشاء إجازة</span>
                    </label>
                    <label className={styles.permissionItem}>
                      <input
                        type="checkbox"
                        checked={formData.permissions.can_edit_leaves}
                        onChange={() => handlePermissionChange('can_edit_leaves')}
                        disabled={!userPermissions?.can_edit_users}
                      />
                      <span>تعديل إجازة</span>
                    </label>
                    <label className={styles.permissionItem}>
                      <input
                        type="checkbox"
                        checked={formData.permissions.can_delete_leaves}
                        onChange={() => handlePermissionChange('can_delete_leaves')}
                        disabled={!userPermissions?.can_edit_users}
                      />
                      <span>حذف إجازة</span>
                    </label>
                  </div>

                  <div className={styles.permissionCategory}>
                    <h4>👥 إدارة المستخدمين</h4>
                    <label className={styles.permissionItem}>
                      <input
                        type="checkbox"
                        checked={formData.permissions.can_view_users}
                        onChange={() => handlePermissionChange('can_view_users')}
                        disabled={!userPermissions?.can_edit_users}
                      />
                      <span>عرض المستخدمين</span>
                    </label>
                    <label className={styles.permissionItem}>
                      <input
                        type="checkbox"
                        checked={formData.permissions.can_create_users}
                        onChange={() => handlePermissionChange('can_create_users')}
                        disabled={!userPermissions?.can_edit_users}
                      />
                      <span>إضافة مستخدم</span>
                    </label>
                    <label className={styles.permissionItem}>
                      <input
                        type="checkbox"
                        checked={formData.permissions.can_edit_users}
                        onChange={() => handlePermissionChange('can_edit_users')}
                        disabled={!userPermissions?.can_edit_users}
                      />
                      <span>تعديل مستخدم</span>
                    </label>
                    <label className={styles.permissionItem}>
                      <input
                        type="checkbox"
                        checked={formData.permissions.can_delete_users}
                        disabled={!userPermissions?.can_edit_users}
                        onChange={() => handlePermissionChange('can_delete_users')}
                      />
                      <span>حذف مستخدم</span>
                    </label>
                    <div className={styles.permissionCategory}>
                      <h4>🖼️ إدارة الوسائط</h4>
                      <label className={styles.permissionItem}>
                        <input
                          type="checkbox"
                          checked={formData.permissions.can_manage_media}
                          onChange={() => handlePermissionChange('can_manage_media')}
                          disabled={!userPermissions?.can_edit_users}
                        />
                        <span>إدارة الصور والملفات</span>
                      </label>
                    </div>
                    <div className={styles.permissionCategory}>
                      <h4>🌍 إدارة الدول</h4>
                      <label className={styles.permissionItem}>
                        <input
                          type="checkbox"
                          checked={formData.permissions.can_manage_countries}
                          onChange={() => handlePermissionChange('can_manage_countries')}
                          disabled={!userPermissions?.can_edit_users}
                        />
                        <span>إضافة وتعديل الدول</span>
                      </label>
                    </div>
                    <div className={styles.permissionCategory}>
                      <h4>🥼 إدارة الأطباء</h4>
                      <label className={styles.permissionItem}>
                        <input
                          type="checkbox"
                          checked={formData.permissions.can_manage_doctors}
                          onChange={() => handlePermissionChange('can_manage_doctors')}
                          disabled={!userPermissions?.can_edit_users}
                        />
                        <span>إضافة وتعديل الأطباء</span>
                      </label>
                    </div>
                    <div className={styles.permissionCategory}>
                      <h4>🏥 إدارة المستشفيات</h4>
                      <label className={styles.permissionItem}>
                        <input
                          type="checkbox"
                          checked={formData.permissions.can_manage_hospitals}
                          onChange={() => handlePermissionChange('can_manage_hospitals')}
                          disabled={!userPermissions?.can_edit_users}
                        />
                        <span>إضافة وتعديل المستشفيات</span>
                      </label>
                    </div>
                    <div className={styles.permissionCategory}>
                      <h4>⚙️ إدارة الإعدادات</h4>
                      <label className={styles.permissionItem}>
                        <input
                          type="checkbox"
                          checked={formData.permissions.can_manage_settings}
                          onChange={() => handlePermissionChange('can_manage_settings')}
                          disabled={!userPermissions?.can_edit_users}
                        />
                        <span>إدارة إعدادات النظام</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.modalActions}>
                <button type="submit" className={styles.saveBtn}>
                  💾 حفظ
                </button>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowModal(false)}
                >
                  ✖ إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagement

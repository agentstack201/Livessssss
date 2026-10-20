import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import RoyalTribute, { TributeSky } from '../components/RoyalTribute'
import { loadTribute } from '../config/loginTribute'
import styles from './Login.module.css'

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const API_LOGIN = import.meta.env.VITE_API_LOGIN || '/login'
const LOGIN_URL = `${API_BASE_URL}${API_LOGIN}`

function Login() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tribute, setTribute] = useState(null)

  // التكريم يظهر فقط إذا فعّله المشرف من «إدارة التكريم» في لوحة التحكم
  useEffect(() => {
    let alive = true
    const ctrl = new AbortController()
    loadTribute({ signal: ctrl.signal }).then(t => {
      if (alive) setTribute(t)
    })
    return () => {
      alive = false
      ctrl.abort()
    }
  }, [])
  const showTribute = Boolean(tribute?.enabled)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      })

      const data = await response.json()

      if (response.ok && data.status_code === 200) {
        // حفظ Token و User info
        localStorage.setItem('token', data.data.token)
        localStorage.setItem('user', JSON.stringify(data.data.user))
        
        // إشعار نجاح
        window.showToast?.(`مرحباً ${data.data.user.name || 'بك'}! تم تسجيل الدخول بنجاح`, 'success')
        
        // إعادة التوجيه لصفحة Dashboard
        setTimeout(() => navigate('/dashboard'), 500)
      } else {
        setError(data.message || 'خطأ في تسجيل الدخول')
        window.showToast?.(data.message || 'خطأ في تسجيل الدخول', 'error')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('حدث خطأ في الاتصال بالخادم')
      window.showToast?.('حدث خطأ في الاتصال بالخادم', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${styles.loginContainer} ${showTribute ? styles.withTribute : ''}`}>
      {showTribute && tribute.effects.stars && <TributeSky />}
      {showTribute && <RoyalTribute config={tribute} />}

      {/* Logo Section */}
      <div className={styles.logoSection}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🏔️</span>
            <span className={styles.logoText}>الجبل</span>
          </div>
        </a>
        <p className={styles.logoTagline}>نظام إدارة الإجازات المرضية</p>
      </div>

      {/* Login Form */}
      <div className={styles.loginBox}>
        <h1 className={styles.title}>تسجيل الدخول</h1>
        <p className={styles.subtitle}>مرحباً بك في منصة صحة</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Email */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="email">
              البريد الإلكتروني
            </label>
            <input
              className={styles.input}
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="admin@seha.sa"
              required
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="password">
              كلمة المرور
            </label>
            <input
              className={styles.input}
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className={styles.errorBox}>
              <span className={styles.errorIcon}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className={styles.spinner}></span>
                جاري تسجيل الدخول...
              </>
            ) : (
              'تسجيل الدخول'
            )}
          </button>
        </form>

        {/* Info */}
        <div className={styles.info}>
          <p>🔒 جميع البيانات محمية ومشفرة</p>
        </div>
      </div>
    </div>
  )
}

export default Login

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  // تحقق من تسجيل الدخول
  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    if (token && userData) {
      setIsLoggedIn(true)
      setUser(JSON.parse(userData))
    }
  }, [])

  const closeMenu = () => setIsMenuOpen(false)

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setIsLoggedIn(false)
    setUser(null)
    closeMenu()
    navigate('/')
  }

  // انميشن النزول مع الارتجاج
  const headerVariants = {
    hidden: {
      y: -100,
      opacity: 0
    },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 200,
        damping: 15,
        duration: 0.8
      }
    }
  }

  return (
    <motion.header
      className="navbar"
      initial="hidden"
      animate="visible"
      variants={headerVariants}
    >
      <div className="container">
        <div className="logo-wrapper">
          <a href="https://www.seha.sa/#/">
            <img src="/seha-logo.svg" alt="Seha Logo" className="logo" />
          </a>
        </div>

        <div className={`nav-wrapper ${isMenuOpen ? 'active' : ''}`}>
          <nav>
            <ul className="nav-links">
              <li>
                <a href="https://www.seha.sa/#/" onClick={closeMenu}>الرئيسية</a>
              </li>
              <li>
                <a href="https://www.seha.sa/#/services" onClick={closeMenu}>الخدمات</a>
              </li>
              <li>
                <a href="https://www.seha.sa/#/sehaplus" onClick={closeMenu}>صحة بلس</a>
              </li>
              <li>
                <Link to="/inquiries/slenquiry" className="query active" data-discover="true" onClick={closeMenu}>الاستعلامات</Link>
              </li>
              <li>
                <a href="https://www.seha.sa/#/faq" onClick={closeMenu}>الأسئلة الشائعة</a>
              </li>
              <li>
                <a href="https://www.seha.sa/#/ContactUs" onClick={closeMenu}>تواصل معنا</a>
              </li>
            </ul>
          </nav>

          <div className="auth-links">
            {isLoggedIn ? (
              <>
                <span className="user-name">
                  مرحباً، {user?.name || 'المستخدم'}
                </span>
                <button
                  onClick={handleLogout}
                  className="btn login"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ marginLeft: '5px' }}
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>تسجيل الخروج</span>
                </button>
              </>
            ) : (
              <>
                <a href="https://www.seha.sa/#/account/signup" className="nav-link" onClick={closeMenu}>
                  <p>إنشاء حساب</p>
                </a>
                <a href="https://www.seha.sa/#/account/login" className="login nav-link" onClick={closeMenu}>
                  <svg
                    width="10"
                    height="12"
                    viewBox="0 0 12.914 15.067"
                  >
                    <path
                      fill="#fff"
                      d="M10.1,6.592a3.637,3.637,0,0,1,.752.319,3.306,3.306,0,0,1,.748.614,3.956,3.956,0,0,1,.668.971,6.094,6.094,0,0,1,.462,1.446,9.776,9.776,0,0,1,.185,1.988,3.17,3.17,0,0,1-.841,2.216,2.647,2.647,0,0,1-2.026.921H2.867A2.647,2.647,0,0,1,.84,14.146,3.168,3.168,0,0,1,0,11.931,9.772,9.772,0,0,1,.185,9.942,6.1,6.1,0,0,1,.647,8.5a3.954,3.954,0,0,1,.668-.971,3.306,3.306,0,0,1,.748-.614,3.637,3.637,0,0,1,.752-.319,4.265,4.265,0,0,1-.324-3.956,4.258,4.258,0,0,1,2.3-2.3,4.259,4.259,0,0,1,3.338,0,4.262,4.262,0,0,1,2.3,2.3A4.267,4.267,0,0,1,10.1,6.592ZM6.457,1.076a3.11,3.11,0,0,0-2.283.946A3.112,3.112,0,0,0,3.228,4.3a3.107,3.107,0,0,0,.946,2.283,3.114,3.114,0,0,0,2.283.946A3.108,3.108,0,0,0,8.74,6.587,3.111,3.111,0,0,0,9.686,4.3,3.111,3.111,0,0,0,8.74,2.022,3.11,3.11,0,0,0,6.457,1.076Zm3.59,12.914a1.623,1.623,0,0,0,1.265-.6,2.141,2.141,0,0,0,.526-1.459,6.43,6.43,0,0,0-.66-3.17,2.205,2.205,0,0,0-1.9-1.219A4.158,4.158,0,0,1,6.457,8.609,4.158,4.158,0,0,1,3.632,7.542a2.206,2.206,0,0,0-1.9,1.219,6.431,6.431,0,0,0-.66,3.17A2.139,2.139,0,0,0,1.6,13.389a1.626,1.626,0,0,0,1.265.6h7.18Z"
                    />
                  </svg>
                  <p>تسجيل الدخول</p>
                </a>
              </>
            )}
          </div>
        </div>

        {/* الأسطر الثلاثة تتحول إلى زر X عند فتح القائمة (الخلفية تُبدَّل في CSS) */}
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={isMenuOpen ? 'true' : 'false'}
          aria-label={isMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        />
      </div>
    </motion.header>
  )
}

export default Header

import { useState, useEffect } from 'react'
import styles from './WelcomePopup.module.css'

function WelcomePopup() {
  const [show, setShow] = useState(false)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    // Check if user is simo
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (user.email === 'simo@seha.sa') {
      return // Don't show for simo
    }

    setUserName(user.name || 'يا شحم')

    // Show popup every 2 minutes
    const showPopup = () => {
      setShow(true)
      setTimeout(() => setShow(false), 8000) // Hide after 8 seconds
    }

    // Show immediately on mount
    setTimeout(showPopup, 2000)

    // Then show every 2 minutes
    const interval = setInterval(showPopup, 2 * 60 * 1000) // 2 minutes
    
    // ملاحظة: لتعطيل النافذة المنبثقة، علق السطرين التاليين:
    // setTimeout(showPopup, 2000)
    // const interval = setInterval(showPopup, 2 * 60 * 1000)

    return () => clearInterval(interval)
  }, [])

  if (!show) return null

  return (
    <div className={styles.popupOverlay}>
      <div className={styles.popupContainer}>
        {/* Animated Background */}
        <div className={styles.animatedBg}>
          <div className={styles.circle}></div>
          <div className={styles.circle}></div>
          <div className={styles.circle}></div>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Animated Emoji */}
          <div className={styles.emojiContainer}>
            <span className={styles.emoji}>🤣</span>
            <span className={styles.emojiShadow}>🤣</span>
          </div>

          {/* Text */}
          <h1 className={styles.title}>
            مرحباً يا شحم! 
            <span className={styles.sparkle}>✨</span>
          </h1>
          
          <p className={styles.subtitle}>
            {userName}، ياخي كل دقيقتين نذكرك إنك موجود! 
          </p>

          <div className={styles.funnyMessages}>
            <p className={styles.message}>
              <span className={styles.icon}>😎</span>
              لا تفصلش يا شحم!
            </p>
            <p className={styles.message}>
              <span className={styles.icon}>🎯</span>
              لا تنسى تشرب ماء يا جبل!
            </p>
            <p className={styles.message}>
              <span className={styles.icon}>💪</span>
              شد حيلك والله يعينك!
            </p>
          </div>

          {/* Close Button */}
          <button 
            className={styles.closeBtn}
            onClick={() => setShow(false)}
          >
            <span className={styles.closeBtnText}>يلا هس 😂</span>
            <span className={styles.closeBtnIcon}>✕</span>
          </button>
        </div>

        {/* Floating Elements */}
        <div className={styles.floatingElements}>
          <span className={styles.floatingEmoji} style={{top: '10%', left: '10%'}}>😂</span>
          <span className={styles.floatingEmoji} style={{top: '20%', right: '15%'}}>🤪</span>
          <span className={styles.floatingEmoji} style={{bottom: '15%', left: '15%'}}>😜</span>
          <span className={styles.floatingEmoji} style={{bottom: '20%', right: '10%'}}>🥳</span>
          <span className={styles.floatingEmoji} style={{top: '50%', left: '5%'}}>🎉</span>
          <span className={styles.floatingEmoji} style={{top: '60%', right: '8%'}}>🎊</span>
        </div>
      </div>
    </div>
  )
}

export default WelcomePopup

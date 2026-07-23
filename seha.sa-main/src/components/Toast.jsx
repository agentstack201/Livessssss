import { useEffect } from 'react'
import styles from './Toast.module.css'

function Toast({ message, type = 'info', onClose, duration = 3000 }) {
  useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅'
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      case 'info':
      default:
        return 'ℹ️'
    }
  }

  return (
    <div className={`${styles.toast} ${styles[type]}`}>
      <span className={styles.icon}>{getIcon()}</span>
      <span className={styles.message}>{message}</span>
      <button className={styles.closeBtn} onClick={onClose}>
        ✖
      </button>
    </div>
  )
}

export default Toast

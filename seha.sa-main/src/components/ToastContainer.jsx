import { useState, useCallback } from 'react'
import Toast from './Toast'
import styles from './ToastContainer.module.css'

let toastId = 0

function ToastContainer() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = toastId++
    setToasts(prev => [...prev, { id, message, type, duration }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  // Expose addToast globally
  if (typeof window !== 'undefined') {
    window.showToast = addToast
  }

  return (
    <div className={styles.container}>
      {toasts.map((toast, index) => (
        <div 
          key={toast.id} 
          className={styles.toastWrapper}
          style={{ bottom: `${20 + index * 80}px` }}
        >
          <Toast
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </div>
  )
}

export default ToastContainer

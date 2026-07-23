import { Navigate } from 'react-router-dom'

// Protected Route Component
// يحمي الصفحات من الوصول بدون تسجيل دخول
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token')
  
  // إذا لم يكن هناك token، إعادة التوجيه لصفحة Login
  if (!token) {
    return <Navigate to="/login" replace />
  }

  // إذا كان هناك token، عرض الصفحة المطلوبة
  return children
}

export default ProtectedRoute

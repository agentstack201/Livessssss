import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ClipLoader } from 'react-spinners'
import { calcWaitingPeriod } from '../components/CompanionVisitPDFOriginal'

// API Configuration from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const API_SICK_LEAVES = import.meta.env.VITE_API_SICK_LEAVES || '/sick-leaves'
const API_URL = `${API_BASE_URL}${API_SICK_LEAVES}`

function SickLeaveInquiry() {
  const [serviceNum, setServiceNum] = useState('')
  const [nationalID, setNationalID] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [fieldError, setFieldError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const performSearch = async (sNum, nId) => {
    setLoading(true)
    setFieldError(null)
    setError(null)

    const url = `${API_URL}?service_num=${sNum}&national_id=${nId}`

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()

      if (data.length > 0) {
        setResult(data[0])
        setFieldError(null)
        setError(null)
      } else {
        setError('لا يوجد نتائج')
      }
      setSearched(true)
    } catch (err) {
      console.error(err)
      setError('لا يوجد نتائج')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // 1. Try extracting from standard search query
    let params = new URLSearchParams(window.location.search)
    let sNum = params.get('service_num')
    let nId = params.get('national_id')

    // 2. If not found, try extracting from hash query (e.g. /#/inquiries/slenquiry?service_num=...)
    if (!sNum || !nId) {
      const hash = window.location.hash
      const searchIndex = hash.indexOf('?')
      if (searchIndex !== -1) {
        const hashParams = new URLSearchParams(hash.substring(searchIndex))
        sNum = sNum || hashParams.get('service_num')
        nId = nId || hashParams.get('national_id')
      }
    }

    if (sNum && nId) {
      setServiceNum(sNum)
      setNationalID(nId)
      performSearch(sNum, nId)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (searched) {
      // إعادة تعيين
      setServiceNum('')
      setNationalID('')
      setSearched(false)
      setResult(null)
      setError(null)
      setFieldError(null)
      return
    }

    if (!serviceNum || serviceNum.trim() === '') {
      setFieldError('فضلا اكتب الرمز')
      return
    }

    if (nationalID.length < 10) {
      setFieldError('رقم الهوية خاطئ')
      return
    }

    await performSearch(serviceNum, nationalID)
  }

  return (
    <div className="sl-container">
      <div>
        <h1 className="title">الإجازات المرضية</h1>
        <p>خدمة الاستعلام عن الإجازات المرضية تتيح لك الاستعلام عن حالة طلبك للإجازة ويمكنك طباعتها عن طريق تطبيق صحتي</p>
        <p></p>
      </div>

      <div className="form-container">
        <form action="" className="sl-inquery-form" onSubmit={handleSubmit}>
          {fieldError && <div className="error">{fieldError}</div>}

          <input
            type="text"
            className="service-num"
            value={serviceNum}
            onChange={(e) => {
              setServiceNum(e.target.value)
              setFieldError(null)
            }}
            placeholder="رمز الخدمة"
            autoComplete="off"
          />

          <input
            type="text"
            className="national-num"
            placeholder="رقم الهوية / الإقامة"
            value={nationalID}
            onChange={(e) => {
              setNationalID(e.target.value)
              setFieldError(null)
            }}
            maxLength="10"
            autoComplete="off"
          />

          {error && <div className="error">{error}</div>}

          {result && result.document_type === 'companion_visit' && (
            <div className="row">
              <div className="item">
                <span>اسم المرافق: </span>{result.name_ar}
              </div>
              <div className="item">
                <span>تاريخ اصدار التقرير: </span>
                {result.issue_date}
              </div>
              <div className="item">
                <span>تاريخ / وقت الدخول: </span>
                {[result.admission_date_en, result.admission_time].filter(Boolean).join(' - ')}
              </div>
              <div className="item">
                <span>تاريخ / وقت الخروج: </span>
                {[result.discharge_date_en, result.discharge_time].filter(Boolean).join(' - ')}
              </div>
              <div className="item">
                <span>فترة الانتظار: </span>
                {calcWaitingPeriod(
                  result.admission_date_en, result.admission_time,
                  result.discharge_date_en, result.discharge_time
                ).ar}
              </div>
              <div className="item">
                <span>اسم الممارس الصحي: </span>{result.physician_name_ar}
              </div>
              <div className="item">
                <span>المسمى الوظيفي: </span>{result.position_ar}
              </div>
              <div className="item">
                <span>نوع الزيارة: </span>{result.visit_type_ar}
              </div>
            </div>
          )}

          {result && result.document_type !== 'companion_visit' && (
            <div className="row">
              <div className="item">
                <span>الاسم: </span>{result.name_ar}
              </div>
              <div className="item">
                <span>تاريخ اصدار تقرير الاجازة: </span>
                {result.issue_date}
              </div>
              <div className="item">
                <span>تبدأ من: </span>{result.admission_date_en}
              </div>
              <div className="item">
                <span>وحتى: </span>{result.discharge_date_en}
              </div>
              <div className="item">
                <span>المدة بالأيام: </span>{result.leave_days}
              </div>
              <div className="item">
                <span>اسم الطبيب: </span>{result.physician_name_ar}
              </div>
              <div className="item">
                <span>المسمى الوظيفي: </span>{result.position_ar}
              </div>
            </div>
          )}

          <button
            type="submit"
            style={loading ? { backgroundColor: '#2c3e77' } : {}}
          >
            {searched ? 'استعلام جديد' : 'استعلام'}
            <ClipLoader
              color="white"
              loading={loading}
              size={10}
              aria-label="Loading Spinner"
              data-testid="loader"
            />
          </button>
        </form>

        <Link to="/" data-discover="true">
          <button className="back-button">رجوع للاستعلامات</button>
        </Link>
      </div>
    </div>
  )
}

export default SickLeaveInquiry

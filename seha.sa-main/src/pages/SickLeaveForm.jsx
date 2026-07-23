import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import styles from './SickLeaveForm.module.css'
import SickLeavePDFOriginal from '../components/SickLeavePDFOriginal'
import MediaPicker from '../components/MediaPicker'

// API Configuration from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const API_SICK_LEAVES = import.meta.env.VITE_API_SICK_LEAVES || '/sick-leaves'
const API_URL = `${API_BASE_URL}${API_SICK_LEAVES}`
const DEFAULT_FOOTER_LOGO = '/images/1.png'
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

// Convert a stored PDF-format report time ("5:30 PM") into an <input type="time">
// value ("17:30"). Returns '' when the value is missing or not parseable so the
// controlled input never receives a value the browser rejects.
function parsePdfReportTime(value) {
  if (!value) return ''
  if (/^\d{2}:\d{2}$/.test(value)) return value
  const m = String(value).match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!m) return ''
  let [, hours, minutes, period] = m
  hours = parseInt(hours, 10)
  if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12
  if (period.toUpperCase() === 'AM' && hours === 12) hours = 0
  return `${hours.toString().padStart(2, '0')}:${minutes}`
}

// Convert a stored PDF-format report date ("Monday, 05 July 2024") into an
// <input type="date"> value ("2024-07-05"). Returns '' when missing/not parseable.
function parsePdfReportDate(value) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const m = String(value).match(/(\w+),\s+(\d+)\s+(\w+)\s+(\d+)/)
  if (!m) return ''
  const monthMap = {
    January: '01', February: '02', March: '03', April: '04',
    May: '05', June: '06', July: '07', August: '08',
    September: '09', October: '10', November: '11', December: '12'
  }
  const [, , day, month, year] = m
  if (!monthMap[month]) return ''
  return `${year}-${monthMap[month]}-${day.padStart(2, '0')}`
}

function SickLeaveForm() {
  // Get token and user from localStorage
  const token = localStorage.getItem('token')
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const userPermissions = user.permissions || {}
  const location = useLocation()
  const { editMode, leaveData } = location.state || {}

  // Check permissions
  const canCreate = userPermissions.can_create_leaves
  const canEdit = userPermissions.can_edit_leaves

  // Form data state
  const [formData, setFormData] = useState({
    id: null,
    serviceNum: '',
    nationalID: '',
    name: '',
    nameArabic: '',
    leaveId: '',
    nationality: 'السعودية', // القيمة الافتراضية المطابقة لقاعدة البيانات
    employer: '',
    physicianPosition: '',
    physicianPositionArabic: '',
    issueDate: '',
    admissionDate: '',
    dischargeDate: '',
    admissionDateAr: '', // التاريخ الهجري للدخول
    dischargeDateAr: '', // التاريخ الهجري للخروج
    startDate: '',
    endDate: '',
    duration: '',
    doctorName: '',
    doctorNameArabic: '',
    hospitalNameArabic: '',
    hospitalNameEnglish: '',
    licenseNumber: '1410845906',
    showLicenseNumber: true,
    reportTime: '',
    reportDate: '',
    footerLogo: ''
  })

  // Search data state
  const [searchData, setSearchData] = useState({
    serviceNum: '',
    nationalID: ''
  })

  // UI states
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState('')
  const [isEditMode, setIsEditMode] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [originalServiceNum, setOriginalServiceNum] = useState('')
  const [originalLeaveId, setOriginalLeaveId] = useState('')
  const [showPdfModal, setShowPdfModal] = useState(false)
  const [pdfData, setPdfData] = useState(null)
  const [logoError, setLogoError] = useState('')
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [serviceNumType, setServiceNumType] = useState('GSL') // PSL or GSL
  const [countries, setCountries] = useState([]) // قائمة الدول من قاعدة البيانات
  const [doctors, setDoctors] = useState([]) // قائمة الأطباء من قاعدة البيانات
  const [hospitals, setHospitals] = useState([]) // قائمة المستشفيات من قاعدة البيانات
  const footerLogoInputRef = useRef(null)

  const canManageDoctors = userPermissions.can_manage_doctors || user.role === 'admin'
  const canManageHospitals = userPermissions.can_manage_hospitals || user.role === 'admin'

  // States for Add Doctor and Add Hospital modals
  const [showAddDoctorModal, setShowAddDoctorModal] = useState(false)
  const [showAddHospitalModal, setShowAddHospitalModal] = useState(false)
  const [showHospitalMediaPicker, setShowHospitalMediaPicker] = useState(false)
  const [newDoctorFormData, setNewDoctorFormData] = useState({
    name_ar: '',
    name_en: '',
    position_ar: '',
    position_en: ''
  })
  const [newHospitalFormData, setNewHospitalFormData] = useState({
    name_ar: '',
    name_en: '',
    license_number: '',
    logo: ''
  })
  const [addDoctorLoading, setAddDoctorLoading] = useState(false)
  const [addHospitalLoading, setAddHospitalLoading] = useState(false)

  const handleAddDoctorSubmit = async (e) => {
    e.preventDefault()
    if (!newDoctorFormData.name_ar || !newDoctorFormData.name_en) {
      window.showToast?.('يرجى ملء اسم الطبيب بالعربية والإنجليزية', 'error')
      return
    }

    setAddDoctorLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/doctors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newDoctorFormData)
      })

      const data = await response.json()
      if (response.ok && data.success) {
        window.showToast?.('تم إضافة الطبيب بنجاح', 'success')
        setShowAddDoctorModal(false)
        setNewDoctorFormData({
          name_ar: '',
          name_en: '',
          position_ar: '',
          position_en: ''
        })
        // Refetch doctors list
        const doctorsRes = await fetch(`${API_BASE_URL}/all-doctors`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const doctorsData = await doctorsRes.json()
        if (doctorsRes.ok && doctorsData.data) {
          setDoctors(doctorsData.data)
        }
        // Automatically select the new doctor in the form
        setFormData(prev => ({
          ...prev,
          doctorNameArabic: data.data.name_ar,
          doctorName: data.data.name_en,
          physicianPositionArabic: data.data.position_ar || prev.physicianPositionArabic,
          physicianPosition: data.data.position_en || prev.physicianPosition
        }))
      } else {
        window.showToast?.(data.message || 'فشل إضافة الطبيب', 'error')
      }
    } catch (error) {
      console.error('Error adding doctor:', error)
      window.showToast?.('حدث خطأ أثناء إضافة الطبيب', 'error')
    } finally {
      setAddDoctorLoading(false)
    }
  }

  const handleAddHospitalSubmit = async (e) => {
    e.preventDefault()
    if (!newHospitalFormData.name_ar || !newHospitalFormData.name_en) {
      window.showToast?.('يرجى ملء اسم المستشفى بالعربية والإنجليزية', 'error')
      return
    }

    setAddHospitalLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/hospitals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newHospitalFormData)
      })

      const data = await response.json()
      if (response.ok && data.success) {
        window.showToast?.('تم إضافة المستشفى بنجاح', 'success')
        setShowAddHospitalModal(false)
        setNewHospitalFormData({
          name_ar: '',
          name_en: '',
          license_number: '',
          logo: ''
        })
        // Refetch hospitals list
        const hospitalsRes = await fetch(`${API_BASE_URL}/all-hospitals`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const hospitalsData = await hospitalsRes.json()
        if (hospitalsRes.ok && hospitalsData.data) {
          setHospitals(hospitalsData.data)
        }
        // Automatically select the new hospital in the form
        const logoUrl = data.data.logo
          ? (data.data.logo.startsWith('http') || data.data.logo.startsWith('data:') ? data.data.logo : `${API_BASE_URL}${data.data.logo}`)
          : ''
        setFormData(prev => ({
          ...prev,
          hospitalNameArabic: data.data.name_ar,
          hospitalNameEnglish: data.data.name_en,
          licenseNumber: data.data.license_number || prev.licenseNumber,
          footerLogo: logoUrl || prev.footerLogo
        }))
      } else {
        window.showToast?.(data.message || 'فشل إضافة المستشفى', 'error')
      }
    } catch (error) {
      console.error('Error adding hospital:', error)
      window.showToast?.('حدث خطأ أثناء إضافة المستشفى', 'error')
    } finally {
      setAddHospitalLoading(false)
    }
  }

  // جلب البيانات من قاعدة البيانات عند التحميل
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/all-countries`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        const data = await response.json()
        if (response.ok && data.data) {
          setCountries(data.data)
        }
      } catch (error) {
        console.error('Error fetching countries:', error)
      }
    }

    const fetchDoctors = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/all-doctors`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        const data = await response.json()
        if (response.ok && data.data) {
          setDoctors(data.data)
        }
      } catch (error) {
        console.error('Error fetching doctors:', error)
      }
    }

    const fetchHospitals = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/all-hospitals`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        const data = await response.json()
        if (response.ok && data.data) {
          setHospitals(data.data)
        }
      } catch (error) {
        console.error('Error fetching hospitals:', error)
      }
    }

    fetchCountries()
    fetchDoctors()
    fetchHospitals()
  }, [])

  const checkDoctorAutofill = (fieldName, value) => {
    if (!value) return
    const foundDoctor = doctors.find(doc => 
      (fieldName === 'doctorNameArabic' && doc.name_ar === value) ||
      (fieldName === 'doctorName' && doc.name_en === value)
    )
    if (foundDoctor) {
      setFormData(prev => ({
        ...prev,
        doctorName: foundDoctor.name_en || prev.doctorName,
        doctorNameArabic: foundDoctor.name_ar || prev.doctorNameArabic,
        physicianPosition: foundDoctor.position_en || prev.physicianPosition,
        physicianPositionArabic: foundDoctor.position_ar || prev.physicianPositionArabic
      }))
    }
  }

  const checkHospitalAutofill = (fieldName, value) => {
    if (!value) return
    const foundHospital = hospitals.find(hosp => 
      (fieldName === 'hospitalNameArabic' && hosp.name_ar === value) ||
      (fieldName === 'hospitalNameEnglish' && hosp.name_en === value)
    )
    if (foundHospital) {
      const logoUrl = foundHospital.logo
        ? (foundHospital.logo.startsWith('http') || foundHospital.logo.startsWith('data:') ? foundHospital.logo : `${API_BASE_URL}${foundHospital.logo}`)
        : ''
      setFormData(prev => ({
        ...prev,
        hospitalNameArabic: foundHospital.name_ar || prev.hospitalNameArabic,
        hospitalNameEnglish: foundHospital.name_en || prev.hospitalNameEnglish,
        licenseNumber: foundHospital.license_number || prev.licenseNumber,
        footerLogo: logoUrl || prev.footerLogo
      }))
    }
  }

  // Generate random ID based on type
  const generateId = (type) => {
    if (type === 'PSL') {
      // PSL: PSL + 261 + 8 random digits = 14 chars
      const random = Math.floor(10000000 + Math.random() * 90000000)
      return `PSL261${random}`
    } else {
      // GSL: GSL + 261 + 9 random digits = 15 chars
      const random = Math.floor(100000000 + Math.random() * 900000000)
      return `GSL261${random}`
    }
  }

  // Generate Service Number
  const handleGenerateServiceNum = () => {
    const newId = generateId(serviceNumType)
    setFormData(prev => ({
      ...prev,
      serviceNum: newId,
      leaveId: newId // Make them identical
    }))
  }


  // Load data when coming from Dashboard edit
  useEffect(() => {
    if (editMode && leaveData) {
      // Format dates to YYYY-MM-DD for input fields
      const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        // Guard against unparseable stored dates; toISOString() throws a
        // RangeError on an Invalid Date and would crash the edit form.
        if (isNaN(date.getTime())) return '';
        return date.toISOString().split('T')[0];
      };

      setFormData({
        id: leaveData.id || null,
        serviceNum: leaveData.service_num || '',
        nationalID: leaveData.national_id || '',
        name: leaveData.name_en || '',
        nameArabic: leaveData.name_ar || '',
        leaveId: leaveData.leave_id || '',
        nationality: (() => {
          const rawNat = leaveData.country?.country_name_ar || leaveData.nationality || 'السعودية';
          const mapping = {
            'سعودي': 'السعودية',
            'مصري': 'مصر',
            'سوري': 'سوريا',
            'يمني': 'اليمن',
            'أردني': 'الأردن'
          };
          return mapping[rawNat] || rawNat;
        })(),
        employer: leaveData.employer_ar || leaveData.employer_en || '',
        physicianPosition: leaveData.position_en || '',
        physicianPositionArabic: leaveData.position_ar || '',
        issueDate: formatDate(leaveData.issue_date),
        admissionDate: formatDate(leaveData.admission_date_en),
        dischargeDate: formatDate(leaveData.discharge_date_en),
        admissionDateAr: leaveData.admission_date_ar || '', // الحفاظ على التاريخ الهجري
        dischargeDateAr: leaveData.discharge_date_ar || '', // الحفاظ على التاريخ الهجري
        startDate: formatDate(leaveData.admission_date_en),
        endDate: formatDate(leaveData.discharge_date_en),
        duration: leaveData.leave_days?.toString() || '',
        doctorName: leaveData.physician_name_en || '',
        doctorNameArabic: leaveData.physician_name_ar || '',
        hospitalNameArabic: leaveData.hospital_name_ar || 'مستشفى النور التخصصي',
        hospitalNameEnglish: leaveData.hospital_name_en || 'AL NOOR SPECIALIST HOSPITAL',
        licenseNumber: leaveData.license_number || '1410845906',
        showLicenseNumber: leaveData.show_license_number !== false,
        reportTime: parsePdfReportTime(leaveData.report_time),
        reportDate: parsePdfReportDate(leaveData.report_date),
        footerLogo: leaveData.footer_logo
          ? (leaveData.footer_logo.startsWith('http') || leaveData.footer_logo.startsWith('data:') ? leaveData.footer_logo : `${API_BASE_URL}${leaveData.footer_logo}`)
          : ''
      })
      setIsEditMode(true)
      setOriginalServiceNum(leaveData.service_num || '')
      setOriginalLeaveId(leaveData.leave_id || '')
      setMessage('✏️ وضع التعديل - قم بتعديل البيانات ثم اضغط حفظ')
    }
  }, [editMode, leaveData])

  // حساب المدة تلقائياً عند تحميل المكون أو تغيير التواريخ
  useEffect(() => {
    if (formData.admissionDate) {
      const start = new Date(formData.admissionDate)

      if (!isNaN(start)) {
        if (formData.dischargeDate) {
          // حساب المدة الكاملة إذا كان تاريخ الخروج موجوداً
          const end = new Date(formData.dischargeDate)
          if (!isNaN(end) && start <= end) {
            const diffTime = Math.abs(end - start)
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
            setFormData(prev => ({ ...prev, duration: diffDays.toString() }))
          }
        } else {
          // حساب من تاريخ الدخول إلى اليوم الحالي إذا لم يوجد تاريخ خروج
          const now = new Date()
          const diffTime = Math.abs(now - start)
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
          setFormData(prev => ({ ...prev, duration: diffDays.toString() }))
        }
      }
    }
  }, [formData.admissionDate, formData.dischargeDate])

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target

    // Sync leaveId with serviceNum
    if (name === 'serviceNum') {
      setFormData(prev => ({ ...prev, serviceNum: value, leaveId: value }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }

    // Check for autocomplete autofills
    if (name === 'doctorName' || name === 'doctorNameArabic') {
      checkDoctorAutofill(name, value)
    }
    if (name === 'hospitalNameArabic' || name === 'hospitalNameEnglish') {
      checkHospitalAutofill(name, value)
    }

    // حساب المدة والمزامنة التلقائية للتواريخ
    if (name === 'admissionDate' || name === 'dischargeDate') {
      const admissionDate = name === 'admissionDate' ? value : formData.admissionDate
      const dischargeDate = name === 'dischargeDate' ? value : formData.dischargeDate

      // مزامنة "تبدأ من" مع تاريخ الدخول و "وحتى" مع تاريخ الخروج تلقائياً
      setFormData(prev => ({
        ...prev,
        [name]: value,
        startDate: name === 'admissionDate' ? value : prev.startDate,
        endDate: name === 'dischargeDate' ? value : prev.endDate
      }))

      if (admissionDate) {
        const start = new Date(admissionDate)

        if (!isNaN(start)) {
          if (dischargeDate) {
            const end = new Date(dischargeDate)
            if (!isNaN(end) && start <= end) {
              const diffTime = Math.abs(end - start)
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
              setFormData(prev => ({ ...prev, duration: diffDays.toString() }))
            }
          } else {
            const now = new Date()
            const diffTime = Math.abs(now - start)
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
            setFormData(prev => ({ ...prev, duration: diffDays.toString() }))
          }
        }
      }
    }

    // Clear field error
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }

    // Clear success message
    if (success) {
      setSuccess(false)
      setMessage('')
      setPdfError('')
    }

    // Check if editing mode should be disabled
    if (isEditMode && (name === 'serviceNum' || name === 'leaveId')) {
      if ((name === 'serviceNum' && value !== originalServiceNum) ||
        (name === 'leaveId' && value !== originalLeaveId)) {
        setIsEditMode(false)
        setMessage('تم تغيير رقم الخدمة أو رقم الإجازة - تم التبديل إلى وضع الإنشاء')
      }
    }
  }

  const handleFooterLogoChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setLogoError('الرجاء اختيار ملف صورة صالح')
      event.target.value = ''
      return
    }

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setLogoError('حجم الصورة يجب ألا يتجاوز 5 ميجابايت')
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, footerLogo: reader.result }))
      setLogoError('')
    }
    reader.readAsDataURL(file)
  }

  const handleFooterLogoReset = () => {
    setFormData(prev => ({ ...prev, footerLogo: '' }))
    setLogoError('')
    if (footerLogoInputRef.current) {
      footerLogoInputRef.current.value = ''
    }
  }

  // Handle search field changes
  const handleSearchChange = (e) => {
    const { name, value } = e.target
    setSearchData(prev => ({ ...prev, [name]: value }))
    if (searchError) setSearchError('')
  }

  // Validate form
  const validateForm = () => {
    const newErrors = {}
    const requiredFields = {
      serviceNum: 'رقم الخدمة مطلوب',
      nationalID: 'رقم الهوية مطلوب',
      name: 'الاسم بالإنجليزية مطلوب',
      nameArabic: 'الاسم بالعربية مطلوب',
      leaveId: 'رقم الإجازة مطلوب',
      nationality: 'الجنسية مطلوبة',
      // employer تم جعله اختياري - يمكن تركه فارغاً
      physicianPosition: 'منصب الطبيب بالإنجليزية مطلوب',
      physicianPositionArabic: 'منصب الطبيب بالعربية مطلوب',
      issueDate: 'تاريخ إصدار التقرير مطلوب',
      admissionDate: 'تاريخ الدخول مطلوب',
      dischargeDate: 'تاريخ الخروج مطلوب',
      startDate: 'تاريخ بداية الإجازة مطلوب',
      endDate: 'تاريخ نهاية الإجازة مطلوب',
      // تم إزالة المدة لأنها تحسب تلقائياً
      doctorName: 'اسم الطبيب بالإنجليزية مطلوب',
      doctorNameArabic: 'اسم الطبيب بالعربية مطلوب',
      hospitalNameArabic: 'اسم المستشفى بالعربية مطلوب',
      hospitalNameEnglish: 'اسم المستشفى بالإنجليزية مطلوب'
    }

    // Validation for Leave ID: PSL261+8digits OR GSL261+9digits
    if (formData.leaveId && !/^(PSL261\d{8}|GSL261\d{9})$/.test(formData.leaveId)) {
      newErrors.leaveId = 'رقم الإجازة يجب أن يكون PSL261+8 أرقام أو GSL261+9 أرقام'
    }

    // Validation for Service Number: PSL261+8digits OR GSL261+9digits
    if (formData.serviceNum && !/^(PSL261\d{8}|GSL261\d{9})$/.test(formData.serviceNum)) {
      newErrors.serviceNum = 'رقم الخدمة يجب أن يكون PSL261+8 أرقام أو GSL261+9 أرقام'
    }

    Object.keys(requiredFields).forEach(field => {
      if (!formData[field] || formData[field].toString().trim() === '') {
        newErrors[field] = requiredFields[field]
      }
    })

    // التحقق من أن المدة تم حسابها تلقائياً
    if (!formData.duration || formData.duration === '0') {
      newErrors.duration = 'يرجى تحديد تاريخ الدخول والخروج لحساب المدة'
    }

    // Date validations
    if (formData.admissionDate && formData.dischargeDate) {
      if (new Date(formData.admissionDate) > new Date(formData.dischargeDate)) {
        newErrors.dischargeDate = 'تاريخ الخروج يجب أن يكون بعد تاريخ الدخول'
      }
    }

    if (formData.startDate && formData.endDate) {
      if (new Date(formData.startDate) > new Date(formData.endDate)) {
        newErrors.endDate = 'تاريخ نهاية الإجازة يجب أن يكون بعد تاريخ البداية'
      }
    }

    // تم إزالة التحقق من المدة لأنها تحسب تلقائياً

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return ''

    try {
      // If already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString
      }

      let date
      if (dateString.includes('T')) {
        date = new Date(dateString)
      } else {
        date = new Date(dateString)
      }

      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateString)
        return ''
      }

      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')

      return `${year}-${month}-${day}`
    } catch (error) {
      console.error('Error formatting date:', dateString, error)
      return ''
    }
  }

  // Search for existing sick leave
  const handleSearch = async (e) => {
    e.preventDefault()

    if (!searchData.serviceNum || !searchData.nationalID) {
      setSearchError('يرجى إدخال رقم الخدمة ورقم الهوية للبحث')
      return
    }

    setSearchLoading(true)
    setSearchError('')
    setMessage('')

    try {
      const searchUrl = `${API_URL}?service_num=${searchData.serviceNum}&national_id=${searchData.nationalID}`
      console.log('🔍 Search URL:', searchUrl)
      console.log('🔍 Search Data:', searchData)

      const token = localStorage.getItem('token')
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      console.log('📋 Response:', data)

      if (response.ok && data.length > 0) {
        const record = data[0]
        setFormData({
          id: record.id || null,
          serviceNum: record.service_num || '',
          nationalID: record.national_id || '',
          name: record.name_en || '',
          nameArabic: record.name_ar || '',
          leaveId: record.leave_id || '',
          nationality: record.country?.country_name_ar || record.nationality || 'السعودية',
          employer: record.employer_en || '',
          physicianPosition: record.position_en || '',
          physicianPositionArabic: record.position_ar || '',
          issueDate: formatDate(record.issue_date),
          admissionDate: formatDate(record.admission_date_en),
          dischargeDate: formatDate(record.discharge_date_en),
          startDate: formatDate(record.admission_date_en),
          endDate: formatDate(record.discharge_date_en),
          duration: record.leave_days || '',
          doctorName: record.physician_name_en || '',
          doctorNameArabic: record.physician_name_ar || '',
          hospitalNameArabic: record.hospital_name_ar || '',
          hospitalNameEnglish: record.hospital_name_en || '',
          licenseNumber: record.license_number || '1410845906',
          showLicenseNumber: record.show_license_number !== false,
          footerLogo: record.footer_logo
            ? (record.footer_logo.startsWith('http') || record.footer_logo.startsWith('data:') ? record.footer_logo : `${API_BASE_URL}${record.footer_logo}`)
            : '',
          reportTime: parsePdfReportTime(record.report_time),
          reportDate: parsePdfReportDate(record.report_date)
        })
        setIsEditMode(true)
        setOriginalServiceNum(record.service_num || '')
        setOriginalLeaveId(record.leave_id || '')
        setMessage('تم العثور على السجل وتحميله للتعديل')
        window.showToast?.('تم العثور على السجل وتحميله للتعديل', 'success')
      } else {
        setSearchError('لم يتم العثور على سجل بهذه البيانات')
        setIsEditMode(false)
        window.showToast?.('لم يتم العثور على سجل بهذه البيانات', 'warning')
      }
    } catch (error) {
      console.error(error)
      setSearchError('حدث خطأ أثناء البحث')
      setIsEditMode(false)
      window.showToast?.('حدث خطأ أثناء البحث', 'error')
    } finally {
      setSearchLoading(false)
    }
  }

  // Handle AI text extraction
  const handleAIExtract = async (e) => {
    e.preventDefault()

    if (!aiText.trim()) {
      setAiError('يرجى إدخال معلومات العميل')
      return
    }

    setAiLoading(true)
    setAiError('')
    setMessage('')

    try {
      // استخدام الـ API المحلي
      const response = await fetch(`${API_URL}/ai-extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ clientInfo: aiText })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Sanitize incoming data to ensure no null/undefined values
        const sanitizedData = {};
        Object.keys(data.data).forEach(key => {
          sanitizedData[key] = data.data[key] ?? '';
        });

        // Matching extracted nationality with the database countries list
        let finalNationality = sanitizedData.nationality;
        if (finalNationality && countries.length > 0) {
          const normalizedExtracted = finalNationality.trim().toLowerCase();

          // 1. Try exact match in Arabic or English
          const matchedCountry = countries.find(c =>
            c.country_name_ar === finalNationality ||
            (c.country_name_en && c.country_name_en.toLowerCase() === normalizedExtracted)
          );

          if (matchedCountry) {
            finalNationality = matchedCountry.country_name_ar;
          } else {
            // 2. Try partial match/common variations
            const natMap = {
              'saudi': 'السعودية',
              'saudi arabia': 'السعودية',
              'سعودي': 'السعودية',
              'egypt': 'مصر',
              'egyptian': 'مصري',
              'syria': 'سوريا',
              'syrian': 'سوري',
              'yemen': 'اليمن',
              'yemini': 'يمني'
            };

            if (natMap[normalizedExtracted]) {
              const lookupName = natMap[normalizedExtracted];
              const secondChanceMatch = countries.find(c => c.country_name_ar.includes(lookupName));
              if (secondChanceMatch) finalNationality = secondChanceMatch.country_name_ar;
            }
          }
        }

        // Merge AI data with existing formData
        setFormData(prev => ({
          ...prev,
          ...sanitizedData,
          nationality: finalNationality || prev.nationality,
          // Special handling for dates that might have different names in AI output
          startDate: sanitizedData.startDate || sanitizedData.admissionDate || prev.startDate || '',
          endDate: sanitizedData.endDate || sanitizedData.dischargeDate || prev.endDate || '',
          duration: sanitizedData.duration || prev.duration || '',
        }))
        setMessage('تم استخراج البيانات وملء النموذج بنجاح باستخدام الذكاء الاصطناعي')
        setIsEditMode(false)
        setAiText('')
      } else {
        setAiError(data.error || 'فشل في استخراج البيانات')
      }
    } catch (error) {
      console.error('AI Extract Error:', error)
      setAiError('حدث خطأ أثناء معالجة البيانات بالذكاء الاصطناعي')
    } finally {
      setAiLoading(false)
    }
  }

  // Handle AI textarea change
  const handleAIChange = (e) => {
    setAiText(e.target.value)
    if (aiError) setAiError('')
  }

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      setMessage('يرجى تصحيح الأخطاء في النموذج')
      return
    }

    try {
      const url = API_URL
      const method = isEditMode ? 'PUT' : 'POST'

      // تحويل البيانات من camelCase إلى snake_case للـ Backend
      // العثور على countryId بناءً على الجنسية المختارة
      const selectedCountry = countries.find(c => c.country_name_ar === formData.nationality)
      const countryId = selectedCountry?.id || 1

      const payload = {
        id: formData.id,
        service_num: formData.serviceNum,
        national_id: formData.nationalID,
        leave_id: formData.leaveId,
        admission_date_en: formData.admissionDate,
        discharge_date_en: formData.dischargeDate,
        issue_date: formData.issueDate,
        name_en: formData.name,
        name_ar: formData.nameArabic,
        employer_en: formData.employer,
        employer_ar: formData.employer, // إذا كان نفس الاسم
        physician_name_en: formData.doctorName,
        physician_name_ar: formData.doctorNameArabic,
        position_en: formData.physicianPosition,
        position_ar: formData.physicianPositionArabic,
        nationality: formData.nationality || 'السعودية',
        countryId: countryId,
        hospital_name_en: formData.hospitalNameEnglish,
        hospital_name_ar: formData.hospitalNameArabic,
        license_number: formData.licenseNumber || '1410845906',
        show_license_number: formData.showLicenseNumber,
        report_time: formatTimeForPDF(formData.reportTime),
        report_date: formatDateForPDF(formData.reportDate),
        footer_logo: formData.footerLogo || null
      }

      // Debug: طباعة البيانات المرسلة
      console.log('📤 Payload sent to backend:', {
        report_time: formatTimeForPDF(formData.reportTime),
        report_date: formatDateForPDF(formData.reportDate),
        original_reportTime: formData.reportTime,
        original_reportDate: formData.reportDate,
        isEditMode: isEditMode
      })

      console.log('📋 Complete formData:', formData)

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (response.ok) {
        const successMsg = isEditMode ? 'تم تحديث الإجازة المرضية بنجاح' : 'تم إنشاء الإجازة المرضية بنجاح'
        setMessage(`نجح: ${data.message}`)
        setErrors({})
        setSuccess(true)
        setPdfError('')
        window.showToast?.(successMsg, 'success')
      } else {
        const errorMsg = data.message || data.error || 'فشل في حفظ البيانات'
        setMessage(`خطأ: ${errorMsg}`)
        setSuccess(false)
        window.showToast?.(errorMsg, 'error')
      }
    } catch (error) {
      console.error(error)
      setMessage('حدث خطأ أثناء إرسال النموذج.')
      setSuccess(false)
      window.showToast?.('حدث خطأ أثناء إرسال النموذج', 'error')
    }

    console.log(formData)
  }

  // دالة تحويل التاريخ من YYYY-MM-DD إلى الصيغة المطلوبة في PDF
  const formatDateForPDF = (dateString) => {
    if (!dateString) return null;

    const date = new Date(dateString);
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    const day = date.toLocaleDateString('en-US', { day: '2-digit' });
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const year = date.toLocaleDateString('en-US', { year: 'numeric' });

    return `${weekday}, ${day} ${month} ${year}`;
  };

  // دالة تحويل الوقت من 24h إلى 12h format
  const formatTimeForPDF = (timeString) => {
    if (!timeString) return null;

    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;

    return `${formattedHour}:${minutes} ${ampm}`;
  };

  // Delete sick leave
  const handleDelete = async () => {
    if (!formData.serviceNum || !formData.nationalID) {
      setMessage('يرجى البحث عن السجل أولاً قبل الحذف')
      return
    }

    setDeleteLoading(true)
    setMessage('')

    try {
      const response = await fetch(
        `${API_URL}?service_num=${formData.serviceNum}&national_id=${formData.nationalID}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      )

      const data = await response.json()

      if (response.ok) {
        setMessage(`تم حذف السجل بنجاح: ${data.message}`)
        window.showToast?.('تم حذف الإجازة المرضية بنجاح', 'success')
        // Reset all form data
        setFormData({
          id: null,
          serviceNum: '',
          nationalID: '',
          name: '',
          nameArabic: '',
          leaveId: '',
          nationality: '',
          employer: '',
          physicianPosition: '',
          physicianPositionArabic: '',
          issueDate: '',
          admissionDate: '',
          dischargeDate: '',
          startDate: '',
          endDate: '',
          duration: '',
          doctorName: '',
          doctorNameArabic: '',
          hospitalNameArabic: '',
          hospitalNameEnglish: '',
          licenseNumber: '1410845906',
          showLicenseNumber: true,
          admissionDateAr: '',
          dischargeDateAr: '',
          reportTime: '',
          reportDate: '',
          footerLogo: ''
        })
        setSearchData({ serviceNum: '', nationalID: '' })
        setIsEditMode(false)
        setSuccess(false)
      } else {
        setMessage(`خطأ في الحذف: ${data.error}`)
        window.showToast?.(data.error || 'فشل في حذف الإجازة المرضية', 'error')
      }
    } catch (error) {
      console.error(error)
      setMessage('حدث خطأ أثناء حذف السجل')
      window.showToast?.('حدث خطأ أثناء حذف السجل', 'error')
    } finally {
      setDeleteLoading(false)
      setShowDeleteModal(false)
    }
  }

  // Reset form
  const handleReset = () => {
    setFormData({
      id: null,
      serviceNum: '',
      nationalID: '',
      name: '',
      nameArabic: '',
      leaveId: '',
      nationality: '',
      employer: '',
      physicianPosition: '',
      physicianPositionArabic: '',
      issueDate: '',
      admissionDate: '',
      dischargeDate: '',
      startDate: '',
      endDate: '',
      duration: '',
      doctorName: '',
      doctorNameArabic: '',
      hospitalNameArabic: '',
      hospitalNameEnglish: '',
      licenseNumber: '1410845906',
      showLicenseNumber: true,
      admissionDateAr: '',
      dischargeDateAr: '',
      reportTime: '',
      reportDate: '',
      footerLogo: ''
    })
    setSearchData({ serviceNum: '', nationalID: '' })
    setIsEditMode(false)
    setMessage('')
    setErrors({})
    setSuccess(false)
    setPdfError('')
    setSearchError('')
    setAiText('')
    setAiError('')
    setOriginalServiceNum('')
    setOriginalLeaveId('')
  }

  // Download PDF - الطريقة الجديدة (Frontend)
  const handleDownloadPDF = async () => {
    setPdfLoading(true)
    setPdfError('')

    try {
      let pdfDataToUse

      if (isEditMode) {
        // العثور على الدولة المختارة للحصول على الاسم الإنجليزي
        const selectedCountry = countries.find(c => c.country_name_ar === formData.nationality)
        const countryNameEn = selectedCountry?.country_name_en || 'Saudi Arabia'

        // في وضع التعديل، استخدم بيانات النموذج الحالية مع التحويل الصحيح
        pdfDataToUse = {
          ...formData,
          // Mapping required by SickLeavePDFOriginal.jsx
          leave_id: formData.leaveId,
          service_num: formData.serviceNum,
          national_id: formData.nationalID,
          name_en: formData.name,
          name_ar: formData.nameArabic,
          employer_en: formData.employer,
          employer_ar: formData.employer,
          physician_name_en: formData.doctorName,
          physician_name_ar: formData.doctorNameArabic,
          position_en: formData.physicianPosition,
          position_ar: formData.physicianPositionArabic,
          hospital_name_en: formData.hospitalNameEnglish,
          hospital_name_ar: formData.hospitalNameArabic,
          license_number: formData.licenseNumber,
          show_license_number: formData.showLicenseNumber,

          admission_date_en: formData.admissionDate,
          discharge_date_en: formData.dischargeDate,
          admission_date_ar: formData.admissionDateAr || leaveData?.admission_date_ar || '', // استخدام التاريخ الهجري المحفوظ
          discharge_date_ar: formData.dischargeDateAr || leaveData?.discharge_date_ar || '', // استخدام التاريخ الهجري المحفوظ
          issue_date: formData.issueDate,

          report_date: formData.reportDate ? formatDateForPDF(formData.reportDate) : null,
          report_time: formData.reportTime ? formatTimeForPDF(formData.reportTime) : null,

          nationality: formData.nationality,
          country: {
            country_name_ar: formData.nationality,
            country_name_en: countryNameEn
          },
          footer_logo: formData.footerLogo || null
        }
        setPdfData(pdfDataToUse)
        setShowPdfModal(true)
      } else {
        // في وضع الإنشاء، جلب البيانات من السيرفر
        const response = await fetch(`${API_URL}?service_num=${formData.serviceNum}&national_id=${formData.nationalID}`)
        const data = await response.json()

        if (response.ok && data.length > 0) {
          setPdfData(data[0])
          setShowPdfModal(true)
        } else {
          setPdfError('لم يتم العثور على البيانات. يرجى التأكد من حفظ النموذج أولاً')
        }
      }
    } catch (error) {
      console.error('❌ PDF error:', error)
      setPdfError(`خطأ في تحميل البيانات: ${error.message}`)
    } finally {
      setPdfLoading(false)
    }
  }

  // Check if user has permission
  if (editMode && !canEdit) {
    return (
      <div className={styles.slContainer}>
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          background: '#fee2e2',
          borderRadius: '12px',
          margin: '2rem auto',
          maxWidth: '600px'
        }}>
          <h2 style={{ color: '#dc2626', marginBottom: '1rem' }}>⛔ غير مصرح</h2>
          <p style={{ color: '#991b1b', fontSize: '1.1rem' }}>
            ليس لديك صلاحية لتعديل الإجازات المرضية
          </p>
          <Link to="/dashboard" style={{
            display: 'inline-block',
            marginTop: '1.5rem',
            padding: '0.75rem 1.5rem',
            background: '#3b82f6',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none'
          }}>
            العودة للوحة التحكم
          </Link>
        </div>
      </div>
    )
  }

  if (!editMode && !canCreate) {
    return (
      <div className={styles.slContainer}>
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          background: '#fee2e2',
          borderRadius: '12px',
          margin: '2rem auto',
          maxWidth: '600px'
        }}>
          <h2 style={{ color: '#dc2626', marginBottom: '1rem' }}>⛔ غير مصرح</h2>
          <p style={{ color: '#991b1b', fontSize: '1.1rem' }}>
            ليس لديك صلاحية لإنشاء إجازات مرضية جديدة
          </p>
          <Link to="/dashboard" style={{
            display: 'inline-block',
            marginTop: '1.5rem',
            padding: '0.75rem 1.5rem',
            background: '#3b82f6',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none'
          }}>
            العودة للوحة التحكم
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.slContainer}>
      {/* Logo Section */}
      <div className={styles.logoSection}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🏔️</span>
          <span className={styles.logoText}>الجبل</span>
        </div>
        <p className={styles.logoTagline}>نظام إدارة الإجازات المرضية</p>
      </div>

      {/* Title Section */}
      <div className={styles.titleSection}>
        <h1 className={styles.title}>نموذج الإجازة المرضية</h1>
        <p className={styles.description}>
          {isEditMode ? 'تعديل بيانات الإجازة المرضية' : 'يرجى ملء جميع الحقول المطلوبة لإنشاء تقرير الإجازة المرضية'}
        </p>
      </div>

      {/* Search Section */}
      <div className={styles.searchSection}>
        <h2 className={styles.searchTitle}>البحث عن إجازة مرضية موجودة</h2>
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <div className={styles.searchFields}>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="searchServiceNum">
                رقم الخدمة
              </label>
              <input
                className={styles.inputField}
                type="text"
                id="searchServiceNum"
                name="serviceNum"
                value={searchData.serviceNum}
                onChange={handleSearchChange}
                placeholder="أدخل رقم الخدمة"
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="searchNationalID">
                رقم الهوية / الإقامة
              </label>
              <input
                className={styles.inputField}
                type="text"
                id="searchNationalID"
                name="nationalID"
                value={searchData.nationalID}
                onChange={handleSearchChange}
                placeholder="أدخل رقم الهوية"
              />
            </div>
          </div>

          <div className={styles.searchActions}>
            <button
              type="submit"
              className={styles.searchButton}
              disabled={searchLoading}
            >
              {searchLoading ? 'جاري البحث...' : 'بحث'}
            </button>

            <button
              type="button"
              className={styles.resetButton}
              onClick={handleReset}
            >
              نموذج جديد
            </button>
          </div>
        </form>

        {searchError && (
          <p className={styles.errorMessage}>{searchError}</p>
        )}
      </div>

      {/* AI Section */}
      <div className={styles.aiSection}>
        <h2 className={styles.aiTitle}>ملء النموذج تلقائياً بالذكاء الاصطناعي</h2>
        <p className={styles.aiDescription}>
          أدخل معلومات العميل كما هي وسيقوم الذكاء الاصطناعي بملء النموذج تلقائياً
        </p>
        <form onSubmit={handleAIExtract} className={styles.aiForm}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="aiClientInfo">
              معلومات العميل
            </label>
            <textarea
              className={styles.aiTextarea}
              id="aiClientInfo"
              name="aiClientInfo"
              value={aiText}
              onChange={handleAIChange}
              placeholder="أدخل معلومات العميل هنا..."
              rows="8"
            />
            {aiError && (
              <span className={styles.errorMessage}>{aiError}</span>
            )}
          </div>

          <button
            type="submit"
            className={styles.aiButton}
            disabled={aiLoading}
          >
            {aiLoading ? 'جاري المعالجة بالذكاء الاصطناعي...' : 'استخراج البيانات تلقائياً'}
          </button>
        </form>
      </div>

      {/* Form Container */}
      <div className={styles.formContainer}>
        <form onSubmit={handleSubmit} className={styles.slForm}>
          {/* Service Number */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="serviceNum">
              رقم الخدمة *
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                value={serviceNumType}
                onChange={(e) => setServiceNumType(e.target.value)}
                style={{
                  padding: '0.5rem',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  background: '#f8fafc',
                  fontFamily: 'inherit',
                  minWidth: '80px'
                }}
              >
                <option value="GSL">GSL</option>
                <option value="PSL">PSL</option>
              </select>
              <input
                className={styles.inputField}
                type="text"
                id="serviceNum"
                name="serviceNum"
                value={formData.serviceNum}
                onChange={handleChange}
                placeholder="اضغط توليد أو أدخل الرقم"
                style={{ flex: 1 }}
                required
              />
              <button
                type="button"
                onClick={handleGenerateServiceNum}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem',
                  whiteSpace: 'nowrap'
                }}
              >
                ✨ توليد
              </button>
            </div>
            {errors.serviceNum && (
              <span className={styles.errorMessage}>{errors.serviceNum}</span>
            )}
          </div>

          {/* National ID */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="nationalID">
              رقم الهوية / الإقامة *
            </label>
            <input
              className={styles.inputField}
              type="text"
              id="nationalID"
              name="nationalID"
              value={formData.nationalID}
              onChange={handleChange}
              required
            />
            {errors.nationalID && (
              <span className={styles.errorMessage}>{errors.nationalID}</span>
            )}
          </div>

          {/* Name (English) */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="name">
              الاسم (بالإنجليزية) *
            </label>
            <input
              className={styles.inputField}
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
            {errors.name && (
              <span className={styles.errorMessage}>{errors.name}</span>
            )}
          </div>

          {/* Name (Arabic) */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="nameArabic">
              الاسم (بالعربية) *
            </label>
            <input
              className={styles.inputField}
              type="text"
              id="nameArabic"
              name="nameArabic"
              value={formData.nameArabic}
              onChange={handleChange}
              required
            />
            {errors.nameArabic && (
              <span className={styles.errorMessage}>{errors.nameArabic}</span>
            )}
          </div>

          {/* Leave ID */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="leaveId">
              رقم الإجازة (يتطابق مع رقم الخدمة) *
            </label>
            <input
              className={styles.inputField}
              type="text"
              id="leaveId"
              name="leaveId"
              value={formData.leaveId}
              onChange={handleChange}
              placeholder="يتم ضبطه تلقائياً حسب رقم الخدمة"
              style={{ flex: 1, backgroundColor: '#f3f4f6' }}
              readOnly
              required
            />
            {errors.leaveId && (
              <span className={styles.errorMessage}>{errors.leaveId}</span>
            )}
          </div>

          {/* Nationality */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="nationality">
              الجنسية *
            </label>
            <select
              className={styles.inputField}
              id="nationality"
              name="nationality"
              value={formData.nationality}
              onChange={handleChange}
              required
            >
              <option value="">-- اختر الدولة --</option>
              {countries.map(country => (
                <option key={country.id} value={country.country_name_ar}>
                  {country.country_name_ar}
                </option>
              ))}
            </select>
            {errors.nationality && (
              <span className={styles.errorMessage}>{errors.nationality}</span>
            )}
          </div>

          {/* Employer */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="employer">
              جهة العمل
            </label>
            <input
              className={styles.inputField}
              type="text"
              id="employer"
              name="employer"
              value={formData.employer}
              onChange={handleChange}
            />
            {errors.employer && (
              <span className={styles.errorMessage}>{errors.employer}</span>
            )}
          </div>

          {/* Issue Date */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="issueDate">
              تاريخ إصدار تقرير الإجازة *
            </label>
            <input
              className={styles.inputField}
              type="date"
              id="issueDate"
              name="issueDate"
              value={formData.issueDate}
              onChange={handleChange}
              required
            />
            {errors.issueDate && (
              <span className={styles.errorMessage}>{errors.issueDate}</span>
            )}
          </div>

          {/* Admission Date */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="admissionDate">
              تاريخ الدخول للمستشفى *
            </label>
            <input
              className={styles.inputField}
              type="date"
              id="admissionDate"
              name="admissionDate"
              value={formData.admissionDate}
              onChange={handleChange}
              required
            />
            {errors.admissionDate && (
              <span className={styles.errorMessage}>{errors.admissionDate}</span>
            )}
            <small className={styles.helpText}>
              سيتم تحويل التاريخ تلقائياً إلى التقويم الهجري
            </small>
          </div>

          {/* Discharge Date */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="dischargeDate">
              تاريخ الخروج من المستشفى *
            </label>
            <input
              className={styles.inputField}
              type="date"
              id="dischargeDate"
              name="dischargeDate"
              value={formData.dischargeDate}
              onChange={handleChange}
              required
            />
            {errors.dischargeDate && (
              <span className={styles.errorMessage}>{errors.dischargeDate}</span>
            )}
            <small className={styles.helpText}>
              سيتم تحويل التاريخ تلقائياً إلى التقويم الهجري
            </small>
          </div>

          {/* Start Date */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="startDate">
              تبدأ من *
            </label>
            <input
              className={styles.inputField}
              type="date"
              id="startDate"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              required
            />
            {errors.startDate && (
              <span className={styles.errorMessage}>{errors.startDate}</span>
            )}
          </div>

          {/* End Date */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="endDate">
              وحتى *
            </label>
            <input
              className={styles.inputField}
              type="date"
              id="endDate"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              required
            />
            {errors.endDate && (
              <span className={styles.errorMessage}>{errors.endDate}</span>
            )}
          </div>

          {/* Duration */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="duration">
              المدة بالأيام * (تحسب تلقائياً)
            </label>
            <input
              className={`${styles.inputField} ${styles.readOnlyInput}`}
              type="number"
              id="duration"
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              placeholder="سيتم حسابها تلقائياً"
              readOnly
              style={{ backgroundColor: '#f8fafc', cursor: 'not-allowed' }}
            />
            <small className={styles.helperText}>
              ⚡ يتم حساب المدة تلقائياً من تاريخ الدخول والخروج
            </small>
            {errors.duration && (
              <span className={styles.errorMessage}>{errors.duration}</span>
            )}
          </div>

          {/* Doctor Name (English) */}
          <div className={styles.fieldGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className={styles.label} htmlFor="doctorName">
                اسم الطبيب (بالإنجليزية) *
              </label>
              <button
                type="button"
                onClick={() => setShowAddDoctorModal(true)}
                style={{
                  padding: '2px 8px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                ➕ إضافة جديد
              </button>
            </div>
            <input
              className={styles.inputField}
              type="text"
              id="doctorName"
              name="doctorName"
              value={formData.doctorName}
              onChange={handleChange}
              list="doctors-en-list"
              required
            />
            {errors.doctorName && (
              <span className={styles.errorMessage}>{errors.doctorName}</span>
            )}
          </div>

          {/* Doctor Name (Arabic) */}
          <div className={styles.fieldGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className={styles.label} htmlFor="doctorNameArabic">
                اسم الطبيب (بالعربية) *
              </label>
              <button
                type="button"
                onClick={() => setShowAddDoctorModal(true)}
                style={{
                  padding: '2px 8px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                ➕ إضافة جديد
              </button>
            </div>
            <input
              className={styles.inputField}
              type="text"
              id="doctorNameArabic"
              name="doctorNameArabic"
              value={formData.doctorNameArabic}
              onChange={handleChange}
              list="doctors-ar-list"
              required
            />
            {errors.doctorNameArabic && (
              <span className={styles.errorMessage}>{errors.doctorNameArabic}</span>
            )}
          </div>

          {/* Hospital Name (Arabic) */}
          <div className={styles.fieldGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className={styles.label} htmlFor="hospitalNameArabic">
                اسم المستشفى (بالعربية) *
              </label>
              <button
                type="button"
                onClick={() => setShowAddHospitalModal(true)}
                style={{
                  padding: '2px 8px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                ➕ إضافة جديد
              </button>
            </div>
            <input
              className={styles.inputField}
              type="text"
              id="hospitalNameArabic"
              name="hospitalNameArabic"
              value={formData.hospitalNameArabic}
              onChange={handleChange}
              list="hospitals-ar-list"
              required
            />
            {errors.hospitalNameArabic && (
              <span className={styles.errorMessage}>{errors.hospitalNameArabic}</span>
            )}
          </div>

          {/* Hospital Name (English) */}
          <div className={styles.fieldGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className={styles.label} htmlFor="hospitalNameEnglish">
                اسم المستشفى (بالإنجليزية) *
              </label>
              <button
                type="button"
                onClick={() => setShowAddHospitalModal(true)}
                style={{
                  padding: '2px 8px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                ➕ إضافة جديد
              </button>
            </div>
            <input
              className={styles.inputField}
              type="text"
              id="hospitalNameEnglish"
              name="hospitalNameEnglish"
              value={formData.hospitalNameEnglish}
              onChange={handleChange}
              list="hospitals-en-list"
              required
            />
            {errors.hospitalNameEnglish && (
              <span className={styles.errorMessage}>{errors.hospitalNameEnglish}</span>
            )}
          </div>

          {/* Footer Logo Uploader */}
          <div className={styles.logoUploader}>
            <label className={styles.label}>صورة المستشفى (اختياري)</label>
            <div className={styles.logoControls}>
              <input
                ref={footerLogoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFooterLogoChange}
              />
              <button
                type="button"
                className={styles.mediaPickerBtn}
                onClick={() => setShowMediaPicker(true)}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit'
                }}
              >
                📁 اختر من المعرض
              </button>
              <button
                type="button"
                className={styles.resetButton}
                onClick={handleFooterLogoReset}
              >
                إعادة الصورة الافتراضية
              </button>
            </div>
            <small className={styles.helpText}>
              JPG / PNG / GIF / WEBP • حتى 5 ميجابايت
            </small>
            {logoError && <span className={styles.errorMessage}>{logoError}</span>}
            <div className={styles.logoPreview}>
              <p>المعاينة:</p>
              <img
                src={formData.footerLogo || DEFAULT_FOOTER_LOGO}
                alt="Footer Logo Preview"
                className={styles.previewImage}
              />
            </div>
          </div>

          {/* License Number */}
          <div className={styles.fieldGroup}>
            <div className={styles.checkboxWrapper} style={{ marginBottom: '10px' }}>
              <label className={styles.checkboxLabel} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="showLicenseNumber"
                  checked={formData.showLicenseNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, showLicenseNumber: e.target.checked }))}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.95rem', color: '#374151' }}>إظهار رقم الترخيص في PDF</span>
              </label>
            </div>
            {formData.showLicenseNumber && (
              <>
                <label className={styles.label} htmlFor="licenseNumber">
                  رقم الترخيص
                </label>
                <input
                  className={styles.inputField}
                  type="text"
                  id="licenseNumber"
                  name="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={handleChange}
                  placeholder="1410845906"
                />
              </>
            )}
          </div>

          {/* Physician Position (English) */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="physicianPosition">
              منصب/تخصص الطبيب (بالإنجليزية) *
            </label>
            <input
              className={styles.inputField}
              type="text"
              id="physicianPosition"
              name="physicianPosition"
              value={formData.physicianPosition}
              onChange={handleChange}
              required
            />
            {errors.physicianPosition && (
              <span className={styles.errorMessage}>{errors.physicianPosition}</span>
            )}
          </div>

          {/* Physician Position (Arabic) */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="physicianPositionArabic">
              منصب/تخصص الطبيب (بالعربية) *
            </label>
            <input
              className={styles.inputField}
              type="text"
              id="physicianPositionArabic"
              name="physicianPositionArabic"
              value={formData.physicianPositionArabic}
              onChange={handleChange}
              required
            />
            {errors.physicianPositionArabic && (
              <span className={styles.errorMessage}>{errors.physicianPositionArabic}</span>
            )}
          </div>

          {/* Report Fields Section - مميز */}
          <div className={styles.reportSection}>
            <div className={styles.reportSectionHeader}>
              <h3>📋 تفاصيل التقرير</h3>
              <p className={styles.reportSectionDescription}>
                حقول اختيارية لتحديد وقت وتاريخ إصدار التقرير
              </p>
            </div>

            <div className={styles.reportFields}>
              {/* Report Date */}
              <div className={styles.fieldGroup}>
                <label className={`${styles.label} ${styles.reportLabel}`} htmlFor="reportDate">
                  📅 تاريخ إصدار التقرير
                </label>
                <input
                  className={`${styles.inputField} ${styles.reportInput}`}
                  type="date"
                  id="reportDate"
                  name="reportDate"
                  value={formData.reportDate}
                  onChange={handleChange}
                />
                <small className={`${styles.helperText} ${styles.reportHelperText}`}>
                  يترك فارغاً لاستخدام التاريخ الحالي تلقائياً
                </small>
              </div>

              {/* Report Time */}
              <div className={styles.fieldGroup}>
                <label className={`${styles.label} ${styles.reportLabel}`} htmlFor="reportTime">
                  🕐 وقت إصدار التقرير
                </label>
                <input
                  className={`${styles.inputField} ${styles.reportInput}`}
                  type="time"
                  id="reportTime"
                  name="reportTime"
                  value={formData.reportTime}
                  onChange={handleChange}
                />
                <small className={`${styles.helperText} ${styles.reportHelperText}`}>
                  يترك فارغاً لاستخدام الوقت الحالي تلقائياً
                </small>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className={styles.formActions}>
            <button type="submit" className={styles.submitButton}>
              {isEditMode ? 'تحديث الإجازة المرضية' : 'إنشاء إجازة مرضية جديدة'}
            </button>

            {isEditMode && (
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => setShowDeleteModal(true)}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'جاري الحذف...' : 'حذف الإجازة المرضية'}
              </button>
            )}
          </div>
        </form>

        {/* Messages and Actions */}
        <div className={styles.additionalActions}>
          <Link to="/pdf-generator" className={styles.pdfGeneratorLink}>
            تحميل تقرير إجازة مرضية موجود
          </Link>
        </div>

        {message && (
          <p className={styles.responseMessage}>{message}</p>
        )}

        {success && (
          <div className={styles.pdfDownloadSection}>
            <button
              onClick={handleDownloadPDF}
              disabled={pdfLoading}
              className={styles.pdfDownloadButton}
            >
              {pdfLoading ? 'جاري تحميل PDF...' : 'تحميل تقرير PDF'}
            </button>

            {pdfError && (
              <div className={styles.pdfErrorContainer}>
                <p className={styles.pdfErrorMessage}>{pdfError}</p>
                <p className={styles.pdfErrorHelp}>
                  إذا استمر الخطأ، يرجى المحاولة مرة أخرى بعد بضع دقائق أو الاتصال بالدعم الفني
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>تأكيد الحذف</h3>
            <p className={styles.modalMessage}>
              هل أنت متأكد من حذف هذه الإجازة المرضية؟
              <br />
              رقم الخدمة: {formData.serviceNum}
              <br />
              رقم الهوية: {formData.nationalID}
              <br />
              <strong>هذا الإجراء لا يمكن التراجع عنه!</strong>
            </p>
            <div className={styles.modalActions}>
              <button
                className={styles.confirmDeleteButton}
                onClick={handleDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'جاري الحذف...' : 'نعم، احذف'}
              </button>
              <button
                className={styles.cancelButton}
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteLoading}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Modal */}
      {showPdfModal && pdfData && (
        <SickLeavePDFOriginal
          data={pdfData}
          onClose={() => setShowPdfModal(false)}
        />
      )}

      {/* Media Picker Modal */}
      <MediaPicker
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={(media) => {
          // استخدام رابط الصورة من المعرض
          const imageUrl = media.url.startsWith('http') ? media.url : `${API_BASE_URL}${media.url}`
          setFormData(prev => ({ ...prev, footerLogo: imageUrl }))
          setLogoError('')
        }}
        accept="image"
        category="all"
      />

      {/* Add Doctor Modal */}
      {showAddDoctorModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddDoctorModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%', maxHeight: '95vh', overflowY: 'auto', textAlign: 'right', padding: '24px' }}>
            <h3 className={styles.modalTitle} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', marginBottom: '15px' }}>
              ➕ إضافة طبيب جديد
            </h3>
            <form onSubmit={handleAddDoctorSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className={styles.fieldGroup}>
                <label className={styles.label} style={{ textAlign: 'right', display: 'block' }}>اسم الطبيب (بالعربية) *</label>
                <input
                  className={styles.inputField}
                  type="text"
                  value={newDoctorFormData.name_ar}
                  onChange={e => setNewDoctorFormData(prev => ({ ...prev, name_ar: e.target.value }))}
                  placeholder="مثال: د. أحمد محمد"
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} style={{ textAlign: 'right', display: 'block' }}>اسم الطبيب (بالإنجليزية) *</label>
                <input
                  className={styles.inputField}
                  type="text"
                  value={newDoctorFormData.name_en}
                  onChange={e => setNewDoctorFormData(prev => ({ ...prev, name_en: e.target.value }))}
                  placeholder="Example: Dr. Ahmad Mohammad"
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} style={{ textAlign: 'right', display: 'block' }}>منصب/تخصص الطبيب (بالعربية)</label>
                <input
                  className={styles.inputField}
                  type="text"
                  value={newDoctorFormData.position_ar}
                  onChange={e => setNewDoctorFormData(prev => ({ ...prev, position_ar: e.target.value }))}
                  placeholder="مثال: طبيب أخصائي"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} style={{ textAlign: 'right', display: 'block' }}>منصب/تخصص الطبيب (بالإنجليزية)</label>
                <input
                  className={styles.inputField}
                  type="text"
                  value={newDoctorFormData.position_en}
                  onChange={e => setNewDoctorFormData(prev => ({ ...prev, position_en: e.target.value }))}
                  placeholder="Example: Specialist"
                />
              </div>

              <div className={styles.modalActions} style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={addDoctorLoading}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontFamily: 'inherit'
                  }}
                >
                  {addDoctorLoading ? 'جاري الإضافة...' : '➕ إضافة الطبيب'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddDoctorModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Hospital Modal */}
      {showAddHospitalModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddHospitalModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%', maxHeight: '95vh', overflowY: 'auto', textAlign: 'right', padding: '24px' }}>
            <h3 className={styles.modalTitle} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', marginBottom: '15px' }}>
              ➕ إضافة مستشفى جديد
            </h3>
            <form onSubmit={handleAddHospitalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className={styles.fieldGroup}>
                <label className={styles.label} style={{ textAlign: 'right', display: 'block' }}>اسم المستشفى (بالعربية) *</label>
                <input
                  className={styles.inputField}
                  type="text"
                  value={newHospitalFormData.name_ar}
                  onChange={e => setNewHospitalFormData(prev => ({ ...prev, name_ar: e.target.value }))}
                  placeholder="مثال: مستشفى النور التخصصي"
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} style={{ textAlign: 'right', display: 'block' }}>اسم المستشفى (بالإنجليزية) *</label>
                <input
                  className={styles.inputField}
                  type="text"
                  value={newHospitalFormData.name_en}
                  onChange={e => setNewHospitalFormData(prev => ({ ...prev, name_en: e.target.value }))}
                  placeholder="Example: AL NOOR SPECIALIST HOSPITAL"
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} style={{ textAlign: 'right', display: 'block' }}>رقم الترخيص</label>
                <input
                  className={styles.inputField}
                  type="text"
                  value={newHospitalFormData.license_number}
                  onChange={e => setNewHospitalFormData(prev => ({ ...prev, license_number: e.target.value }))}
                  placeholder="مثال: 1410845906"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} style={{ textAlign: 'right', display: 'block' }}>الشعار / الختم</label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setShowHospitalMediaPicker(true)}
                    style={{
                      padding: '6px 12px',
                      background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit'
                    }}
                  >
                    📁 اختر من المعرض
                  </button>
                  {newHospitalFormData.logo && (
                    <button
                      type="button"
                      onClick={() => setNewHospitalFormData(prev => ({ ...prev, logo: '' }))}
                      style={{
                        padding: '6px 12px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontFamily: 'inherit'
                      }}
                    >
                      حذف الشعار
                    </button>
                  )}
                </div>
                {newHospitalFormData.logo && (
                  <div style={{ marginTop: '10px' }}>
                    <p style={{ margin: '5px 0', fontSize: '0.85rem' }}>المعاينة:</p>
                    <img
                      src={newHospitalFormData.logo.startsWith('http') || newHospitalFormData.logo.startsWith('data:')
                        ? newHospitalFormData.logo
                        : `${API_BASE_URL}${newHospitalFormData.logo}`
                      }
                      alt="Preview"
                      style={{ height: '50px', width: 'auto', border: '1px solid #ddd', padding: '2px', borderRadius: '4px' }}
                    />
                  </div>
                )}
              </div>
              <div className={styles.modalActions} style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={addHospitalLoading}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontFamily: 'inherit'
                  }}
                >
                  {addHospitalLoading ? 'جاري الإضافة...' : '➕ إضافة المستشفى'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddHospitalModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hospital Logo Media Picker Modal */}
      <MediaPicker
        isOpen={showHospitalMediaPicker}
        onClose={() => setShowHospitalMediaPicker(false)}
        onSelect={(media) => {
          setNewHospitalFormData(prev => ({ ...prev, logo: media.url }))
          setShowHospitalMediaPicker(false)
        }}
        accept="image"
        category="all"
      />

      {/* Datalists for autocomplete */}
      <datalist id="doctors-ar-list">
        {doctors.map(doc => (
          <option key={`doc-ar-${doc.id}`} value={doc.name_ar}>
            {doc.name_en} {doc.position_ar ? `(${doc.position_ar})` : ''}
          </option>
        ))}
      </datalist>
      <datalist id="doctors-en-list">
        {doctors.map(doc => (
          <option key={`doc-en-${doc.id}`} value={doc.name_en}>
            {doc.name_ar} {doc.position_en ? `(${doc.position_en})` : ''}
          </option>
        ))}
      </datalist>
      <datalist id="hospitals-ar-list">
        {hospitals.map(h => (
          <option key={`hosp-ar-${h.id}`} value={h.name_ar}>
            {h.name_en}
          </option>
        ))}
      </datalist>
      <datalist id="hospitals-en-list">
        {hospitals.map(h => (
          <option key={`hosp-en-${h.id}`} value={h.name_en}>
            {h.name_ar}
          </option>
        ))}
      </datalist>
    </div>
  )
}

export default SickLeaveForm

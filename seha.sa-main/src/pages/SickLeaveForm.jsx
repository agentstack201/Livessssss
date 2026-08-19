import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import styles from './SickLeaveForm.module.css'
import MediaPicker from '../components/MediaPicker'
import { normalizeNationality } from '../utils/nationality'
import NationalityPicker from '../components/NationalityPicker'
import { calcWaitingPeriod } from '../utils/documentFormat'
import {
  DEFAULT_DOCUMENT_TYPE,
  DOCUMENT_TYPE_LIST,
  getDocumentType,
  normalizeDocumentType,
} from '../config/documentTypes'

// API Configuration from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
const API_SICK_LEAVES = import.meta.env.VITE_API_SICK_LEAVES || '/sick-leaves'
const API_URL = `${API_BASE_URL}${API_SICK_LEAVES}`
const DEFAULT_FOOTER_LOGO = '/images/1.png'
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

// أنواع المستندات المدعومة تأتي كلها من src/config/documentTypes.js — لا تُعرَّف
// هنا حتى لا ينحرف النموذج عن بقية الصفحات عند إضافة قالب جديد.

// حقول قوالب «مشهد المراجعة» — تُضاف للنموذج بقيم فارغة دائماً حتى تبقى
// الحقول متحكَّماً بها (controlled) مع كل القوالب.
const COMPANION_FIELD_DEFAULTS = {
  admissionTime: '',
  dischargeTime: '',
  relationArabic: '',
  relationEnglish: '',
  visitTypeArabic: '',
  visitTypeEnglish: ''
}

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
    phone: '', // رقم جوال الزبون (لإرسال التقرير عبر واتساب)
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
    addQr: true, // إظهار QR في PDF — القيمة الافتراضية تطابق السلوك الحالي (كان دائماً ظاهراً)
    dateMode: 'actual', // طريقة التاريخ: actual (الفعلي) أو issue_date (يبدأ من تاريخ الإصدار)
    reportTime: '',
    reportDate: '',
    footerLogo: '',
    ...COMPANION_FIELD_DEFAULTS
  })

  // نوع المستند (القالب) المختار. يأتي من:
  //   1. زر «استخدام القالب» في صفحة القوالب (location.state.templateType)
  //   2. مَعلمة ?template= في الرابط، ليكون لكل قالب رابط مباشر قابل للمشاركة
  //   3. وإلا الافتراضي: الإجازة المرضية (النظام الحالي كما هو بالضبط)
  const [documentType, setDocumentType] = useState(() => {
    const fromState = location.state?.templateType
    const fromQuery = new URLSearchParams(location.search).get('template')
    return normalizeDocumentType(fromState || fromQuery || DEFAULT_DOCUMENT_TYPE)
  })

  // وصف القالب الحالي: مسمّياته وحقوله المطلوبة والقدرات التي يفعّلها.
  const docType = getDocumentType(documentType)
  const feat = docType.features
  const labels = docType.labels
  // القوالب التي تحمل وقت دخول/خروج وفترة انتظار (مشهد المراجعة بنوعيه).
  const isVisitLike = feat.times

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
  // القادم من زر «استخدام القالب» يفتح على تبويب النموذج مباشرةً — فقد اختار
  // قالبه بالفعل ولا معنى لإنزاله على تبويب الاستخراج بالذكاء الاصطناعي.
  const cameFromTemplatePicker = Boolean(
    location.state?.templateType || new URLSearchParams(location.search).get('template')
  )
  const [activeTab, setActiveTab] = useState(editMode || cameFromTemplatePicker ? 'form' : 'ai')
  const [aiFieldsFilled, setAiFieldsFilled] = useState(0)
  const [aiSuccess, setAiSuccess] = useState(false)
  const [doctors, setDoctors] = useState([]) // قائمة الأطباء من قاعدة البيانات
  const [hospitals, setHospitals] = useState([]) // قائمة المستشفيات من قاعدة البيانات
  const footerLogoInputRef = useRef(null)

  const canManageDoctors = userPermissions.can_manage_doctors || user.role === 'admin'
  const canManageHospitals = userPermissions.can_manage_hospitals || user.role === 'admin'

  // ذاكرة العميل: عند إدخال رقم هوية معروف، تُعبّأ بياناته المتكررة تلقائياً.
  const [clientMemo, setClientMemo] = useState(null) // {previousRequests, applied[]}
  const lastLookedUpId = useRef('')

  const lookupClient = async (nationalId) => {
    const id = (nationalId || '').trim()
    if (!/^\d{10}$/.test(id)) return          // هوية/إقامة سعودية = 10 أرقام
    if (id === lastLookedUpId.current) return  // لا تكرّر نفس البحث
    lastLookedUpId.current = id
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const body = await res.json()
      if (!res.ok || !body.found || !body.data) { setClientMemo(null); return }

      const d = body.data
      // خريطة حقل قاعدة البيانات → حقل النموذج
      const mem = {
        name: d.name, nameArabic: d.nameArabic, phone: d.phone, nationality: d.nationality,
        employer: d.employer, physicianPosition: d.physicianPosition,
        physicianPositionArabic: d.physicianPositionArabic,
        doctorName: d.doctorName, doctorNameArabic: d.doctorNameArabic,
        hospitalNameEnglish: d.hospitalNameEnglish, hospitalNameArabic: d.hospitalNameArabic,
        licenseNumber: d.licenseNumber,
      }

      // نملأ الحقول الفارغة فقط — لا نطمس ما كتبه الموظف.
      const applied = []
      setFormData(prev => {
        const next = { ...prev }
        Object.entries(mem).forEach(([k, v]) => {
          if (v && (!prev[k] || String(prev[k]).trim() === '' ||
              (k === 'nationality' && prev[k] === 'السعودية') ||
              (k === 'licenseNumber' && prev[k] === '1410845906'))) {
            next[k] = v
            applied.push(k)
          }
        })
        return next
      })
      setClientMemo({ previousRequests: d.previousRequests, applied: applied.length })
    } catch {
      setClientMemo(null)
    }
  }

  // إعادة جلب قائمة الدول/الجنسيات من الخادم
  const refetchCountries = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/all-countries`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok && data.data) setCountries(data.data)
      return data.data || []
    } catch (e) {
      console.error('Error refetching countries:', e)
      return []
    }
  }

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
        phone: leaveData.phone || '',
        name: leaveData.name_en || '',
        nameArabic: leaveData.name_ar || '',
        leaveId: leaveData.leave_id || '',
        nationality: (() => {
          const rawNat = leaveData.country?.country_name_ar || leaveData.nationality || 'السعودية';
          const mapping = {
            'مصري': 'مصر',
            'سوري': 'سوريا',
            'يمني': 'اليمن',
            'أردني': 'الأردن'
          };
          // «سعودي» بأي رسم → «السعودية» (التوحيد المعتمد)، وبقية الجنسيات
          // تُحوَّل إلى اسم الدولة كما كانت.
          return normalizeNationality(mapping[rawNat] || rawNat);
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
        addQr: leaveData.add_qr !== false,
        dateMode: leaveData.date_mode === 'issue_date' ? 'issue_date' : 'actual',
        reportTime: parsePdfReportTime(leaveData.report_time),
        reportDate: parsePdfReportDate(leaveData.report_date),
        footerLogo: leaveData.footer_logo
          ? (leaveData.footer_logo.startsWith('http') || leaveData.footer_logo.startsWith('data:') ? leaveData.footer_logo : `${API_BASE_URL}${leaveData.footer_logo}`)
          : '',
        // حقول «مشهد مراجعة لمرافق» — فارغة للسجلات القديمة
        admissionTime: parsePdfReportTime(leaveData.admission_time),
        dischargeTime: parsePdfReportTime(leaveData.discharge_time),
        relationArabic: leaveData.relation_ar || '',
        relationEnglish: leaveData.relation_en || '',
        visitTypeArabic: leaveData.visit_type_ar || '',
        visitTypeEnglish: leaveData.visit_type_en || ''
      })
      setDocumentType(normalizeDocumentType(leaveData.document_type))
      setIsEditMode(true)
      setOriginalServiceNum(leaveData.service_num || '')
      setOriginalLeaveId(leaveData.leave_id || '')
      setMessage('✏️ وضع التعديل - قم بتعديل البيانات ثم اضغط حفظ')
    }
  }, [editMode, leaveData])

  // حساب المدة تلقائياً عند تحميل المكون أو تغيير التواريخ
  // (السلوك الحالي — لا يعمل في وضع "يبدأ من تاريخ الإصدار" حيث المدة قيمة
  // مستقلة يدخلها المستخدم ولا تُحسب من الفرق بين التاريخين)
  useEffect(() => {
    if (formData.dateMode === 'issue_date') return
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
  }, [formData.admissionDate, formData.dischargeDate, formData.dateMode])

  // في وضع "يبدأ من تاريخ الإصدار": تاريخا الدخول والخروج = تاريخ الإصدار
  // دائماً، ومدة الإجازة تبقى القيمة المستقلة التي أدخلها المستخدم (لا تُمس هنا).
  useEffect(() => {
    if (formData.dateMode !== 'issue_date') return
    if (!formData.issueDate) return
    setFormData(prev => (
      prev.admissionDate === prev.issueDate && prev.dischargeDate === prev.issueDate
        ? prev
        : {
            ...prev,
            admissionDate: prev.issueDate,
            dischargeDate: prev.issueDate,
            startDate: prev.issueDate,
            endDate: prev.issueDate
          }
    ))
  }, [formData.dateMode, formData.issueDate])

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
    // الحقول المطلوبة يصفها القالب نفسه في src/config/documentTypes.js،
    // فلا توجد هنا أي قائمة متفرّعة تُنسى عند إضافة قالب جديد.
    const requiredFields = docType.requiredFields

    // Validation for Leave ID: PSL261+8digits OR GSL261+9digits
    if (formData.leaveId && !/^(PSL261\d{8}|GSL261\d{9})$/.test(formData.leaveId)) {
      newErrors.leaveId = 'رقم الإجازة يجب أن يكون PSL261+8 أرقام أو GSL261+9 أرقام'
    }

    // Validation for Service Number: PSL261+8digits OR GSL261+9digits
    if (formData.serviceNum && !/^(PSL261\d{8}|GSL261\d{9})$/.test(formData.serviceNum)) {
      newErrors.serviceNum = 'رقم الخدمة يجب أن يكون PSL261+8 أرقام أو GSL261+9 أرقام'
    }

    // رقم الجوال اختياري — لكن إن أُدخل يجب ألا يتجاوز 30 حرفًا (مطابقة لحد الخادم)
    if (formData.phone && formData.phone.trim().length > 30) {
      newErrors.phone = 'رقم الجوال يجب أن يكون أقل من 30 حرفًا'
    }

    Object.keys(requiredFields).forEach(field => {
      if (!formData[field] || formData[field].toString().trim() === '') {
        newErrors[field] = requiredFields[field]
      }
    })

    // التحقق من أن المدة تم حسابها تلقائياً (الإجازة المرضية فقط — المشهد لا يحوي مدة)
    if (feat.leaveDuration && (!formData.duration || formData.duration === '0')) {
      newErrors.duration = 'يرجى تحديد تاريخ الدخول والخروج لحساب المدة'
    }

    // Date validations
    if (formData.admissionDate && formData.dischargeDate) {
      if (new Date(formData.admissionDate) > new Date(formData.dischargeDate)) {
        newErrors.dischargeDate = 'تاريخ الخروج يجب أن يكون بعد تاريخ الدخول'
      }
    }

    if (feat.leaveDuration && formData.startDate && formData.endDate) {
      if (new Date(formData.startDate) > new Date(formData.endDate)) {
        newErrors.endDate = 'تاريخ نهاية الإجازة يجب أن يكون بعد تاريخ البداية'
      }
    }

    // المشهد: وقت الخروج يجب أن يكون بعد وقت الدخول في نفس اليوم
    if (isVisitLike && formData.admissionDate && formData.dischargeDate &&
        formData.admissionTime && formData.dischargeTime &&
        formData.admissionDate === formData.dischargeDate &&
        formData.admissionTime > formData.dischargeTime) {
      newErrors.dischargeTime = 'وقت الخروج يجب أن يكون بعد وقت الدخول'
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
          phone: record.phone || '',
          name: record.name_en || '',
          nameArabic: record.name_ar || '',
          leaveId: record.leave_id || '',
          nationality: normalizeNationality(record.country?.country_name_ar || record.nationality),
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
          addQr: record.add_qr !== false,
          dateMode: record.date_mode === 'issue_date' ? 'issue_date' : 'actual',
          footerLogo: record.footer_logo
            ? (record.footer_logo.startsWith('http') || record.footer_logo.startsWith('data:') ? record.footer_logo : `${API_BASE_URL}${record.footer_logo}`)
            : '',
          reportTime: parsePdfReportTime(record.report_time),
          reportDate: parsePdfReportDate(record.report_date),
          // حقول «مشهد مراجعة لمرافق» — فارغة للسجلات القديمة
          admissionTime: parsePdfReportTime(record.admission_time),
          dischargeTime: parsePdfReportTime(record.discharge_time),
          relationArabic: record.relation_ar || '',
          relationEnglish: record.relation_en || '',
          visitTypeArabic: record.visit_type_ar || '',
          visitTypeEnglish: record.visit_type_en || ''
        })
        setDocumentType(normalizeDocumentType(record.document_type))
        setIsEditMode(true)
        setOriginalServiceNum(record.service_num || '')
        setOriginalLeaveId(record.leave_id || '')
        setMessage('تم العثور على السجل وتحميله للتعديل')
        setActiveTab('form')
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

  // Handle AI text extraction — يُستدعى يدوياً من الزر أو تلقائياً عند اللصق
  const handleAIExtract = async (e, textOverride) => {
    if (e) e.preventDefault()
    const sourceText = textOverride ?? aiText

    if (!sourceText.trim()) {
      setAiError('يرجى إدخال معلومات العميل')
      return
    }

    setAiLoading(true)
    setAiError('')
    setAiSuccess(false)
    setMessage('')

    try {
      // استخدام الـ API المحلي
      const response = await fetch(`${API_URL}/ai-extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ clientInfo: sourceText })
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

        // عدّ الحقول المستخرجة فعلاً (غير الفارغة) لعرضها في شاشة النجاح
        const filledCount = Object.values(sanitizedData).filter(v => v && String(v).trim() !== '').length

        // Merge AI data with existing formData
        setFormData(prev => {
          const merged = {
            ...prev,
            ...sanitizedData,
            // الجنسية المستخرَجة تُوحَّد قبل وضعها في النموذج، فلا يصل «سعودي»
            // إلى الحقل حتى لو طابق صفاً بهذا الاسم في قائمة الدول.
            nationality: normalizeNationality(finalNationality || prev.nationality),
            // Special handling for dates that might have different names in AI output
            startDate: sanitizedData.startDate || sanitizedData.admissionDate || prev.startDate || '',
            endDate: sanitizedData.endDate || sanitizedData.dischargeDate || prev.endDate || '',
            duration: sanitizedData.duration || prev.duration || '',
          }
          // توليد رقم الخدمة تلقائياً إن لم يوجد — النموذج يصبح جاهزاً للحفظ فوراً
          if (!merged.serviceNum || !String(merged.serviceNum).trim()) {
            const autoId = generateId(serviceNumType)
            merged.serviceNum = autoId
            merged.leaveId = autoId
          }
          return merged
        })
        setIsEditMode(false)
        setAiFieldsFilled(filledCount)
        setAiSuccess(true)
        setMessage('')
        // ذاكرة العميل: إن كانت الهوية المستخرجة لعميل معروف تُكمَّل بياناته المتكررة
        if (sanitizedData.nationalID) lookupClient(sanitizedData.nationalID)
      } else {
        setAiError(data.message || data.error || 'فشل في استخراج البيانات')
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
    if (aiSuccess) setAiSuccess(false)
  }

  // الاستخراج التلقائي: بمجرد اللصق يبدأ الاستخراج فوراً دون أي ضغطة زر
  const handleAIPaste = (e) => {
    const pasted = e.clipboardData?.getData('text') || ''
    if (!pasted.trim()) return
    const target = e.target
    // ننتظر دورة واحدة حتى يلتصق النص في الحقل ثم نستخرج القيمة الكاملة
    setTimeout(() => {
      const fullText = target.value
      setAiText(fullText)
      if (fullText.trim().length >= 20) {
        handleAIExtract(null, fullText)
      }
    }, 0)
  }

  // بعد نجاح الاستخراج: انتقال تلقائي سلس إلى تبويب النموذج بعد لحظة الاحتفال
  useEffect(() => {
    if (!aiSuccess) return
    const t = setTimeout(() => {
      setActiveTab('form')
      setAiSuccess(false)
      setAiText('')
    }, 1800)
    return () => clearTimeout(t)
  }, [aiSuccess])

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
        phone: formData.phone,
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
        nationality: normalizeNationality(formData.nationality),
        countryId: countryId,
        hospital_name_en: formData.hospitalNameEnglish,
        hospital_name_ar: formData.hospitalNameArabic,
        license_number: formData.licenseNumber || '1410845906',
        show_license_number: formData.showLicenseNumber,
        // QR وطريقة التاريخ — الإجازة المرضية فقط. غير مفعّلَين لبقية القوالب
        // فتُرسَل قيمهما الافتراضية دون أي أثر (لا يقرأهما مولّد PDF الآخر).
        add_qr: formData.addQr,
        date_mode: docType.features.dateMode ? formData.dateMode : 'actual',
        leave_days: (docType.features.dateMode && formData.dateMode === 'issue_date')
          ? (parseInt(formData.duration, 10) || null)
          : null,
        report_time: formatTimeForPDF(formData.reportTime),
        report_date: formatDateForPDF(formData.reportDate),
        footer_logo: formData.footerLogo || null,
        // نوع المستند وحقوله الخاصة. كل حقل يُرسل فقط إن كان القالب المختار
        // يفعّله، وإلا يُرسل فارغاً — فالإجازة المرضية تبقى كما كانت بالضبط.
        document_type: documentType,
        admission_time: feat.times ? (formatTimeForPDF(formData.admissionTime) || '') : '',
        discharge_time: feat.times ? (formatTimeForPDF(formData.dischargeTime) || '') : '',
        relation_en: feat.relation ? formData.relationEnglish : '',
        relation_ar: feat.relation ? formData.relationArabic : '',
        visit_type_en: feat.visitType ? formData.visitTypeEnglish : '',
        visit_type_ar: feat.visitType ? formData.visitTypeArabic : ''
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
        const docLabel = labels.docLabel
        const successMsg = isEditMode ? `تم تحديث ${docLabel} بنجاح` : `تم إنشاء ${docLabel} بنجاح`
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
          phone: '',
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
          addQr: true,
          dateMode: 'actual',
          admissionDateAr: '',
          dischargeDateAr: '',
          reportTime: '',
          reportDate: '',
          footerLogo: '',
          ...COMPANION_FIELD_DEFAULTS
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
      phone: '',
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
      addQr: true,
      dateMode: 'actual',
      admissionDateAr: '',
      dischargeDateAr: '',
      reportTime: '',
      reportDate: '',
      footerLogo: '',
      ...COMPANION_FIELD_DEFAULTS
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
    setAiSuccess(false)
    setAiFieldsFilled(0)
    setOriginalServiceNum('')
    setOriginalLeaveId('')
    setActiveTab('ai')
    lastLookedUpId.current = ''
    setClientMemo(null)
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
          phone: formData.phone,
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
          add_qr: formData.addQr,
          date_mode: docType.features.dateMode ? formData.dateMode : 'actual',
          leave_days: (docType.features.dateMode && formData.dateMode === 'issue_date')
            ? (parseInt(formData.duration, 10) || null)
            : null,

          admission_date_en: formData.admissionDate,
          discharge_date_en: formData.dischargeDate,
          admission_date_ar: formData.admissionDateAr || leaveData?.admission_date_ar || '', // استخدام التاريخ الهجري المحفوظ
          discharge_date_ar: formData.dischargeDateAr || leaveData?.discharge_date_ar || '', // استخدام التاريخ الهجري المحفوظ
          issue_date: formData.issueDate,

          report_date: formData.reportDate ? formatDateForPDF(formData.reportDate) : null,
          report_time: formData.reportTime ? formatTimeForPDF(formData.reportTime) : null,

          nationality: normalizeNationality(formData.nationality),
          country: {
            country_name_ar: normalizeNationality(formData.nationality),
            country_name_en: countryNameEn
          },
          footer_logo: formData.footerLogo || null,

          // تُقرأ من مكوّنات المعاينة (مشهد مراجعة / مشهد مراجعة لمرافق)
          document_type: documentType,
          admission_time: feat.times ? (formatTimeForPDF(formData.admissionTime) || '') : '',
          discharge_time: feat.times ? (formatTimeForPDF(formData.dischargeTime) || '') : '',
          relation_en: feat.relation ? formData.relationEnglish : '',
          relation_ar: feat.relation ? formData.relationArabic : '',
          visit_type_en: feat.visitType ? formData.visitTypeEnglish : '',
          visit_type_ar: feat.visitType ? formData.visitTypeArabic : ''
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

  // نسبة اكتمال النموذج — تُعرض كحلقة تقدم حية في شريط التبويبات
  const REQUIRED_KEYS = Object.keys(docType.requiredFields)
  const filledRequired = REQUIRED_KEYS.filter(k => formData[k] && String(formData[k]).trim() !== '').length
  const completionPct = Math.round((filledRequired / REQUIRED_KEYS.length) * 100)

  // فترة الانتظار الحية للمشهد — نفس الحساب المستخدم في المعاينة وملف الـ PDF.
  const companionWaiting = calcWaitingPeriod(
    formData.admissionDate, formData.admissionTime,
    formData.dischargeDate, formData.dischargeTime
  )

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
      {/* Compact Header */}
      <div className={styles.compactHeader}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🏔️</span>
          <span className={styles.logoText}>الجبل</span>
        </div>
        <div className={styles.headerMeta}>
          <h1 className={styles.compactTitle}>{labels.pageTitle}</h1>
          {isEditMode && <span className={styles.editBadge}>✏️ وضع التعديل</span>}
        </div>
        {/* حلقة اكتمال النموذج الحية */}
        <div className={styles.progressRing} title={`اكتمال النموذج ${completionPct}%`}>
          <svg viewBox="0 0 44 44" width="52" height="52">
            <circle cx="22" cy="22" r="19" fill="none" stroke="#e2e8f0" strokeWidth="4" />
            <circle
              cx="22" cy="22" r="19" fill="none"
              stroke={completionPct === 100 ? '#10b981' : '#7c3aed'}
              strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${(completionPct / 100) * 119.4} 119.4`}
              transform="rotate(-90 22 22)"
              style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.3s ease' }}
            />
          </svg>
          <span className={styles.progressPct}>{completionPct === 100 ? '✓' : `${completionPct}%`}</span>
        </div>
      </div>

      {/* ═══════════ Tab Bar ═══════════ */}
      <div className={styles.tabBar}>
        <button
          type="button"
          className={`${styles.tabBtn} ${styles.tabBtnAi} ${activeTab === 'ai' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          <span className={styles.tabIcon}>✨</span>
          <span className={styles.tabLabel}>الاستخراج الذكي</span>
          <span className={styles.tabHint}>الصق وانتهى</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'form' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('form')}
        >
          <span className={styles.tabIcon}>📋</span>
          <span className={styles.tabLabel}>النموذج</span>
          {filledRequired > 0 && (
            <span className={styles.tabCounter}>{filledRequired}/{REQUIRED_KEYS.length}</span>
          )}
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'search' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('search')}
        >
          <span className={styles.tabIcon}>🔍</span>
          <span className={styles.tabLabel}>بحث وتعديل</span>
        </button>
      </div>

      {/* ═══════════ AI Tab — النجم ═══════════ */}
      {activeTab === 'ai' && (
        <div className={styles.aiHero}>
          <div className={styles.aiHeroGlow} aria-hidden="true" />
          {aiSuccess ? (
            <div className={styles.aiCelebration}>
              <div className={styles.aiCelebrationIcon}>🎯</div>
              <h2 className={styles.aiCelebrationTitle}>تم الاستخراج!</h2>
              <p className={styles.aiCelebrationText}>
                عُبّئ <strong>{aiFieldsFilled}</strong> حقلاً تلقائياً — جارٍ نقلك إلى النموذج...
              </p>
              <div className={styles.aiCelebrationBar}><span /></div>
            </div>
          ) : aiLoading ? (
            <div className={styles.aiThinking}>
              <div className={styles.aiOrb}>
                <span /><span /><span />
              </div>
              <h2 className={styles.aiThinkingTitle}>الذكاء الاصطناعي يقرأ البيانات...</h2>
              <p className={styles.aiThinkingText}>يستخرج الاسم، الهوية، التواريخ، الطبيب، المستشفى...</p>
            </div>
          ) : (
            <>
              <div className={styles.aiHeroHead}>
                <span className={styles.aiSpark}>✨</span>
                <h2 className={styles.aiHeroTitle}>الصق أي نص — واترك الباقي علينا</h2>
                <p className={styles.aiHeroSub}>
                  رسالة واتساب، ورقة مستشفى، ملاحظات… أي صيغة كانت.
                  <br />
                  <strong>الاستخراج يبدأ تلقائياً لحظة اللصق</strong> — بدون أي ضغطة زر.
                </p>
              </div>

              <div className={styles.aiPasteZone}>
                <textarea
                  className={styles.aiPasteArea}
                  id="aiClientInfo"
                  name="aiClientInfo"
                  value={aiText}
                  onChange={handleAIChange}
                  onPaste={handleAIPaste}
                  placeholder={'الصق معلومات العميل هنا...\n\nمثال:\nالاسم: أحمد محمد العتيبي\nالهوية: 1098765432\nدخول 2026-07-25 وخروج 2026-07-27\nد. خالد السالم — مستشفى النور'}
                  rows="9"
                  autoFocus
                />
                <div className={styles.aiPasteFooter}>
                  <span className={styles.aiPasteHint}>
                    ⌨️ Ctrl+V {aiText.trim() ? `· ${aiText.trim().length} حرف` : ''}
                  </span>
                  <button
                    type="button"
                    className={styles.aiExtractBtn}
                    onClick={() => handleAIExtract(null)}
                    disabled={aiLoading || !aiText.trim()}
                  >
                    ✨ استخراج الآن
                  </button>
                </div>
              </div>

              {aiError && (
                <div className={styles.aiErrorBox}>
                  <span>⚠️ {aiError}</span>
                  <button type="button" onClick={() => handleAIExtract(null)}>إعادة المحاولة</button>
                </div>
              )}

              <div className={styles.aiTrustRow}>
                <span>🔒 لا يُحفظ النص</span>
                <span>⚡ أسرع ١٠ مرات من الإدخال اليدوي</span>
                <span>🎯 يفهم العربية والإنجليزية</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════ Search Tab ═══════════ */}
      {activeTab === 'search' && (
        <div className={styles.searchSection}>
          <h2 className={styles.searchTitle}>🔍 البحث عن إجازة مرضية موجودة</h2>
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
      )}

      {/* ═══════════ Form Tab ═══════════ */}
      <div className={styles.formContainer} style={{ display: activeTab === 'form' ? undefined : 'none' }}>
        <form onSubmit={handleSubmit} className={styles.slForm}>
          {/* نوع المستند (القالب) — الخيارات تأتي من سجلّ القوالب مباشرةً */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="documentType">
              نوع المستند *
            </label>
            <select
              className={styles.inputField}
              id="documentType"
              name="documentType"
              value={documentType}
              onChange={(e) => {
                setDocumentType(normalizeDocumentType(e.target.value))
                setErrors({})
              }}
              style={{
                fontFamily: 'inherit',
                fontWeight: 700,
                background: documentType === DEFAULT_DOCUMENT_TYPE ? '#eef6ff' : '#f8fafc'
              }}
            >
              {DOCUMENT_TYPE_LIST.map((t) => (
                <option key={t.key} value={t.key}>{t.optionLabel}</option>
              ))}
            </select>
            <small className={styles.helpText}>
              {`سيتم إصدار مستند «${docType.titleAr} (${docType.titleEn})»`}
            </small>
            {/* القوالب المعلَّمة كنماذج تصميم في السجلّ تعرّف نفسها هنا صراحةً،
                فلا يظن المستخدم أن المخرَج مستند رسمي. */}
            {docType.isMockup && (
              <small className={styles.helpText} style={{ color: '#92400e', fontWeight: 700 }}>
                {`🧩 ${docType.mockupNotice}`}
              </small>
            )}
          </div>

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
              onBlur={(e) => lookupClient(e.target.value)}
              inputMode="numeric"
              required
            />
            {errors.nationalID && (
              <span className={styles.errorMessage}>{errors.nationalID}</span>
            )}
            {clientMemo && clientMemo.applied > 0 && (
              <span style={{ display: 'block', marginTop: 6, fontSize: 13, color: '#15803d' }}>
                ✓ عميل معروف — طلباته السابقة: {clientMemo.previousRequests}. عُبّئت {clientMemo.applied} من حقوله تلقائياً.
              </span>
            )}
          </div>

          {/* Customer Phone (WhatsApp) */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="phone">
              رقم جوال الزبون (واتساب)
            </label>
            <input
              className={styles.inputField}
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="مثال: 9665xxxxxxxx أو 05xxxxxxxx"
              inputMode="tel"
              dir="ltr"
              maxLength={30}
            />
            {errors.phone && (
              <span className={styles.errorMessage}>{errors.phone}</span>
            )}
          </div>

          {/* Name (English) */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="name">
              {labels.nameEn}
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
              {labels.nameAr}
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
            <NationalityPicker
              value={formData.nationality}
              options={countries}
              token={token}
              error={!!errors.nationality}
              onSelect={(ar) => setFormData(prev => ({ ...prev, nationality: ar }))}
              onOptionsChanged={refetchCountries}
            />
            {errors.nationality && (
              <span className={styles.errorMessage}>{errors.nationality}</span>
            )}
          </div>

          {/* Relation — مشهد مراجعة لمرافق فقط */}
          {feat.relation && (
            <>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="relationArabic">
                  صلة القرابة (بالعربية) *
                </label>
                <input
                  className={styles.inputField}
                  type="text"
                  id="relationArabic"
                  name="relationArabic"
                  value={formData.relationArabic}
                  onChange={handleChange}
                  list="relations-ar-list"
                  placeholder="مثال: ابن"
                  required
                />
                <datalist id="relations-ar-list">
                  <option value="ابن" />
                  <option value="ابنة" />
                  <option value="أب" />
                  <option value="أم" />
                  <option value="زوج" />
                  <option value="زوجة" />
                  <option value="أخ" />
                  <option value="أخت" />
                </datalist>
                {errors.relationArabic && (
                  <span className={styles.errorMessage}>{errors.relationArabic}</span>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="relationEnglish">
                  صلة القرابة (بالإنجليزية) *
                </label>
                <input
                  className={styles.inputField}
                  type="text"
                  id="relationEnglish"
                  name="relationEnglish"
                  value={formData.relationEnglish}
                  onChange={handleChange}
                  list="relations-en-list"
                  placeholder="Son"
                  dir="ltr"
                  required
                />
                <datalist id="relations-en-list">
                  <option value="Son" />
                  <option value="Daughter" />
                  <option value="Father" />
                  <option value="Mother" />
                  <option value="Husband" />
                  <option value="Wife" />
                  <option value="Brother" />
                  <option value="Sister" />
                </datalist>
                {errors.relationEnglish && (
                  <span className={styles.errorMessage}>{errors.relationEnglish}</span>
                )}
              </div>
            </>
          )}

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

          {/* طريقة التاريخ + الباركود — تظهران للقوالب التي تعلن دعمهما في
              سجلّ القوالب (features.dateMode / features.qr) بدل ربطهما بقالب
              بعينه، فأي قالب يدعمهما يحصل عليهما تلقائياً. */}
          {docType.features.dateMode && (
            <div className={styles.fieldGroup}>
              <label className={styles.label}>طريقة التاريخ</label>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '4px' }}>
                <label className={styles.checkboxLabel} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="dateMode"
                    value="actual"
                    checked={formData.dateMode !== 'issue_date'}
                    onChange={() => setFormData(prev => ({ ...prev, dateMode: 'actual' }))}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.95rem', color: '#374151' }}>التاريخ الفعلي</span>
                </label>
                <label className={styles.checkboxLabel} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="dateMode"
                    value="issue_date"
                    checked={formData.dateMode === 'issue_date'}
                    onChange={() => setFormData(prev => ({ ...prev, dateMode: 'issue_date' }))}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.95rem', color: '#374151' }}>يبدأ من تاريخ الإصدار</span>
                </label>
              </div>
              {formData.dateMode === 'issue_date' && (
                <small className={styles.helpText}>
                  سيتم ضبط تاريخي الدخول والخروج تلقائياً على تاريخ الإصدار، وتبقى مدة الإجازة القيمة التي تُدخلها
                </small>
              )}
            </div>
          )}

          {docType.features.qr && (
            <div className={styles.fieldGroup}>
              <label className={styles.checkboxLabel} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="addQr"
                  checked={formData.addQr}
                  onChange={(e) => setFormData(prev => ({ ...prev, addQr: e.target.checked }))}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.95rem', color: '#374151' }}>إضافة QR</span>
              </label>
            </div>
          )}

          {/* Admission Date */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="admissionDate">
              {labels.admissionDate}
            </label>
            <input
              className={styles.inputField}
              type="date"
              id="admissionDate"
              name="admissionDate"
              value={formData.admissionDate}
              onChange={handleChange}
              readOnly={formData.dateMode === 'issue_date'}
              style={formData.dateMode === 'issue_date' ? { backgroundColor: '#f8fafc', cursor: 'not-allowed' } : undefined}
              required
            />
            {errors.admissionDate && (
              <span className={styles.errorMessage}>{errors.admissionDate}</span>
            )}
            <small className={styles.helpText}>
              {formData.dateMode === 'issue_date'
                ? 'يُضبط تلقائياً على تاريخ الإصدار'
                : 'سيتم تحويل التاريخ تلقائياً إلى التقويم الهجري'}
            </small>
          </div>

          {/* Admission Time — قوالب مشهد المراجعة فقط */}
          {feat.times && (
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="admissionTime">
                🕐 وقت الدخول *
              </label>
              <input
                className={styles.inputField}
                type="time"
                id="admissionTime"
                name="admissionTime"
                value={formData.admissionTime}
                onChange={handleChange}
                required
              />
              {errors.admissionTime && (
                <span className={styles.errorMessage}>{errors.admissionTime}</span>
              )}
            </div>
          )}

          {/* Discharge Date */}
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="dischargeDate">
              {labels.dischargeDate}
            </label>
            <input
              className={styles.inputField}
              type="date"
              id="dischargeDate"
              name="dischargeDate"
              value={formData.dischargeDate}
              onChange={handleChange}
              readOnly={formData.dateMode === 'issue_date'}
              style={formData.dateMode === 'issue_date' ? { backgroundColor: '#f8fafc', cursor: 'not-allowed' } : undefined}
              required
            />
            {errors.dischargeDate && (
              <span className={styles.errorMessage}>{errors.dischargeDate}</span>
            )}
            <small className={styles.helpText}>
              {formData.dateMode === 'issue_date'
                ? 'يُضبط تلقائياً على تاريخ الإصدار'
                : 'سيتم تحويل التاريخ تلقائياً إلى التقويم الهجري'}
            </small>
          </div>

          {/* Discharge Time + Waiting Period — قوالب مشهد المراجعة فقط */}
          {feat.times && (
            <>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="dischargeTime">
                  🕐 وقت الخروج *
                </label>
                <input
                  className={styles.inputField}
                  type="time"
                  id="dischargeTime"
                  name="dischargeTime"
                  value={formData.dischargeTime}
                  onChange={handleChange}
                  required
                />
                {errors.dischargeTime && (
                  <span className={styles.errorMessage}>{errors.dischargeTime}</span>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="waitingPeriod">
                  فترة الانتظار (تحسب تلقائياً)
                </label>
                <input
                  className={`${styles.inputField} ${styles.readOnlyInput}`}
                  type="text"
                  id="waitingPeriod"
                  value={companionWaiting.ar}
                  readOnly
                  style={{ backgroundColor: '#f8fafc', cursor: 'not-allowed' }}
                />
                <small className={styles.helperText}>
                  ⚡ تُحسب من تاريخ ووقت الدخول والخروج — {companionWaiting.en}
                </small>
              </div>
            </>
          )}

          {/* Start Date — الإجازة المرضية فقط */}
          {feat.leaveDuration && (
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
                readOnly={formData.dateMode === 'issue_date'}
                style={formData.dateMode === 'issue_date' ? { backgroundColor: '#f8fafc', cursor: 'not-allowed' } : undefined}
                required
              />
              {errors.startDate && (
                <span className={styles.errorMessage}>{errors.startDate}</span>
              )}
            </div>
          )}

          {/* End Date — الإجازة المرضية فقط */}
          {feat.leaveDuration && (
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
                readOnly={formData.dateMode === 'issue_date'}
                style={formData.dateMode === 'issue_date' ? { backgroundColor: '#f8fafc', cursor: 'not-allowed' } : undefined}
                required
              />
              {errors.endDate && (
                <span className={styles.errorMessage}>{errors.endDate}</span>
              )}
            </div>
          )}

          {/* Duration — الإجازة المرضية فقط */}
          {feat.leaveDuration && (
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="duration">
                {formData.dateMode === 'issue_date' ? 'المدة بالأيام *' : 'المدة بالأيام * (تحسب تلقائياً)'}
              </label>
              <input
                className={formData.dateMode === 'issue_date' ? styles.inputField : `${styles.inputField} ${styles.readOnlyInput}`}
                type="number"
                id="duration"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                placeholder="سيتم حسابها تلقائياً"
                readOnly={formData.dateMode !== 'issue_date'}
                min={formData.dateMode === 'issue_date' ? 1 : undefined}
                style={formData.dateMode === 'issue_date' ? undefined : { backgroundColor: '#f8fafc', cursor: 'not-allowed' }}
              />
              <small className={styles.helperText}>
                {formData.dateMode === 'issue_date'
                  ? '✏️ أدخل مدة الإجازة يدوياً — مستقلة عن تاريخي الدخول والخروج'
                  : '⚡ يتم حساب المدة تلقائياً من تاريخ الدخول والخروج'}
              </small>
              {errors.duration && (
                <span className={styles.errorMessage}>{errors.duration}</span>
              )}
            </div>
          )}

          {/* Doctor Name (English) */}
          <div className={styles.fieldGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className={styles.label} htmlFor="doctorName">
                {labels.practitionerEn}
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
                {labels.practitionerAr}
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
                {labels.facilityAr}
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
                {labels.facilityEn}
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
              {labels.positionEn}
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
              {labels.positionAr}
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

          {/* Visit Type — قوالب مشهد المراجعة فقط */}
          {feat.visitType && (
            <>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="visitTypeArabic">
                  نوع الزيارة (بالعربية) *
                </label>
                <input
                  className={styles.inputField}
                  type="text"
                  id="visitTypeArabic"
                  name="visitTypeArabic"
                  value={formData.visitTypeArabic}
                  onChange={handleChange}
                  list="visit-types-ar-list"
                  placeholder="مثال: عيادات"
                  required
                />
                <datalist id="visit-types-ar-list">
                  <option value="عيادات" />
                  <option value="طوارئ" />
                  <option value="تنويم" />
                  <option value="عيادات خارجية" />
                </datalist>
                {errors.visitTypeArabic && (
                  <span className={styles.errorMessage}>{errors.visitTypeArabic}</span>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="visitTypeEnglish">
                  نوع الزيارة (بالإنجليزية) *
                </label>
                <input
                  className={styles.inputField}
                  type="text"
                  id="visitTypeEnglish"
                  name="visitTypeEnglish"
                  value={formData.visitTypeEnglish}
                  onChange={handleChange}
                  list="visit-types-en-list"
                  placeholder="OutPatient"
                  dir="ltr"
                  required
                />
                <datalist id="visit-types-en-list">
                  <option value="OutPatient" />
                  <option value="Emergency" />
                  <option value="InPatient" />
                </datalist>
                {errors.visitTypeEnglish && (
                  <span className={styles.errorMessage}>{errors.visitTypeEnglish}</span>
                )}
              </div>
            </>
          )}

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
              {isEditMode ? `تحديث ${labels.docLabel}` : `إنشاء ${labels.docLabel}`}
            </button>

            {isEditMode && (
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => setShowDeleteModal(true)}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'جاري الحذف...' : labels.deleteLabel}
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

      {/* PDF Modal — مكوّن المعاينة يُحدَّد من سجلّ القوالب حسب نوع المستند */}
      {showPdfModal && pdfData && (() => {
        const PreviewComponent = getDocumentType(pdfData.document_type).previewComponent
        return <PreviewComponent data={pdfData} onClose={() => setShowPdfModal(false)} />
      })()}

      {/* Media Picker Modal */}
      <MediaPicker
        isOpen={showMediaPicker}
        onClose={() => setShowMediaPicker(false)}
        onSelect={(media) => {
          // استخدام رابط الصورة من المعرض
          const imageUrl = media.url.startsWith('http') || media.url.startsWith('data:') ? media.url : `${API_BASE_URL}${media.url}`
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

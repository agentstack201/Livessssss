import { useState } from 'react'
import { Link } from 'react-router-dom'
import styles from '../styles/CVForm.module.css'

function CVForm({ initialData = {}, onSubmit, loading, submitText = 'حفظ' }) {
  const [formData, setFormData] = useState({
    // Personal Information
    full_name: initialData.full_name || '',
    job_title: initialData.job_title || '',
    email: initialData.email || '',
    phone: initialData.phone || '',
    address: initialData.address || '',
    date_of_birth: initialData.date_of_birth || '',
    nationality: initialData.nationality || 'سعودي',
    
    // Professional Summary
    summary: initialData.summary || '',
    
    // Experience (JSON array)
    experience: initialData.experience || [],
    
    // Education (JSON array)
    education: initialData.education || [],
    
    // Skills (JSON array)
    skills: initialData.skills || [],
    
    // Languages (JSON array)
    languages: initialData.languages || [],
    
    // Certifications (JSON array)
    certifications: initialData.certifications || []
  })

  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  // Experience Management
  const addExperience = () => {
    setFormData(prev => ({
      ...prev,
      experience: [...prev.experience, {
        company: '',
        position: '',
        start_date: '',
        end_date: '',
        description: '',
        current: false
      }]
    }))
  }

  const removeExperience = (index) => {
    setFormData(prev => ({
      ...prev,
      experience: prev.experience.filter((_, i) => i !== index)
    }))
  }

  const updateExperience = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      experience: prev.experience.map((exp, i) => 
        i === index ? { ...exp, [field]: value } : exp
      )
    }))
  }

  // Education Management
  const addEducation = () => {
    setFormData(prev => ({
      ...prev,
      education: [...prev.education, {
        institution: '',
        degree: '',
        field: '',
        start_date: '',
        end_date: '',
        grade: ''
      }]
    }))
  }

  const removeEducation = (index) => {
    setFormData(prev => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index)
    }))
  }

  const updateEducation = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      education: prev.education.map((edu, i) => 
        i === index ? { ...edu, [field]: value } : edu
      )
    }))
  }

  // Skills Management
  const addSkill = () => {
    const skill = prompt('أدخل المهارة:')
    if (skill && skill.trim()) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, skill.trim()]
      }))
    }
  }

  const removeSkill = (index) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index)
    }))
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.full_name.trim()) newErrors.full_name = 'الاسم الكامل مطلوب'
    if (!formData.job_title.trim()) newErrors.job_title = 'المسمى الوظيفي مطلوب'
    if (!formData.email.trim()) newErrors.email = 'البريد الإلكتروني مطلوب'
    if (!formData.phone.trim()) newErrors.phone = 'رقم الهاتف مطلوب'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validateForm()) {
      onSubmit(formData)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {/* Personal Information Section */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>📋 المعلومات الشخصية</h2>
        
        <div className={styles.row}>
          <div className={styles.field}>
            <label>الاسم الكامل *</label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              placeholder="أدخل الاسم الكامل"
            />
            {errors.full_name && <span className={styles.error}>{errors.full_name}</span>}
          </div>

          <div className={styles.field}>
            <label>المسمى الوظيفي *</label>
            <input
              type="text"
              name="job_title"
              value={formData.job_title}
              onChange={handleChange}
              placeholder="مثال: مطور برمجيات"
            />
            {errors.job_title && <span className={styles.error}>{errors.job_title}</span>}
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label>البريد الإلكتروني *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="example@email.com"
            />
            {errors.email && <span className={styles.error}>{errors.email}</span>}
          </div>

          <div className={styles.field}>
            <label>رقم الهاتف *</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="05xxxxxxxx"
            />
            {errors.phone && <span className={styles.error}>{errors.phone}</span>}
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.field}>
            <label>العنوان</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="المدينة، المنطقة"
            />
          </div>

          <div className={styles.field}>
            <label>تاريخ الميلاد</label>
            <input
              type="date"
              name="date_of_birth"
              value={formData.date_of_birth}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label>الجنسية</label>
          <input
            type="text"
            name="nationality"
            value={formData.nationality}
            onChange={handleChange}
            placeholder="سعودي"
          />
        </div>
      </div>

      {/* Professional Summary */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>💼 الملخص المهني</h2>
        <div className={styles.field}>
          <textarea
            name="summary"
            value={formData.summary}
            onChange={handleChange}
            placeholder="اكتب ملخصاً مختصراً عن خبراتك ومهاراتك..."
            rows="5"
          />
        </div>
      </div>

      {/* Experience Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>💼 الخبرات العملية</h2>
          <button type="button" onClick={addExperience} className={styles.addBtn}>
            ➕ إضافة خبرة
          </button>
        </div>

        {formData.experience.map((exp, index) => (
          <div key={index} className={styles.arrayItem}>
            <div className={styles.arrayHeader}>
              <h4>خبرة {index + 1}</h4>
              <button
                type="button"
                onClick={() => removeExperience(index)}
                className={styles.removeBtn}
              >
                🗑️ حذف
              </button>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label>اسم الشركة</label>
                <input
                  type="text"
                  value={exp.company}
                  onChange={(e) => updateExperience(index, 'company', e.target.value)}
                  placeholder="اسم الشركة"
                />
              </div>

              <div className={styles.field}>
                <label>المسمى الوظيفي</label>
                <input
                  type="text"
                  value={exp.position}
                  onChange={(e) => updateExperience(index, 'position', e.target.value)}
                  placeholder="المسمى الوظيفي"
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label>تاريخ البداية</label>
                <input
                  type="date"
                  value={exp.start_date}
                  onChange={(e) => updateExperience(index, 'start_date', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label>تاريخ النهاية</label>
                <input
                  type="date"
                  value={exp.end_date}
                  onChange={(e) => updateExperience(index, 'end_date', e.target.value)}
                  disabled={exp.current}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={exp.current}
                  onChange={(e) => updateExperience(index, 'current', e.target.checked)}
                />
                <span>أعمل حالياً في هذه الوظيفة</span>
              </label>
            </div>

            <div className={styles.field}>
              <label>الوصف</label>
              <textarea
                value={exp.description}
                onChange={(e) => updateExperience(index, 'description', e.target.value)}
                placeholder="اكتب وصفاً للمهام والإنجازات..."
                rows="3"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Education Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>🎓 التعليم</h2>
          <button type="button" onClick={addEducation} className={styles.addBtn}>
            ➕ إضافة مؤهل
          </button>
        </div>

        {formData.education.map((edu, index) => (
          <div key={index} className={styles.arrayItem}>
            <div className={styles.arrayHeader}>
              <h4>مؤهل {index + 1}</h4>
              <button
                type="button"
                onClick={() => removeEducation(index)}
                className={styles.removeBtn}
              >
                🗑️ حذف
              </button>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label>اسم المؤسسة التعليمية</label>
                <input
                  type="text"
                  value={edu.institution}
                  onChange={(e) => updateEducation(index, 'institution', e.target.value)}
                  placeholder="اسم الجامعة أو المعهد"
                />
              </div>

              <div className={styles.field}>
                <label>الدرجة العلمية</label>
                <input
                  type="text"
                  value={edu.degree}
                  onChange={(e) => updateEducation(index, 'degree', e.target.value)}
                  placeholder="بكالوريوس، ماجستير، إلخ"
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label>التخصص</label>
                <input
                  type="text"
                  value={edu.field}
                  onChange={(e) => updateEducation(index, 'field', e.target.value)}
                  placeholder="التخصص الدراسي"
                />
              </div>

              <div className={styles.field}>
                <label>المعدل</label>
                <input
                  type="text"
                  value={edu.grade}
                  onChange={(e) => updateEducation(index, 'grade', e.target.value)}
                  placeholder="المعدل التراكمي"
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label>تاريخ البداية</label>
                <input
                  type="date"
                  value={edu.start_date}
                  onChange={(e) => updateEducation(index, 'start_date', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label>تاريخ التخرج</label>
                <input
                  type="date"
                  value={edu.end_date}
                  onChange={(e) => updateEducation(index, 'end_date', e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Skills Section */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>⚡ المهارات</h2>
          <button type="button" onClick={addSkill} className={styles.addBtn}>
            ➕ إضافة مهارة
          </button>
        </div>

        <div className={styles.skillsGrid}>
          {formData.skills.map((skill, index) => (
            <div key={index} className={styles.skillTag}>
              <span>{skill}</span>
              <button
                type="button"
                onClick={() => removeSkill(index)}
                className={styles.skillRemove}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Form Actions */}
      <div className={styles.actions}>
        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? 'جاري الحفظ...' : submitText}
        </button>
        <Link to="/cv/list" className={styles.cancelBtn}>
          إلغاء
        </Link>
      </div>
    </form>
  )
}

export default CVForm

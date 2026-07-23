import styles from '../styles/CVPreview.module.css'

function CVTemplate({ data }) {
  return (
    <div className={styles.cvTemplate}>
      {/* Header */}
      <div className={styles.cvHeader}>
        <div className={styles.headerContent}>
          <h1 className={styles.cvName}>{data.full_name}</h1>
          <h2 className={styles.cvJobTitle}>{data.job_title}</h2>
        </div>
        <div className={styles.headerContact}>
          <div className={styles.contactItem}>
            <span className={styles.contactIcon}>📧</span>
            <span>{data.email}</span>
          </div>
          <div className={styles.contactItem}>
            <span className={styles.contactIcon}>📱</span>
            <span>{data.phone}</span>
          </div>
          {data.address && (
            <div className={styles.contactItem}>
              <span className={styles.contactIcon}>📍</span>
              <span>{data.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* Professional Summary */}
      {data.summary && (
        <div className={styles.cvSection}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.titleIcon}>💼</span>
            الملخص المهني
          </h3>
          <p className={styles.summary}>{data.summary}</p>
        </div>
      )}

      {/* Experience */}
      {data.experience && data.experience.length > 0 && (
        <div className={styles.cvSection}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.titleIcon}>💼</span>
            الخبرات العملية
          </h3>
          {data.experience.map((exp, index) => (
            <div key={index} className={styles.experienceItem}>
              <div className={styles.expHeader}>
                <div>
                  <h4 className={styles.expPosition}>{exp.position}</h4>
                  <p className={styles.expCompany}>{exp.company}</p>
                </div>
                <div className={styles.expDates}>
                  {exp.start_date && (
                    <span>
                      {new Date(exp.start_date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short' })}
                      {' - '}
                      {exp.current ? 'حتى الآن' : 
                        exp.end_date ? new Date(exp.end_date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short' }) : ''}
                    </span>
                  )}
                </div>
              </div>
              {exp.description && (
                <p className={styles.expDescription}>{exp.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {data.education && data.education.length > 0 && (
        <div className={styles.cvSection}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.titleIcon}>🎓</span>
            التعليم
          </h3>
          {data.education.map((edu, index) => (
            <div key={index} className={styles.educationItem}>
              <div className={styles.eduHeader}>
                <div>
                  <h4 className={styles.eduDegree}>{edu.degree} - {edu.field}</h4>
                  <p className={styles.eduInstitution}>{edu.institution}</p>
                </div>
                <div className={styles.eduDates}>
                  {edu.start_date && (
                    <span>
                      {new Date(edu.start_date).toLocaleDateString('ar-SA', { year: 'numeric' })}
                      {' - '}
                      {edu.end_date ? new Date(edu.end_date).toLocaleDateString('ar-SA', { year: 'numeric' }) : ''}
                    </span>
                  )}
                </div>
              </div>
              {edu.grade && (
                <p className={styles.eduGrade}>المعدل: {edu.grade}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {data.skills && data.skills.length > 0 && (
        <div className={styles.cvSection}>
          <h3 className={styles.sectionTitle}>
            <span className={styles.titleIcon}>⚡</span>
            المهارات
          </h3>
          <div className={styles.skillsGrid}>
            {data.skills.map((skill, index) => (
              <span key={index} className={styles.skillBadge}>
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Personal Info Footer */}
      <div className={styles.cvFooter}>
        {data.date_of_birth && (
          <span>تاريخ الميلاد: {new Date(data.date_of_birth).toLocaleDateString('ar-SA')}</span>
        )}
        {data.nationality && (
          <span>الجنسية: {data.nationality}</span>
        )}
      </div>
    </div>
  )
}

export default CVTemplate

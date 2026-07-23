import { useRef } from 'react'
import html2pdf from 'html2pdf.js'
import styles from '../styles/CVPDFGenerator.module.css'

function CVPDFGenerator({ data, onClose }) {
  const pdfRef = useRef()

  const generatePDF = () => {
    const element = pdfRef.current
    console.log('📄 Generating CV PDF...', data)
    
    if (!element) {
      console.error('❌ PDF element not found!')
      return
    }
    
    const options = {
      margin: 0,
      filename: `CV-${data.full_name}.pdf`,
      enableLinks: true,
      html2canvas: { 
        scale: 4,
        useCORS: true,
        letterRendering: true,
        scrollY: 0,
        scrollX: 0,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: false,
        imageTimeout: 0,
        removeContainer: true
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait',
        compress: false,
        putOnlyUsedFonts: true,
        floatPrecision: 16
      },
      pagebreak: { 
        mode: ['avoid-all', 'css', 'legacy'],
        before: '.page-break-before',
        after: '.page-break-after',
        avoid: ['tr', 'td', 'th', '.cv-section', '.experience-item', '.education-item']
      }
    }

    // Use html2pdf with single page only
    html2pdf()
      .set(options)
      .from(element)
      .toPdf()
      .get('pdf')
      .then(function (pdf) {
        const totalPages = pdf.internal.getNumberOfPages()
        console.log('📄 Total pages:', totalPages)
        
        // Delete extra pages if more than 1
        if (totalPages > 1) {
          for (let i = totalPages; i > 1; i--) {
            pdf.deletePage(i)
          }
          console.log('✂️ Deleted extra pages, keeping only page 1')
        }
      })
      .save()
  }

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short' })
  }

  return (
    <div className={styles.pdfModal}>
      <div className={styles.modalOverlay} onClick={onClose}></div>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>معاينة السيرة الذاتية - PDF</h2>
          <div className={styles.modalActions}>
            <button onClick={generatePDF} className={styles.downloadBtn}>
              📥 تحميل PDF
            </button>
            <button onClick={onClose} className={styles.closeBtn}>✕</button>
          </div>
        </div>

        <div className={styles.pdfPreview}>
          <div ref={pdfRef} className={styles.a4Container}>
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
              
              body {
                font-family: "Cairo", sans-serif;
                margin: 0;
                padding: 0;
                max-height: 297mm;
                height: 297mm;
                overflow: hidden;
                page-break-inside: avoid;
              }
              
              * {
                box-sizing: border-box;
              }
            `}</style>

            <div className={styles.cvDocument}>
              {/* Header - ATS Optimized */}
              <div className={styles.cvHeader}>
                <h1 className={styles.candidateName}>{data.full_name}</h1>
                <h2 className={styles.jobTitle}>{data.job_title}</h2>
                <div className={styles.contactInfo}>
                  <span>📧 {data.email}</span>
                  <span className={styles.separator}>|</span>
                  <span>📱 {data.phone}</span>
                  {data.address && (
                    <>
                      <span className={styles.separator}>|</span>
                      <span>📍 {data.address}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Professional Summary */}
              {data.summary && (
                <div className={styles.cvSection}>
                  <h3 className={styles.sectionTitle}>الملخص المهني</h3>
                  <div className={styles.sectionDivider}></div>
                  <p className={styles.summaryText}>{data.summary}</p>
                </div>
              )}

              {/* Experience */}
              {data.experience && data.experience.length > 0 && (
                <div className={styles.cvSection}>
                  <h3 className={styles.sectionTitle}>الخبرات العملية</h3>
                  <div className={styles.sectionDivider}></div>
                  {data.experience.map((exp, index) => (
                    <div key={index} className={styles.experienceItem}>
                      <div className={styles.itemHeader}>
                        <div className={styles.itemTitle}>
                          <strong>{exp.position}</strong> - {exp.company}
                        </div>
                        <div className={styles.itemDate}>
                          {formatDate(exp.start_date)} - {exp.current ? 'حتى الآن' : formatDate(exp.end_date)}
                        </div>
                      </div>
                      {exp.description && (
                        <p className={styles.itemDescription}>{exp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Education */}
              {data.education && data.education.length > 0 && (
                <div className={styles.cvSection}>
                  <h3 className={styles.sectionTitle}>التعليم</h3>
                  <div className={styles.sectionDivider}></div>
                  {data.education.map((edu, index) => (
                    <div key={index} className={styles.educationItem}>
                      <div className={styles.itemHeader}>
                        <div className={styles.itemTitle}>
                          <strong>{edu.degree}</strong> - {edu.field}
                        </div>
                        <div className={styles.itemDate}>
                          {formatDate(edu.start_date)} - {formatDate(edu.end_date)}
                        </div>
                      </div>
                      <p className={styles.itemSubtitle}>{edu.institution}</p>
                      {edu.grade && (
                        <p className={styles.itemGrade}>المعدل: {edu.grade}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Skills - ATS Friendly */}
              {data.skills && data.skills.length > 0 && (
                <div className={styles.cvSection}>
                  <h3 className={styles.sectionTitle}>المهارات</h3>
                  <div className={styles.sectionDivider}></div>
                  <div className={styles.skillsList}>
                    {data.skills.join(' • ')}
                  </div>
                </div>
              )}

              {/* Personal Information */}
              <div className={styles.cvFooter}>
                {data.date_of_birth && (
                  <span>تاريخ الميلاد: {formatDate(data.date_of_birth)}</span>
                )}
                {data.nationality && (
                  <>
                    {data.date_of_birth && <span className={styles.separator}>|</span>}
                    <span>الجنسية: {data.nationality}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CVPDFGenerator

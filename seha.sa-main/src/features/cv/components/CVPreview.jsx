import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CVTemplate from './CVTemplate'
import CVPDFGenerator from './CVPDFGenerator'
import styles from '../styles/CVPreview.module.css'

function CVPreview({ data, onClose }) {
  const navigate = useNavigate()
  const [showPDFGenerator, setShowPDFGenerator] = useState(false)

  return (
    <div className={styles.modal}>
      <div className={styles.modalOverlay} onClick={onClose}></div>
      
      <div className={styles.modalContent}>
        {/* Header Actions */}
        <div className={styles.modalHeader}>
          <h2>معاينة السيرة الذاتية</h2>
          <div className={styles.headerActions}>
            <button onClick={() => setShowPDFGenerator(true)} className={styles.downloadBtn}>
              📥 تحميل PDF
            </button>
            <button onClick={() => navigate(`/cv/edit/${data.id}`)} className={styles.editBtn}>
              ✏️ تعديل
            </button>
            <button onClick={onClose} className={styles.closeBtn}>
              ✕
            </button>
          </div>
        </div>

        {/* CV Preview */}
        <div className={styles.previewContainer}>
          <div className={styles.a4Page}>
            <CVTemplate data={data} />
          </div>
        </div>
      </div>

      {/* PDF Generator Modal */}
      {showPDFGenerator && (
        <CVPDFGenerator 
          data={data} 
          onClose={() => setShowPDFGenerator(false)} 
        />
      )}
    </div>
  )
}

export default CVPreview

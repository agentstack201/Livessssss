import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Settings.module.css'

// Use environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

function Settings() {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('ai') // ai, general, notifications
    const [apiKey, setApiKey] = useState('')
    const [aiModel, setAiModel] = useState('gemini-2.5-flash')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState(null)

    // Fetch initial settings
    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        setLoading(true)
        try {
            const token = localStorage.getItem('token')
            // Fetch multiple settings
            const responses = await Promise.all([
                fetch(`${API_BASE_URL}/settings/gemini_api_key`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/settings/gemini_model`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            const [keyData, modelData] = await Promise.all(responses.map(r => r.json()));

            if (keyData?.data) setApiKey(keyData.data.value || '')
            if (modelData?.data) setAiModel(modelData.data.value || 'gemini-2.5-flash')
        } catch (err) {
            console.error('Error fetching settings:', err)
            showMessage('failed', 'فشل في الاتصال بالخادم')
        } finally {
            setLoading(false)
        }
    }

    const showMessage = (type, text) => {
        setMessage({ type, text })
        setTimeout(() => setMessage(null), 5000)
    }

    const handleSave = async (e) => {
        e.preventDefault()
        setSaving(true)
        setMessage(null)

        try {
            const token = localStorage.getItem('token')
            // Save API Key
            await fetch(`${API_BASE_URL}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ key: 'gemini_api_key', value: apiKey, description: 'Gemini API Key' })
            })

            // Save Model
            await fetch(`${API_BASE_URL}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ key: 'gemini_model', value: aiModel, description: 'AI Model Version' })
            })

            showMessage('success', 'تم حفظ الإعدادات بنجاح')
            window.showToast?.('تم حفظ الإعدادات بنجاح', 'success')
        } catch (err) {
            console.error('Save error:', err)
            showMessage('error', 'حدث خطأ أثناء الاتصال بالخادم')
        } finally {
            setSaving(false)
        }
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'ai':
                return (
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2>
                                <span style={{ fontSize: '1.5rem' }}>🤖</span>
                                إعدادات الذكاء الاصطناعي
                            </h2>
                            <p>قم بتهيئة نماذج جوجل ومفاتيح الربط لتفعيل ميزات استخراج البيانات تلقائياً.</p>
                        </div>

                        <form onSubmit={handleSave}>
                            <div className={styles.formGroup}>
                                <label>إصدار النموذج (Model)</label>
                                <select
                                    className={styles.input}
                                    value={aiModel}
                                    onChange={(e) => setAiModel(e.target.value)}
                                    style={{ fontFamily: 'Cairo, sans-serif' }}
                                >
                                    <option value="gemini-flash-latest">Gemini Flash Latest (مستقر ومتاح)</option>
                                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (تجريبي)</option>
                                    <option value="gemini-3-flash-preview">Gemini 3.0 Flash (المستقبل!)</option>
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Google Gemini API Key</label>
                                <div className={styles.inputWrapper}>
                                    <input
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="AIzaSy..."
                                        className={styles.input}
                                        dir="ltr"
                                    />
                                    <div className={styles.inputIcon}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                        </svg>
                                    </div>
                                </div>
                                <small className={styles.helpText}>
                                    مفتاح الربط الخاص بـ Google Generative AI. يمكنك الحصول عليه من <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#306db5', fontWeight: 'bold' }}>AI Studio</a>.
                                </small>
                            </div>

                            <div className={styles.apiStatus}>
                                <div className={`${styles.statusDot} ${apiKey ? styles.connected : styles.disconnected}`}></div>
                                <span>{apiKey ? 'المفتاح جاهز للعمل مع النموذج المختار' : 'يرجى إضافة مفتاح صالح'}</span>
                            </div>

                            {message && (
                                <div className={`${styles.message} ${styles[message.type]}`}>
                                    {message.type === 'success' ? '✅' : '⚠️'} {message.text}
                                </div>
                            )}

                            <div className={styles.actions}>
                                <button type="submit" className={styles.saveBtn} disabled={saving}>
                                    {saving ? (
                                        <>
                                            <div className={styles.spinner} style={{ width: 20, height: 20, borderWidth: 2 }}></div>
                                            جاري الحفظ...
                                        </>
                                    ) : (
                                        <>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                                <polyline points="17 21 17 13 7 13 7 21" />
                                                <polyline points="7 3 7 8 15 8" />
                                            </svg>
                                            حفظ التغييرات
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )
            default:
                return (
                    <div className={styles.card}>
                        <div className={styles.emptyState}>
                            <p>هذا القسم قيد التطوير...</p>
                        </div>
                    </div>
                )
        }
    }

    return (
        <div className={styles.settingsContainer}>
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <div className={styles.headerIcon}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </div>
                    <div className={styles.headerInfo}>
                        <h1>إعدادات النظام</h1>
                        <p>تخصيص الخيارات العامة والربط مع الخدمات الخارجية</p>
                    </div>
                </div>
                <button onClick={() => navigate('/dashboard')} className={styles.backBtn}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                    لوحة التحكم
                </button>
            </header>

            <div className={styles.mainGrid}>
                <aside className={styles.sidebar}>
                    <nav>
                        <button
                            className={`${styles.navItem} ${activeTab === 'ai' ? styles.active : ''}`}
                            onClick={() => setActiveTab('ai')}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                                <path d="M12 12 2.1 12.05" />
                                <path d="M12 12l8.9-8.9" />
                            </svg>
                            الذكاء الاصطناعي (AI)
                        </button>
                        <button
                            className={`${styles.navItem} ${activeTab === 'general' ? styles.active : ''}`}
                            onClick={() => setActiveTab('general')}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                                <line x1="9" y1="21" x2="9" y2="9" />
                            </svg>
                            إعدادات عامة
                        </button>
                        <button
                            className={`${styles.navItem} ${activeTab === 'notifications' ? styles.active : ''}`}
                            onClick={() => setActiveTab('notifications')}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                            </svg>
                            الإشعارات والتنبيهات
                        </button>
                    </nav>
                </aside>

                <main className={styles.contentArea}>
                    {loading ? (
                        <div className={styles.card}>
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                                <div className={styles.spinner}></div>
                            </div>
                        </div>
                    ) : renderContent()}
                </main>
            </div>
        </div>
    )
}

export default Settings

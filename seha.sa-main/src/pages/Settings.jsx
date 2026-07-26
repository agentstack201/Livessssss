import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Settings.module.css'

// Use environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

function Settings() {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('ai') // ai, general, notifications
    const [apiKey, setApiKey] = useState('')
    const [aiModel, setAiModel] = useState('gemini-flash-latest')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState(null)
    const [testing, setTesting] = useState(false)
    const [diagnosis, setDiagnosis] = useState(null)
    const [loadFailed, setLoadFailed] = useState(false)

    // Fetch initial settings
    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        setLoading(true)
        try {
            const token = localStorage.getItem('token')
            const [keyRes, modelRes] = await Promise.all([
                fetch(`${API_BASE_URL}/settings/gemini_api_key`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/settings/gemini_model`, { headers: { 'Authorization': `Bearer ${token}` } })
            ])
            const [keyData, modelData] = await Promise.all([keyRes, modelRes].map(r => r.json().catch(() => null)))

            // A 404 means "not configured yet" and is a legitimate empty state.
            // Anything else (401 on an expired session, 500 on a DB hiccup) means
            // the stored value is unknown — and must not be treated as empty,
            // because the field would render blank and the next save would
            // overwrite a perfectly good key with "".
            const unreadable = [keyRes, modelRes].some(r => !r.ok && r.status !== 404)
            setLoadFailed(unreadable)

            if (unreadable) {
                showMessage('error', keyRes.status === 401 || modelRes.status === 401
                    ? 'انتهت الجلسة — سجّل الدخول مرة أخرى قبل تعديل الإعدادات'
                    : 'تعذّر قراءة الإعدادات الحالية — لا تحفظ الآن حتى لا تُمحى القيم المخزّنة')
                return
            }

            if (keyData?.data) setApiKey(keyData.data.value || '')
            if (modelData?.data) setAiModel(modelData.data.value || 'gemini-flash-latest')
        } catch (err) {
            console.error('Error fetching settings:', err)
            setLoadFailed(true)
            showMessage('error', 'فشل في الاتصال بالخادم')
        } finally {
            setLoading(false)
        }
    }

    const showMessage = (type, text) => {
        setMessage({ type, text })
        setTimeout(() => setMessage(null), 5000)
    }

    // Live per-key health check. The backend probes each saved key against
    // Google and reports exactly why it fails, so a bad key never has to be
    // diagnosed by guesswork.
    const handleDiagnose = async () => {
        setTesting(true)
        setDiagnosis(null)
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${API_BASE_URL}/settings/ai/diagnose`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const body = await res.json()
            if (res.ok && body.success) setDiagnosis(body.data)
            else showMessage('error', body.message || `فشل الفحص (رمز ${res.status})`)
        } catch (err) {
            showMessage('error', 'تعذّر الاتصال بالخادم لإجراء الفحص')
        } finally {
            setTesting(false)
        }
    }

    const handleSave = async (e) => {
        e.preventDefault()

        // Refuse to write over values we were never able to read back.
        if (loadFailed) {
            showMessage('error', 'لم نتمكن من قراءة الإعدادات الحالية — أعد تحميل الصفحة (وسجّل الدخول إن لزم) قبل الحفظ.')
            return
        }
        if (!apiKey.trim() && !window.confirm('حقل المفاتيح فارغ. هل تريد فعلاً حذف المفاتيح المحفوظة؟')) {
            return
        }

        setSaving(true)
        setMessage(null)

        try {
            const token = localStorage.getItem('token')

            // Both writes are verified: previously the responses were ignored, so an
            // expired session (the token lasts 3h) reported "saved successfully"
            // while nothing was persisted — the key then appeared to "not work".
            const save = async (key, value, description) => {
                const res = await fetch(`${API_BASE_URL}/settings`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ key, value, description })
                })
                let body = null
                try { body = await res.json() } catch { /* non-JSON error page */ }
                if (!res.ok || body?.success === false) {
                    const reason = res.status === 401
                        ? 'انتهت الجلسة — سجّل الدخول مرة أخرى ثم أعد الحفظ'
                        : (body?.message || `فشل الحفظ (رمز ${res.status})`)
                    throw new Error(reason)
                }
                return body
            }

            await save('gemini_api_key', apiKey, 'Gemini API Key')
            await save('gemini_model', aiModel, 'AI Model Version')

            showMessage('success', 'تم حفظ الإعدادات بنجاح')
            window.showToast?.('تم حفظ الإعدادات بنجاح', 'success')
        } catch (err) {
            console.error('Save error:', err)
            showMessage('error', err.message || 'حدث خطأ أثناء الاتصال بالخادم')
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
                                    <option value="gemini-flash-latest">Gemini Flash (الأحدث - موصى به)</option>
                                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (أدق - أبطأ)</option>
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Google Gemini API Keys (مفاتيح الربط)</label>
                                <textarea
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder={"AIzaSy...المفتاح الأول\nAIzaSy...المفتاح الثاني\nAIzaSy...المفتاح الثالث"}
                                    className={styles.input}
                                    dir="ltr"
                                    rows={4}
                                    style={{ resize: 'vertical', minHeight: '110px', lineHeight: '1.8', fontFamily: 'monospace' }}
                                />
                                <small className={styles.helpText}>
                                    يمكنك إضافة <b>أكثر من مفتاح</b> — كل مفتاح في <b>سطر منفصل</b>. النظام يستخدم الأول، ولو توقف (تجاوز الحصة أو خطأ) ينتقل تلقائياً للمفتاح التالي. احصل على المفاتيح من <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#306db5', fontWeight: 'bold' }}>Google AI Studio</a>.
                                </small>
                            </div>

                            <div className={styles.apiStatus}>
                                <div className={`${styles.statusDot} ${apiKey ? styles.connected : styles.disconnected}`}></div>
                                <span>{apiKey ? `عدد المفاتيح: ${apiKey.split(/[\n,;]+/).map(k => k.trim()).filter(Boolean).length} — جاهزة للعمل مع التبديل التلقائي` : 'يرجى إضافة مفتاح صالح واحد على الأقل'}</span>
                            </div>

                            {message && (
                                <div className={`${styles.message} ${styles[message.type]}`}>
                                    {message.type === 'success' ? '✅' : '⚠️'} {message.text}
                                </div>
                            )}

                            <div style={{ marginTop: '14px' }}>
                                <button type="button" onClick={handleDiagnose} disabled={testing}
                                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #0ea5e9', background: '#f0f9ff', color: '#0369a1', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '15px' }}>
                                    {testing ? '🔍 جارٍ فحص المفاتيح…' : '🔍 اختبار المفاتيح الآن'}
                                </button>
                                <small className={styles.helpText} style={{ display: 'block', marginTop: '6px' }}>
                                    يفحص كل مفتاح مباشرةً مع Google ويخبرك بالسبب الدقيق لأي فشل. احفظ التغييرات أولاً.
                                </small>
                            </div>

                            {diagnosis && (
                                <div style={{ marginTop: '12px', padding: '14px', borderRadius: '12px', border: `1px solid ${diagnosis.healthy ? '#86efac' : '#fecaca'}`, background: diagnosis.healthy ? '#f0fdf4' : '#fef2f2' }}>
                                    <strong style={{ display: 'block', marginBottom: '8px', color: diagnosis.healthy ? '#15803d' : '#b91c1c' }}>
                                        {diagnosis.healthy ? '✅' : '⛔'} {diagnosis.summary}
                                    </strong>

                                    {diagnosis.hiddenCharactersRemoved > 0 && (
                                        <div style={{ fontSize: '13px', color: '#b45309', marginBottom: '8px' }}>
                                            ⚠️ تم تنظيف {diagnosis.hiddenCharactersRemoved} محرف مخفي من اللصق (علامات اتجاه/مسافات غير مرئية) — هذا سبب شائع لفشل المفتاح، وقد عولج تلقائياً.
                                        </div>
                                    )}
                                    {!diagnosis.savedInDatabase && diagnosis.keysConfigured === 0 && (
                                        <div style={{ fontSize: '13px', color: '#b91c1c', marginBottom: '8px' }}>
                                            لم يُحفظ أي مفتاح في قاعدة البيانات — اضغط «حفظ التغييرات» ثم أعد الفحص.
                                        </div>
                                    )}

                                    {diagnosis.keys?.map(k => (
                                        <div key={k.index} style={{ padding: '9px 0', borderTop: '1px solid rgba(0,0,0,.07)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                                                <span style={{ fontWeight: 700 }}>
                                                    مفتاح #{k.index} <span style={{ direction: 'ltr', display: 'inline-block', color: '#64748b', fontWeight: 400, fontFamily: 'monospace' }}>{k.fingerprint}</span>
                                                </span>
                                                <span style={{ color: k.status === 'يعمل' ? '#15803d' : '#b91c1c', fontWeight: 700 }}>
                                                    {k.status === 'يعمل' ? '✅ يعمل' : '❌ خطأ'}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '13px', color: '#475569', marginTop: '3px' }}>{k.verdict}</div>
                                            {k.modelsAvailable != null && (
                                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                                    الموديلات المتاحة: {k.modelsAvailable} — المختار: <span style={{ direction: 'ltr', display: 'inline-block' }}>{k.selectedModel}</span>
                                                </div>
                                            )}
                                            {k.googleMessage && (
                                                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', direction: 'ltr', textAlign: 'left' }}>{k.googleMessage}</div>
                                            )}
                                        </div>
                                    ))}
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

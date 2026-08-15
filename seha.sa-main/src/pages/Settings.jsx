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

    // ── حالة ربط واتساب (الإرسال الآلي من الخادم) ───────────────────────────
    // هذا القسم يخصّ «إرسال عبر واتساب» فقط — وهو مسار مستقل تماماً عن زر
    // «مشاركة» في لوحة التحكم الذي يفتح قائمة مشاركة أندرويد كما هو.
    const [waStatus, setWaStatus] = useState(null)
    const [waBusy, setWaBusy] = useState(false)
    // رقم حساب واتساب المراد ربطه. ليس حقلاً شكلياً: يُرسَل للخادم فيطلب به رمز
    // إقران من واتساب مرتبطاً بهذا الرقم تحديداً، ولا تُفتح الجلسة إلا بعد كتابة
    // الرمز في الهاتف. حالة «متصل» تأتي من الخادم وحده.
    const [waNumber, setWaNumber] = useState('')
    // سبب فشل قراءة الحالة، نصّاً — بدونه تتشابه كل الأعطال في رسالة واحدة.
    const [waError, setWaError] = useState(null)

    // Fetch initial settings
    useEffect(() => {
        fetchSettings()
    }, [])

    // استعلام دوري عن حالة واتساب أثناء فتح تبويبه — رمز QR يصل من الخادم
    // بعد لحظات من بدء الاتصال، ويختفي فور نجاح الإقران.
    useEffect(() => {
        if (activeTab !== 'whatsapp') return
        let alive = true
        const poll = async () => {
            try {
                const token = localStorage.getItem('token')
                const res = await fetch(`${API_BASE_URL}/whatsapp/status`, {
                    headers: { Authorization: `Bearer ${token}` },
                })
                const data = await res.json().catch(() => null)
                if (!alive) return
                if (res.ok && data?.data) {
                    setWaStatus(data.data)
                    setWaError(null)
                } else {
                    // بلغنا الخادمَ لكنه لم يُعِد حالة صالحة. رمز الحالة هو ما
                    // يميّز الأسباب: 404 مسار غير منشور، 401 جلسة منتهية،
                    // 503 المسار فشل تحميله على الخادم.
                    setWaStatus(null)
                    setWaError(`HTTP ${res.status} — ${data?.message || 'استجابة غير متوقّعة من الخادم'}`)
                }
            } catch (err) {
                // لم نبلغ الخادم إطلاقاً: عنوان خاطئ، أو الخادم متوقّف/نائم، أو CORS.
                if (alive) {
                    setWaStatus(null)
                    setWaError(`تعذّر الوصول للخادم — ${err.message}`)
                }
            }
        }
        poll()
        const id = setInterval(poll, 3000)
        return () => { alive = false; clearInterval(id) }
    }, [activeTab])

    const callWhatsapp = async (path, successMsg, body) => {
        setWaBusy(true)
        try {
            const token = localStorage.getItem('token')
            const res = await fetch(`${API_BASE_URL}${path}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(body ? { 'Content-Type': 'application/json' } : {}),
                },
                ...(body ? { body: JSON.stringify(body) } : {}),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || data?.success === false) throw new Error(data?.message || 'فشل الطلب')
            if (data?.data) setWaStatus(data.data)
            showMessage('success', successMsg)
        } catch (err) {
            showMessage('error', err.message || 'تعذّر الاتصال بالخادم')
        } finally {
            setWaBusy(false)
        }
    }

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
                                {/*
                                  A plain single-line text input, same height as every
                                  other field on this page. It is NOT type="password":
                                  masking hid the stray characters an RTL paste carries,
                                  which is what made a corrupted key impossible to spot.
                                  No maxLength — the value is stored in a TEXT column and
                                  must never be clipped. The mobile keyboard helpers are
                                  all disabled so nothing rewrites what was pasted.
                                */}
                                <input
                                    type="text"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="AIzaSy… (وللمفاتيح المتعددة افصل بينها بفاصلة)"
                                    className={styles.input}
                                    dir="ltr"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck={false}
                                    inputMode="text"
                                    name="gemini-api-key"
                                    style={{ fontFamily: 'monospace', textOverflow: 'ellipsis' }}
                                />
                                <small className={styles.helpText}>
                                    يمكنك إضافة <b>أكثر من مفتاح</b> بفصلها بفاصلة <code>,</code> أو مسافة. النظام يستخدم الأول، ولو توقف (تجاوز الحصة أو خطأ) ينتقل تلقائياً للتالي. احصل على المفاتيح من <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: '#306db5', fontWeight: 'bold' }}>Google AI Studio</a>.
                                </small>
                            </div>

                            <div className={styles.apiStatus}>
                                <div className={`${styles.statusDot} ${apiKey ? styles.connected : styles.disconnected}`}></div>
                                <span>
                                    {apiKey
                                        ? `عدد المفاتيح: ${apiKey.split(/[\s,;]+/).filter(Boolean).length} — الطول المُدخل: ${apiKey.length} حرف`
                                        : 'يرجى إضافة مفتاح واحد على الأقل'}
                                </span>
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
                                            {/* Google's own words come first when it rejects a
                                                key — the Arabic line below is guidance, not the
                                                verdict. */}
                                            {k.googleMessage && (
                                                <div style={{ marginTop: '5px', padding: '7px 9px', borderRadius: '7px', background: '#fff', border: '1px solid #fecaca' }}>
                                                    <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '2px' }}>رد Google:</div>
                                                    <div style={{ fontSize: '12px', color: '#7f1d1d', direction: 'ltr', textAlign: 'left', fontFamily: 'monospace' }}>
                                                        {k.googleMessage}
                                                    </div>
                                                    {(k.googleStatus || k.googleReason) && (
                                                        <div style={{ fontSize: '10px', color: '#94a3b8', direction: 'ltr', textAlign: 'left', marginTop: '2px' }}>
                                                            {[k.httpStatus, k.googleStatus, k.googleReason].filter(Boolean).join(' · ')}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>{k.verdict}</div>
                                            {k.hint && (
                                                <div style={{ fontSize: '12px', color: '#b45309', marginTop: '3px' }}>{k.hint}</div>
                                            )}
                                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                                الطول المخزَّن: {k.length}{k.prefix ? ' — يبدأ بـ ' : ''}
                                                {k.prefix && <span style={{ direction: 'ltr', display: 'inline-block', fontFamily: 'monospace' }}>{k.prefix}</span>}
                                            </div>
                                            {k.modelsAvailable != null && (
                                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                                    الموديلات المتاحة: {k.modelsAvailable} — المختار: <span style={{ direction: 'ltr', display: 'inline-block' }}>{k.selectedModel}</span>
                                                </div>
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
            case 'whatsapp':
                return (
                    <div className={styles.card}>
                        <div className={styles.cardHeader}>
                            <h2>
                                <span style={{ fontSize: '1.5rem' }}>💬</span>
                                ربط واتساب (الإرسال الآلي)
                            </h2>
                            <p>
                                هذا القسم يخصّ زر «إرسال عبر واتساب» فقط: يرسل الخادم التقرير ومعه صورة
                                معاينة مموّهة من صنعنا، بينما يبقى ملف الـ PDF كما هو تماماً ويُفتح بجودته
                                الأصلية. زر «مشاركة» في لوحة التحكم لا علاقة له بهذا القسم ويستمر بفتح
                                قائمة مشاركة أندرويد بكل التطبيقات كالمعتاد.
                            </p>
                        </div>

                        {!waStatus ? (
                            // تمييز «تعذّر بلوغ الخادم» عن «الخدمة مغلقة» — كانا يظهران برسالة
                            // واحدة فيُشخَّص العطل خطأً.
                            <div className={styles.emptyState}>
                                <p>تعذّر قراءة حالة واتساب من الخادم.</p>
                                {waError && (
                                    <p dir="ltr" style={{
                                        margin: '8px 0', fontFamily: 'monospace', fontSize: 13,
                                        color: '#b91c1c', background: '#fef2f2',
                                        padding: '8px 12px', borderRadius: 6, wordBreak: 'break-word',
                                    }}>
                                        {waError}
                                    </p>
                                )}
                                <p style={{ fontSize: 13, color: '#64748b' }}>
                                    الخادم المستهدف:
                                    <code dir="ltr" style={{ margin: '0 6px' }}>{API_BASE_URL}/whatsapp/status</code>
                                </p>
                                <p style={{ fontSize: 13, color: '#64748b' }}>
                                    <b>404</b> يعني أن نسخة الخادم المنشورة لا تحوي مسار واتساب (أعِد نشر الخادم).
                                    <b> 401</b> يعني انتهاء الجلسة (سجّل الخروج ثم الدخول).
                                    <b> تعذّر الوصول</b> يعني أن العنوان خاطئ أو الخادم متوقّف —
                                    وإن كان على استضافة مجانية فقد يحتاج دقيقة لينهض من السكون.
                                </p>
                            </div>
                        ) : !waStatus.enabled ? (
                            <div className={styles.emptyState}>
                                <p>
                                    الخدمة مغلقة على الخادم، ولهذا لا يظهر حقل إدخال الرقم. فعّلها بضبط
                                    <code style={{ margin: '0 6px' }}>WHATSAPP_SENDER_ENABLED=true</code>
                                    (واختيارياً
                                    <code style={{ margin: '0 6px' }}>WHATSAPP_SELF_NUMBER</code>)
                                    ثم أعِد تشغيل الخادم — وبعدها يظهر حقل «رقم واتساب المراد ربطه»
                                    وزر «بدء الربط».
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                <div className={styles.formGroup}>
                                    <label>الحالة</label>
                                    <p style={{ margin: 0, fontWeight: 600, color: waStatus.connected ? '#15803d' : '#b45309' }}>
                                        {waStatus.connected
                                            ? `متصل ✓ ${waStatus.user ? `(${waStatus.user.split(':')[0]})` : ''}`
                                            : 'غير متصل — أدخل الرقم وابدأ الربط، ثم أكمل الإقران من الهاتف'}
                                    </p>
                                    {waStatus.lastError && !waStatus.connected && (
                                        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#b91c1c' }}>{waStatus.lastError}</p>
                                    )}
                                    {waStatus.defaultTarget && (
                                        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                                            رقم الاستقبال الافتراضي: {waStatus.defaultTarget} — تُرسَل التقارير إليه ثم تُعاد
                                            توجيهها للزبون (إعادة التوجيه تنقل المعاينة كما هي).
                                        </p>
                                    )}
                                </div>

                                {!waStatus.connected && (
                                    <div className={styles.formGroup}>
                                        <label htmlFor="wa-number">رقم واتساب المراد ربطه</label>
                                        <input
                                            id="wa-number"
                                            type="tel"
                                            inputMode="tel"
                                            dir="ltr"
                                            placeholder="بصيغة دولية بلا +، مثال: 967738056534"
                                            value={waNumber}
                                            onChange={(e) => setWaNumber(e.target.value)}
                                            disabled={waBusy}
                                        />
                                        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                                            أدخل الرقم ثم اضغط «بدء الربط» ليظهر رمز من ٨ خانات تكتبه في الهاتف.
                                            اتركه فارغاً إن كنت تفضّل مسح رمز QR بدلاً من ذلك.
                                        </p>
                                    </div>
                                )}

                                {waStatus.pairingCode && !waStatus.connected && (
                                    <div className={styles.formGroup}>
                                        <label>اكتب هذا الرمز في الهاتف</label>
                                        <p
                                            dir="ltr"
                                            style={{
                                                margin: 0, fontSize: '2rem', fontWeight: 700, letterSpacing: '0.35em',
                                                fontFamily: 'monospace', color: '#0f172a', background: '#f1f5f9',
                                                padding: '12px 16px', borderRadius: 8, textAlign: 'center',
                                            }}
                                        >
                                            {waStatus.pairingCode}
                                        </p>
                                        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>
                                            على الهاتف الذي يحمل الرقم {waStatus.pairingNumber}: واتساب ← الأجهزة
                                            المرتبطة ← ربط جهاز ← «ربط برقم الهاتف بدلاً من ذلك».
                                            {waStatus.pairingExpiresInMs > 0 && (
                                                <> صلاحية الرمز تنتهي خلال ~{Math.ceil(waStatus.pairingExpiresInMs / 60000)} دقيقة.</>
                                            )}
                                        </p>
                                        <p style={{
                                            margin: '6px 0 0', fontSize: 13, color: '#92400e',
                                            background: '#fffbeb', padding: '8px 12px', borderRadius: 6,
                                        }}>
                                            ظهور الرمز <b>لا يعني</b> أن الرقم صحيح أو مسجّل في واتساب: الرمز يسكّه
                                            الخادم ويسجّله لدى واتساب، ولا يتحقّق واتساب من الرقم في هذه المرحلة.
                                            الدليل الوحيد على نجاح الربط هو تحوّل «الحالة» أعلاه إلى <b>متصل ✓</b>
                                            بعد كتابة الرمز في الهاتف.
                                        </p>
                                    </div>
                                )}

                                {waStatus.qr && !waStatus.connected && !waStatus.pairingCode && (
                                    <div className={styles.formGroup}>
                                        <label>امسح الرمز من واتساب ← الأجهزة المرتبطة</label>
                                        <img
                                            src={waStatus.qr}
                                            alt="رمز إقران واتساب"
                                            style={{ width: 260, height: 260, background: '#fff', padding: 8, borderRadius: 8 }}
                                        />
                                    </div>
                                )}

                                <div className={styles.actions}>
                                    <button
                                        type="button"
                                        className={styles.saveBtn}
                                        disabled={waBusy || waStatus.connected}
                                        onClick={() => callWhatsapp(
                                            '/whatsapp/connect',
                                            waNumber.trim()
                                                ? 'جارٍ الربط — سيظهر رمز الإقران خلال ثوانٍ'
                                                : 'جارٍ الربط — سيظهر رمز QR خلال ثوانٍ',
                                            waNumber.trim() ? { number: waNumber.trim() } : undefined,
                                        )}
                                    >
                                        {waStatus.connected ? 'متصل' : 'بدء الربط'}
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.saveBtn}
                                        style={{ background: '#fff', color: '#b91c1c', border: '1px solid #fecaca' }}
                                        disabled={waBusy}
                                        onClick={() => callWhatsapp('/whatsapp/logout', 'تم فصل جلسة واتساب')}
                                    >
                                        فصل الجلسة
                                    </button>
                                </div>
                            </div>
                        )}
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
                            className={`${styles.navItem} ${activeTab === 'whatsapp' ? styles.active : ''}`}
                            onClick={() => setActiveTab('whatsapp')}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                            </svg>
                            ربط واتساب
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

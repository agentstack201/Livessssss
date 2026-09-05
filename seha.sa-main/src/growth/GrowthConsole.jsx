// ───────────────────────────────────────────────────────────────────────────
// هيكل الكونسول — شريط جانبي، بحث عام، وتوجيه داخلي.
//
// البحث العام حاضر في كل صفحة عمداً: وكيل الدعم يسأل باستمرار «المستخدم فلان
// — كم رصيده؟ ماذا اشترى؟» وبدونه كان عليه القفز بين خمس صفحات.
//
// عناصر التنقّل تُخفى حسب صلاحيات المستخدم. الإخفاء راحة لا حماية: الحاجز
// الحقيقي على الخادم، لكن عرض صفحة سترفضها الواجهة الخلفية تجربة سيئة.
// ───────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import s from './console.module.css'
import { api } from './api'
import { Loading, ErrorBox } from './components/ui'

import Overview from './pages/Overview'
import Products from './pages/Products'
import Orders from './pages/Orders'
import Credits from './pages/Credits'
import Coupons from './pages/Coupons'
import Referrals from './pages/Referrals'
import Campaigns from './pages/Campaigns'
import Rewards from './pages/Rewards'
import Team from './pages/Team'
import SettingsPage from './pages/Settings'
import Audit from './pages/Audit'
import MemberProfile from './pages/MemberProfile'

const NAV = [
  { to: '/growth', end: true, icon: '📊', label: 'نظرة عامة', perm: 'analytics:read' },
  { divider: true, label: 'التجارة' },
  { to: '/growth/products', icon: '💰', label: 'المنتجات والأسعار', perm: 'products:read' },
  { to: '/growth/orders', icon: '🧾', label: 'الطلبات والمدفوعات', perm: 'orders:read' },
  { to: '/growth/credits', icon: '💳', label: 'الأرصدة', perm: 'credits:read' },
  { divider: true, label: 'الاكتساب' },
  { to: '/growth/coupons', icon: '🎟️', label: 'الكوبونات', perm: 'coupons:read' },
  { to: '/growth/referrals', icon: '🔗', label: 'الإحالات', perm: 'referrals:read' },
  { to: '/growth/campaigns', icon: '📢', label: 'الحملات', perm: 'campaigns:read' },
  { to: '/growth/rewards', icon: '🎁', label: 'المكافآت', perm: 'rewards:read' },
  { divider: true, label: 'الإدارة' },
  { to: '/growth/team', icon: '👥', label: 'الفريق والصلاحيات', perm: 'roles:read' },
  { to: '/growth/settings', icon: '⚙️', label: 'الإعدادات', perm: 'settings:read' },
  { to: '/growth/audit', icon: '📋', label: 'سجل التدقيق', perm: 'audit:read' },
]

/** صلاحيات لا تفتح أي صفحة — نقول ذلك بدل إعادة توجيه تدور على نفسها. */
function NoLanding() {
  return (
    <div className={s.errorBox}>
      صلاحياتك لا تفتح أي صفحة في هذا الكونسول. استعمل البحث أعلاه للوصول إلى
      ملف مستخدم، أو اطلب من مدير النظام إسناد دور أوسع.
    </div>
  )
}

function GlobalSearch() {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (term.trim().length < 2) { setResults([]); return undefined }
    const id = setTimeout(async () => {
      try {
        setResults(await api.searchMembers(term.trim()))
        setOpen(true)
      } catch { setResults([]) }
    }, 250)
    return () => clearTimeout(id)
  }, [term])

  useEffect(() => {
    const onClick = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const go = (userId) => {
    setOpen(false); setTerm('')
    navigate(`/growth/members/${userId}`)
  }

  return (
    <div className={s.searchWrap} ref={boxRef}>
      <input
        className={s.searchInput}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder="ابحث عن مستخدم بالاسم أو البريد أو الرقم…"
      />
      <span className={s.searchIcon}>🔍</span>
      {open && results.length > 0 && (
        <div className={s.searchResults}>
          {results.map((u) => (
            <div key={u.id} className={s.searchRow} onClick={() => go(u.id)}>
              <div>
                <div className={s.searchName}>{u.name}</div>
                <div className={s.searchMeta}>{u.email}</div>
              </div>
              <div className={s.searchMeta}>
                {u.credit_balance !== null ? `${u.credit_balance} رصيد` : '—'}
              </div>
            </div>
          ))}
        </div>
      )}
      {open && term.trim().length >= 2 && results.length === 0 && (
        <div className={s.searchResults}>
          <div className={s.searchRow} style={{ cursor: 'default', color: '#94a3b8' }}>
            لا نتائج مطابقة
          </div>
        </div>
      )}
    </div>
  )
}

export default function GrowthConsole() {
  const [me, setMe] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      setMe(await api.myPermissions())
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const can = useCallback(
    (perm) => !!me && (me.permissions.includes('*') || me.permissions.includes(perm)),
    [me]
  )

  if (loading) return <div className={s.shell}><Loading text="جارٍ تحميل الكونسول…" /></div>

  if (error) {
    return (
      <div className={s.shell}>
        <div className={s.content}>
          <ErrorBox error={error} onRetry={load} />
        </div>
      </div>
    )
  }

  if (!me?.has_growth_access) {
    return (
      <div className={s.shell}>
        <div className={s.content}>
          <div className={s.errorBox}>
            ليس لديك صلاحية الوصول إلى وحدة النمو. تواصل مع مدير النظام لإسناد دور لك.
          </div>
        </div>
      </div>
    )
  }

  const visible = NAV.filter((item) => item.divider || can(item.perm))
  // لا نعرض فاصلاً لا يليه عنصر ظاهر.
  const nav = visible.filter((item, i) =>
    !item.divider || visible.slice(i + 1).some((n) => !n.divider))

  // دور بصلاحيات لا يقابلها أي عنصر تنقّل (مثل members:read وحده) كان يُعيد
  // '/growth' فيوجّه مسار الفهرس إلى نفسه في حلقة لا تنتهي.
  const firstNav = nav.find((n) => !n.divider)?.to || null

  return (
    <div className={s.shell}>
      <aside className={s.sidebar}>
        <div className={s.brand}>
          <h1 className={s.brandTitle}>كونسول النمو</h1>
          <p className={s.brandSub}>إدارة الباقات والنمو والفريق</p>
        </div>

        <nav className={s.nav}>
          {nav.map((item, i) => (item.divider ? (
            <div key={`d${i}`}>
              <div className={s.navDivider} />
              <div className={s.navGroupLabel}>{item.label}</div>
            </div>
          ) : (
            <NavLink
              key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => `${s.navItem} ${isActive ? s.navItemActive : ''}`}
            >
              <span className={s.navIcon}>{item.icon}</span>
              {item.label}
            </NavLink>
          )))}
        </nav>

        <a className={s.backLink} href="/dashboard">← العودة إلى لوحة المنصة</a>
      </aside>

      <div className={s.main}>
        <header className={s.topbar}>
          <GlobalSearch />
          <span className={s.topbarUser}>{me.name}{me.is_admin ? ' · مدير النظام' : ''}</span>
        </header>

        <main className={s.content}>
          <Routes>
            <Route index element={
              can('analytics:read') ? <Overview can={can} />
                : firstNav ? <Navigate to={firstNav} replace />
                  : <NoLanding />
            } />
            <Route path="products" element={<Products can={can} />} />
            <Route path="orders" element={<Orders can={can} />} />
            <Route path="credits" element={<Credits can={can} />} />
            <Route path="coupons" element={<Coupons can={can} />} />
            <Route path="referrals" element={<Referrals can={can} />} />
            <Route path="campaigns" element={<Campaigns can={can} />} />
            <Route path="rewards" element={<Rewards can={can} />} />
            <Route path="team" element={<Team can={can} />} />
            <Route path="settings" element={<SettingsPage can={can} />} />
            <Route path="audit" element={<Audit can={can} />} />
            <Route path="members/:userId" element={<MemberProfile can={can} />} />
            <Route path="*" element={firstNav ? <Navigate to={firstNav} replace /> : <NoLanding />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

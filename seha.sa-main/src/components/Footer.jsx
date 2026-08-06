import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

const YouTubeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
  </svg>
);

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.045 4.126H5.078z" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

/* الوحدات هنا هي بكسلات المرجع الفعلية: الرأس 15px، الذراعان 45px عرضاً،
   والجذع والساقان بسماكة 11px و6.5px تباعاً. */
const AccessibilityIcon = () => (
  <svg width="19.45" height="21.74" viewBox="0 0 51 57" fill="none" stroke="currentColor">
    <circle cx="26" cy="7.2" r="7.3" fill="currentColor" stroke="none" />
    <path d="M6 20.6Q26 24.8 45 20.6" strokeWidth="5.2" strokeLinecap="round" />
    <path d="M26 27v8.5" strokeWidth="10.5" />
    <path d="M26 34 17.6 53.4" strokeWidth="6" strokeLinecap="round" />
    <path d="M26 34 34.6 53.4" strokeWidth="6" strokeLinecap="round" />
  </svg>
);

/* سهم مصمت لا محدّد: في المرجع عرض رأسه 25px فعلي وسماكة ساقه 6px وطوله 33px */
const ArrowUpIcon = () => (
  <svg width="9.54" height="12.59" viewBox="0 0 25 33" fill="none" stroke="currentColor">
    <path
      d="M12.5 2.6 22.4 12.5M12.5 2.6 2.6 12.5M12.5 3.6v26.8"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* فقاعة مصمتة بأركان مستديرة عدا الركن الأسفل الأيسر، مقاسها 36×33 بكسل فعلي */
const ChatDotsIcon = () => (
  <svg width="13.73" height="12.59" viewBox="0 0 36 33" fill="none">
    <path
      d="M9.4 0h17.2A9.4 9.4 0 0 1 36 9.4v14.2a9.4 9.4 0 0 1-9.4 9.4H0V9.4A9.4 9.4 0 0 1 9.4 0Z"
      fill="currentColor"
    />
    <circle cx="10.4" cy="16.5" r="2.6" fill="#3169b5" />
    <circle cx="18" cy="16.5" r="2.6" fill="#3169b5" />
    <circle cx="25.6" cy="16.5" r="2.6" fill="#3169b5" />
  </svg>
);

export default function Footer() {
  const [showTerms, setShowTerms] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // المرجع يخلو من زر الرجوع للأعلى ما دامت الصفحة في أعلاها، ويظهر بعد بدء التمرير
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // الفيديو يُظهر البطاقة تكتمل وتختفي في إطار واحد عند 60 إطاراً/ثانية،
  // فلا مؤقّت خروج ولا حالة إغلاق وسيطة.
  const closeTerms = useCallback(() => setShowTerms(false), []);

  // الضغط على زر المحادثة يعرض الشروط فقط، في كل مرة، ولا يفتح أي واجهة محادثة
  const requestAssistant = useCallback(() => setShowTerms(true), []);

  useEffect(() => {
    if (!showTerms) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeTerms();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showTerms, closeTerms]);

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-about">
          <img
            className="footer-logo"
            alt="Seha"
            src="https://seha.sa/assets/logo-white-CKxLEirV.svg"
          />
          <p className="footer-about-text">
            منصة صحة تخدم جميع المنشأت الطبية من خلال تقديم الخدمات الصحية
            إلكترونياً لجميع المنشأت الطبية وتسعى إلى توحيد وأتمتة الاجراءات
            والخدمات بما في دوره رفع جودة الاداء وخفض التكاليف.
          </p>
        </div>

        <div className="footer-menu">
          <h3 className="footer-heading">القائمة الرئيسية</h3>
          <ul className="footer-menu-list">
            <li><a href="https://seha.sa/#/services">الخدمات</a></li>
            <li><a href="#">صحة بلس</a></li>
            <li><Link to="/inquiries/slenquiry">الاستعلامات</Link></li>
            <li><a href="https://seha.sa/#/faq">الأسئلة الشائعة</a></li>
            <li><a href="#">الأثر البيئي</a></li>
            <li><a href="https://seha.sa/#/ContactUs">تواصل معنا</a></li>
          </ul>
        </div>

        <h3 className="footer-heading">
          تواصل معنا
        </h3>

        <div className="footer-top-row">
          <div className="contact-items">
            <a
              href="tel:920002005"
              className="footer-contact-item"
            >
              <div className="contact-icon-wrapper"><PhoneIcon /></div>
              <span>920002005</span>
            </a>
            <a
              href="mailto:support@seha.sa"
              className="footer-contact-item"
            >
              <div className="contact-icon-wrapper"><MailIcon /></div>
              <span>support@seha.sa</span>
            </a>
            <a
              href="https://wa.me/920002005"
              className="footer-contact-item"
              target="_blank"
              rel="noreferrer"
            >
              <div className="contact-icon-wrapper"><WhatsAppIcon /></div>
              <span>920002005</span>
            </a>
          </div>

          <div className="footer-logos">
            <img alt="لين" src="https://seha.sa/assets/lean-logo-De0NEeoI.svg" />
            <div className="logo-sep" />
            <img alt="وزارة الصحة" src="https://seha.sa/assets/MOH-logo-DYiHZCSg.svg" />
          </div>
        </div>

        <p className="work-hours">
          أوقات العمل: الأحد حتى الخميس 8 ص - 11م
        </p>

        <div className="footer-social-links">
          <a
            href="https://www.youtube.com/channel/UCb9ZrS2YcriYqIPIHNp9wcQ"
            className="social-btn"
            target="_blank"
            rel="noreferrer"
          >
            <YouTubeIcon />
          </a>
          <a
            href="https://twitter.com/seha_services"
            className="social-btn"
            target="_blank"
            rel="noreferrer"
          >
            <XIcon />
          </a>
        </div>
      </div>

      <div className="footer-bottom-bar">
        <div className="footer-bottom-text">
          <p className="footer-copyright">منصة صحة معتمدة من قبل وزارة الصحة © 2026</p>
          <div className="bottom-links">
            <a href="#">سياسة الخصوصية</a>
            <span>|</span>
            <a href="#">شروط الاستخدام</a>
            <span>|</span>
            <a href="#">دليل الاستخدام</a>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="accessibility-btn-fixed"
        aria-label="إعدادات إتاحة الوصول"
      >
        <AccessibilityIcon />
      </button>

      {/* زر المساعد: الكرة يمينها زر المحادثة، وكلاهما يمرّ عبر بوابة الشروط
          والأحكام. يختفي الزر تماماً ما دامت النافذة مفتوحة كما في الفيديو. */}
      {!showTerms && (
      <div className="ai-widget-pill">
        <button
          type="button"
          className="ai-orb-wrap"
          aria-label="التحدث إلى المساعد الرقمي"
          onClick={requestAssistant}
        >
          <span className="ai-orb">
            <span className="ai-ripple" />
            <span className="ai-ripple-2" />
          </span>
        </button>
        <button
          type="button"
          className="ai-chat-icon"
          aria-label="بدء المحادثة مع المساعد الرقمي"
          aria-haspopup="dialog"
          onClick={requestAssistant}
        >
          <ChatDotsIcon />
        </button>
      </div>
      )}

      <button
        type="button"
        className={`scroll-top-btn${scrolled ? " is-visible" : ""}`}
        aria-label="العودة إلى الأعلى"
        aria-hidden={scrolled ? undefined : "true"}
        tabIndex={scrolled ? undefined : -1}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <ArrowUpIcon />
      </button>

      <p className="powered-by-text" aria-hidden="true">
        Powered by ElevenLabs <span className="powered-by-link">Agents</span>
      </p>

      {showTerms && (
        <>
          <button
            type="button"
            className="tc-backdrop"
            aria-label="إغلاق نافذة الشروط والأحكام"
            onClick={closeTerms}
          />
          <div
            className="tc-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tc-title"
          >
            <h2 className="tc-title" id="tc-title">الشروط والأحكام</h2>
            <p className="tc-body">
              يتم تسجيل وحفظ محتوى المحادثة وبيانات استخدامها لأغراض تشغيل الخدمة
              وتحسينها، وذلك وفقًا{" "}
              <strong>
                لشروط الاستخدام وسياسة الخصوصية المعتمدة في منصة صحة
              </strong>
              . تُولّد ردود المساعد الرقمي آليًا، وهي مخصصة لتقديم معلومات عامة
              فقط، ولا تُعد استشارة طبية، ولا ينبغي الاعتماد عليها في التعامل مع
              الحالات الطارئة أو في اتخاذ أي قرارات علاجية دون الرجوع إلى طبيب أو
              مختص صحي. يتحمل المستخدم كامل المسؤولية عن استخدام هذه المعلومات أو
              الاعتماد عليها، ويُعد استخدام الخدمة موافقة على هذه الأحكام،
              بالإضافة إلى شروط الاستخدام وسياسة الخصوصية المعتمدة.
            </p>
            <div className="tc-actions">
              <button type="button" className="tc-btn tc-btn-cancel" onClick={closeTerms}>
                إلغاء
              </button>
              <button type="button" className="tc-btn tc-btn-start" onClick={closeTerms}>
                ابدأ المحادثة
              </button>
            </div>
          </div>
        </>
      )}
    </footer>
  );
}

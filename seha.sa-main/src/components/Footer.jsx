import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

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

const AccessibilityIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="6.5" r="1.6" fill="currentColor" stroke="none" />
    <path d="M5.5 8.7c4.3 1.4 8.7 1.4 13 0" />
    <path d="M12 9.5v4.7" />
    <path d="M9.2 20.5l2.2-6.3h1.2l2.2 6.3" />
  </svg>
);

const ArrowUpIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

const ChatDotsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    <circle cx="8.5" cy="11.5" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="12" cy="11.5" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="11.5" r="0.8" fill="currentColor" stroke="none" />
  </svg>
);

export default function Footer() {
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
            <motion.a
              href="tel:920002005"
              className="footer-contact-item"
              whileHover={{ scale: 1.02, x: -5 }}
            >
              <div className="contact-icon-wrapper"><PhoneIcon /></div>
              <span>920002005</span>
            </motion.a>
            <motion.a
              href="mailto:support@seha.sa"
              className="footer-contact-item"
              whileHover={{ scale: 1.02, x: -5 }}
            >
              <div className="contact-icon-wrapper"><MailIcon /></div>
              <span>support@seha.sa</span>
            </motion.a>
            <motion.a
              href="https://wa.me/920002005"
              className="footer-contact-item"
              target="_blank"
              rel="noreferrer"
              whileHover={{ scale: 1.02, x: -5 }}
            >
              <div className="contact-icon-wrapper"><WhatsAppIcon /></div>
              <span>920002005</span>
            </motion.a>
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
          <motion.a
            href="https://www.youtube.com/channel/UCb9ZrS2YcriYqIPIHNp9wcQ"
            className="social-btn"
            target="_blank"
            rel="noreferrer"
            whileHover={{ y: -5, scale: 1.2 }}
          >
            <YouTubeIcon />
          </motion.a>
          <motion.a
            href="https://twitter.com/seha_services"
            className="social-btn"
            target="_blank"
            rel="noreferrer"
            whileHover={{ y: -5, scale: 1.2 }}
          >
            <XIcon />
          </motion.a>
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

      {/* عنصر شكلي فقط لمطابقة تصميم المرجع - غير متصل بأي خدمة حقيقية، لا ينفّذ أي إجراء عند الضغط */}
      <div className="floating-widget-cluster">
        <div className="ai-widget-pill" aria-hidden="true">
          <span className="ai-orb" />
          <span className="ai-chat-icon">
            <ChatDotsIcon />
          </span>
        </div>
        <button
          type="button"
          className="scroll-top-btn"
          aria-label="العودة إلى الأعلى"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <ArrowUpIcon />
        </button>
        <p className="powered-by-text" aria-hidden="true">
          Powered by ElevenLabs <span className="powered-by-link">Agents</span>
        </p>
      </div>
    </footer>
  );
}

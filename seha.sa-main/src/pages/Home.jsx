import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

function Home() {
  // أنيميشن ظهور البطاقات عند الدخول للصفحة
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 }
  }

  // أنيميشن الحركة عند Hover (صعود العنوان وهبوط المحتوى)
  const titleHover = {
    initial: { y: 0 },
    hover: { y: -35, transition: { duration: 0.4, ease: "easeOut" } }
  }

  const descriptionHover = {
    initial: { y: 15 },
    hover: { y: 0, transition: { duration: 0.4, ease: "easeOut" } }
  }

  return (
    <div dir="rtl" lang="ar">
      <main className="inquiries">
        <h1 className="heading">الاستعلامات</h1>
        <p className="sub-heading">حدد نوع الاستعلام</p>

        <motion.div
          className="cards-container"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* البطاقة 1: الإجازات المرضية */}
          <motion.div className="card" variants={cardVariants} whileHover="hover">
            <Link to="/inquiries/slenquiry">
              <motion.span variants={titleHover}>
                الإجازات المرضية
              </motion.span>
              <motion.div className="hidden" variants={descriptionHover}>
                <p>خدمة الاستعلام عن الإجازات المرضية تتيح لك الاستعلام عن حالة طلبك للإجازة ويمكنك طباعتها عن طريق تطبيق صحتي</p>
                <button>استعلام</button>
              </motion.div>
            </Link>
          </motion.div>

          {/* البطاقة 2: فحص اللياقة للطلبة */}
          <motion.div className="card" variants={cardVariants} whileHover="hover">
            <Link to="https://www.seha.sa/#/inquiries/mlenquiry">
              <motion.span variants={titleHover}>
                خدمة الاستعلام عن فحص اللياقة للطلبة المستجدين
              </motion.span>
              <motion.div className="hidden" variants={descriptionHover}>
                <p>خدمة الاستعلام عن فحص اللياقة للطلبة المستجدين تتيح لك الاستعلام عن حالة التقرير الطبي وتمكنك من تصدير وطباعة نسخة له</p>
                <button>استعلام</button>
              </motion.div>
            </Link>
          </motion.div>

          {/* البطاقة 3: شهادات فحص الزواج */}
          <motion.div className="card" variants={cardVariants} whileHover="hover">
            <Link to="https://premarriage.seha.sa/">
              <motion.span variants={titleHover}>
                خدمة الاستعلام عن شهادات فحص الزواج
              </motion.span>
              <motion.div className="hidden" variants={descriptionHover}>
                <p>خدمة الاستعلام عن نتيجة الفحص ماقبل الزواج تتيح لك الاستعلام عن حالة طلبك وتمكنك من تصدير وطباعة نسخة لها</p>
                <button>استعلام</button>
              </motion.div>
            </Link>
          </motion.div>

          {/* البطاقة 4: المنشآت الصحية */}
          <motion.div className="card" variants={cardVariants} whileHover="hover">
            <Link to="https://www.seha.sa/#/inquiries/organizations">
              <motion.span variants={titleHover}>
                الاستعلام عن المنشآت المقدمة للخدمات الصحية
              </motion.span>
              <motion.div className="hidden" variants={descriptionHover}>
                <p> يمكنك الاستعلام عن المنشآت المقدمة للخدمات الصحية</p>
                <button>استعلام</button>
              </motion.div>
            </Link>
          </motion.div>

          {/* البطاقة 5: فحص كورونا */}
          <motion.div className="card" variants={cardVariants} whileHover="hover">
            <Link to="https://www.seha.sa/#/inquiries/covid19report">
              <motion.span variants={titleHover}>
                التحقق من شهادة فحص فايروس كورونا المستجد (كوفيد-19)
              </motion.span>
              <motion.div className="hidden" variants={descriptionHover}>
                <p>خدمة الاستعلام تتيح التحقق من صحة تقرير فحص فايروس كورونا المستجد (كوفيد-19) عن طريق تقنية PCR</p>
                <button>استعلام</button>
              </motion.div>
            </Link>
          </motion.div>

          {/* البطاقة 6: شهادة التطعيم */}
          <motion.div className="card" variants={cardVariants} whileHover="hover">
            <Link to="https://vaccinecertificate.sehhaty.sa/">
              <motion.span variants={titleHover}>
                عرض التقرير الطبي وشهادة التطعيم
              </motion.span>
              <motion.div className="hidden" variants={descriptionHover}>
                <p>خدمة الاستعلام عن التقارير الطبية والشهادات الخاصة بالتطعيمات تتيح امكانية التحقق من صحة البيانات الواردة في التقرير الطبي و شهادة التطعيم</p>
                <button>استعلام</button>
              </motion.div>
            </Link>
          </motion.div>

          {/* البطاقة 7: الشهادات الصحية (أمانات) */}
          <motion.div className="card" variants={cardVariants} whileHover="hover">
            <Link to="https://www.seha.sa/#/inquiries/AmanatInquiry">
              <motion.span variants={titleHover}>
                الشهادات الصحية
              </motion.span>
              <motion.div className="hidden" variants={descriptionHover}>
                <p>خدمة الاستعلام للشهادات الصحية (أمانات) تتيح لك الاستعلام عن تقريرك الطبي وتمكنك من تصديره وطباعته</p>
                <button>استعلام</button>
              </motion.div>
            </Link>
          </motion.div>

          {/* البطاقة 8: رخص القيادة */}
          <motion.div className="card" variants={cardVariants} whileHover="hover">
            <Link to="https://www.seha.sa/#/inquiries/DrivingLicenseInquiry">
              <motion.span variants={titleHover}>
                رخص القيادة
              </motion.span>
              <motion.div className="hidden" variants={descriptionHover}>
                <p>خدمة الاستعلام للفحص الطبي لرخص القيادة تتيح لك الاستعلام عن تقريرك الطبي وتمكنك من تصديره وطباعته</p>
                <button>استعلام</button>
              </motion.div>
            </Link>
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}

export default Home

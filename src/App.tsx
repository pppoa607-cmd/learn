import { useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut,
  type User
} from "firebase/auth";
import {
  addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp,
  setDoc, where
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  BookOpen, Users, CalendarCheck, ClipboardList, Wallet, Bell, LogOut, Menu,
  GraduationCap, ShieldCheck, FileText, Video, Plus, Search, Clock3, CircleDollarSign,
  CheckCircle2, AlertCircle, Upload, X, LayoutDashboard
} from "lucide-react";
import { auth, db, storage, googleProvider, firebaseConfigured } from "./firebase";

const ADMIN_EMAILS = ["ozilziad24@gmail.com", "zt067313@gmail.com"];
type Role = "admin" | "student";
type Profile = { uid: string; displayName: string; email: string; role: Role; studentCode?: string; status?: string };
type Course = { id: string; title: string; subject?: string; description?: string; resourceUrl?: string; createdAt?: any };
type Payment = { id: string; studentUid: string; amountPiasters: number; note?: string; status: string; createdAt?: any };
type Section = "overview" | "students" | "courses" | "attendance" | "exams" | "finance";

function money(piasters: number) {
  return new Intl.NumberFormat("ar-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 2 }).format((piasters || 0) / 100);
}
function dateText(v: any) {
  try { return v?.toDate ? v.toDate().toLocaleString("ar-EG") : "—"; } catch { return "—"; }
}
function initials(name = "") { return name.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join("") || "ط"; }

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notice, setNotice] = useState("");
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseSubject, setCourseSubject] = useState("");
  const [courseDesc, setCourseDesc] = useState("");
  const [courseFile, setCourseFile] = useState<File | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [search, setSearch] = useState("");

  const isAdmin = profile?.role === "admin";
  const nav = useMemo(() => [
    { id: "overview" as Section, label: "الرئيسية", icon: LayoutDashboard },
    ...(isAdmin ? [{ id: "students" as Section, label: "إدارة الطلاب", icon: Users }] : []),
    { id: "courses" as Section, label: "المناهج والدروس", icon: BookOpen },
    { id: "attendance" as Section, label: "الحضور والغياب", icon: CalendarCheck },
    { id: "exams" as Section, label: "الامتحانات", icon: ClipboardList },
    { id: "finance" as Section, label: "المصاريف", icon: Wallet },
  ], [isAdmin]);

  useEffect(() => {
    if (!auth || !db) { setLoading(false); return; }
    const unsubscribe = onAuthStateChanged(auth, async current => {
      setUser(current);
      setProfile(null);
      if (!current || !db) { setLoading(false); return; }
      try {
        const email = (current.email || "").toLowerCase();
        const isAllowlisted = ADMIN_EMAILS.includes(email);
        const userRef = doc(db, "users", current.uid);
        const existing = await getDoc(userRef);
        // Client never upgrades a role. Existing admin role must have been provisioned securely.
        if (!existing.exists()) {
          await setDoc(userRef, {
            uid: current.uid, displayName: current.displayName || "طالب جديد",
            email, role: "student", status: "active", createdAt: serverTimestamp()
          });
        }
        const fresh = await getDoc(userRef);
        const data = fresh.data() as Profile;
        // Allowlist alone is NOT treated as admin; a trusted backend must provision this role.
        setProfile({ ...data, uid: current.uid, role: data.role === "admin" && isAllowlisted ? "admin" : "student" });
      } catch (e: any) {
        setNotice("تعذر تحميل الحساب. تأكد من إعداد Firebase وقواعد الأمان.");
      } finally { setLoading(false); }
    });
    getRedirectResult(auth).catch(() => {});
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!db || !profile) return;
    let alive = true;
    (async () => {
      try {
        const cq = query(collection(db!, "courses"), orderBy("createdAt", "desc"), limit(50));
        const cs = await getDocs(cq);
        if (alive) setCourses(cs.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
        if (profile.role === "admin") {
          const sq = query(collection(db!, "users"), where("role", "==", "student"), limit(200));
          const ss = await getDocs(sq);
          if (alive) setStudents(ss.docs.map(d => ({ uid: d.id, ...d.data() } as Profile)));
          const pq = query(collection(db!, "paymentRequests"), orderBy("createdAt", "desc"), limit(100));
          const ps = await getDocs(pq);
          if (alive) setPayments(ps.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
        } else {
          const pq = query(collection(db!, "paymentRequests"), where("studentUid", "==", profile.uid), orderBy("createdAt", "desc"), limit(50));
          const ps = await getDocs(pq);
          if (alive) setPayments(ps.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
        }
      } catch { /* Rules may deny sections until backend/rules are deployed. */ }
    })();
    return () => { alive = false; };
  }, [profile, section]);

  async function login() {
    if (!auth) return;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      if (e?.code === "auth/popup-blocked" || e?.code === "auth/popup-closed-by-user") {
        try { await signInWithRedirect(auth, googleProvider); } catch { setNotice("تعذر فتح تسجيل الدخول. جرّب مرة أخرى."); }
      } else setNotice("فشل تسجيل الدخول: " + (e?.message || "خطأ غير معروف"));
    }
  }
  async function logout() { if (auth) await signOut(auth); setProfile(null); setUser(null); }

  async function createCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!db || !storage || !profile || !isAdmin) return;
    if (!courseTitle.trim()) { setNotice("اكتب اسم المادة أولًا."); return; }
    try {
      let resourceUrl = "";
      if (courseFile) {
        const path = `courseFiles/${profile.uid}/${Date.now()}-${courseFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const uploaded = await uploadBytes(ref(storage, path), courseFile, { contentType: courseFile.type });
        resourceUrl = await getDownloadURL(uploaded.ref);
      }
      const newCourse = {
        title: courseTitle.trim(), subject: courseSubject.trim(), description: courseDesc.trim(),
        resourceUrl, createdBy: profile.uid, createdAt: serverTimestamp(), published: true
      };
      const added = await addDoc(collection(db, "courses"), newCourse);
      setCourses(prev => [{ id: added.id, ...newCourse }, ...prev]);
      setCourseTitle(""); setCourseSubject(""); setCourseDesc(""); setCourseFile(null); setShowCourseForm(false);
      setNotice("تمت إضافة المادة. راجع إعدادات التخزين إذا كان الملف غير متاح للطلاب.");
    } catch { setNotice("لم تتم إضافة المادة. تأكد من صلاحيات الأدمن وقواعد Storage."); }
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!db || !profile) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setNotice("اكتب مبلغًا صحيحًا."); return; }
    try {
      const entry = {
        studentUid: profile.uid, studentName: profile.displayName, amountPiasters: Math.round(amount * 100),
        note: paymentNote.trim(), status: "pending", method: "manual-review", createdAt: serverTimestamp()
      };
      const created = await addDoc(collection(db, "paymentRequests"), entry);
      setPayments(prev => [{ id: created.id, ...entry }, ...prev] as Payment[]);
      setPaymentAmount(""); setPaymentNote("");
      setNotice("تم إرسال طلب الدفع للمراجعة. لن يتم احتسابه مدفوعًا قبل تأكيد الأدمن.");
    } catch { setNotice("تعذر إرسال الطلب. تحقق من إعداد قاعدة البيانات."); }
  }

  async function updatePayment(p: Payment, status: "confirmed" | "rejected") {
    // Client intentionally cannot update payment status; trusted backend function is required.
    setNotice("تأكيد أو رفض الدفعات يحتاج Cloud Function بصلاحية أدمن. لن نغيّر الحالة من المتصفح.");
  }

  if (loading) return <div className="loading-screen"><div className="brand-mark">L</div><p>جاري تجهيز منصة LEARNING...</p></div>;

  if (!firebaseConfigured) return <div className="setup-page" dir="rtl">
    <div className="setup-card">
      <div className="brand-mark">L</div>
      <p className="eyebrow">منصة تعليمية متكاملة</p><h1>LEARNING</h1>
      <p className="muted">المشروع جاهز للتوصيل بقاعدة Firebase الخاصة بك.</p>
      <div className="warning"><AlertCircle size={20}/><span>لم يتم إعداد بيانات Firebase بعد؛ تسجيل الدخول والبيانات الحقيقية لن تعمل حتى يتم الربط.</span></div>
      <h3>خطوات التفعيل</h3>
      <ol>
        <li>أنشئ مشروعًا من <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer">Firebase Console</a>.</li>
        <li>أضف Web App من إعدادات المشروع وانسخ إعدادات Firebase.</li>
        <li>انسخ ملف <code>.env.example</code> إلى <code>.env.local</code> وضع القيم المطلوبة.</li>
        <li>فعّل Google Authentication وأنشئ Firestore وStorage.</li>
        <li>طبّق قواعد الأمان وتعليمات النشر الموجودة في README.</li>
      </ol>
      <p className="small">هذه شاشة إعداد وليست تسجيل دخول تجريبيًا؛ لن نعرض بيانات وهمية على أنها حقيقية.</p>
    </div>
  </div>;

  if (!user || !profile) return <div className="login-page" dir="rtl">
    <div className="login-art"><div className="orb orb1"/><div className="orb orb2"/><div className="art-content">
      <div className="brand-line"><div className="brand-mark">L</div><span>LEARNING</span></div>
      <p className="eyebrow">مستقبلك يبدأ بخطوة</p><h1>اتعلّم بذكاء،<br/><span>واتقدّم بثقة.</span></h1>
      <p className="muted">كل دروسك ومتابعتك التعليمية في مكان واحد.</p>
      <div className="feature-row"><span><BookOpen size={17}/> مناهج منظمة</span><span><CalendarCheck size={17}/> متابعة الحضور</span></div>
    </div></div>
    <div className="login-panel"><div className="login-box"><div className="mobile-logo"><div className="brand-mark">L</div><b>LEARNING</b></div>
      <p className="eyebrow">أهلًا بيك من جديد</p><h2>سجّل دخولك</h2><p className="muted">استخدم حساب Google للوصول إلى لوحة التحكم الخاصة بك.</p>
      {notice && <div className="notice">{notice}</div>}
      <button className="google-button" onClick={login}><span className="google-g">G</span> المتابعة باستخدام Google</button>
      <p className="small center">بتسجيل الدخول، أنت توافق على استخدام المنصة وفقًا لسياسة الخصوصية.</p>
    </div><footer>© {new Date().getFullYear()} LEARNING · جميع الحقوق محفوظة</footer></div>
  </div>;

  const titleMap: Record<Section, string> = {
    overview: "الرئيسية", students: "إدارة الطلاب", courses: "المناهج والدروس",
    attendance: "الحضور والغياب", exams: "الامتحانات", finance: "المصاريف"
  };
  const filteredStudents = students.filter(s => `${s.displayName} ${s.email} ${s.studentCode || ""}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="app-shell" dir="rtl">
    {mobileMenu && <button className="scrim" aria-label="إغلاق القائمة" onClick={() => setMobileMenu(false)}/>}
    <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
      <div className="sidebar-brand"><div className="brand-mark">L</div><div><b>LEARNING</b><small>منصتك التعليمية</small></div></div>
      <div className="side-label">القائمة الرئيسية</div>
      <nav>{nav.map(item => <button key={item.id} className={`nav-item ${section === item.id ? "active" : ""}`} onClick={() => { setSection(item.id); setMobileMenu(false); }}>
        <item.icon size={19}/><span>{item.label}</span>{item.id === "overview" && <span className="nav-dot"/>}
      </button>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><GraduationCap size={20}/></div><b>محتاج مساعدة؟</b><p>تواصل مع إدارة المنصة لمساعدتك.</p></div>
        <button className="nav-item logout" onClick={logout}><LogOut size={19}/> تسجيل الخروج</button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="top-left"><button className="icon-button menu-button" onClick={() => setMobileMenu(true)}><Menu size={21}/></button><div><h2>{titleMap[section]}</h2><p>{new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p></div></div>
        <div className="top-actions"><button className="icon-button" title="الإشعارات"><Bell size={19}/></button><div className="user-chip"><div className="avatar">{initials(profile.displayName)}</div><div className="user-info"><b>{profile.displayName}</b><span>{isAdmin ? "مدير المنصة" : "طالب"}</span></div></div></div>
      </header>
      <div className="content">
        {notice && <div className="notice dismissible">{notice}<button onClick={() => setNotice("")}><X size={16}/></button></div>}
        {section === "overview" && <>
          <div className="welcome-banner"><div><p className="eyebrow">{isAdmin ? "لوحة الإدارة" : "مساحتك التعليمية"}</p><h1>أهلًا، {profile.displayName.split(" ")[0]} 👋</h1><p>{isAdmin ? "تابع نشاط المنصة وإدارة الطلاب من مكان واحد." : "جاهز تكمل رحلتك التعليمية؟ كل حاجة مستنياك هنا."}</p></div><div className="banner-icon"><GraduationCap size={54}/></div></div>
          <div className="stats-grid">
            <Stat icon={<Users/>} label={isAdmin ? "إجمالي الطلاب" : "كود الطالب"} value={isAdmin ? String(students.length) : (profile.studentCode || "بانتظار التخصيص")} tone="purple"/>
            <Stat icon={<BookOpen/>} label="المناهج المتاحة" value={String(courses.length)} tone="blue"/>
            <Stat icon={<ClipboardList/>} label="الامتحانات" value="—" tone="orange"/>
            <Stat icon={<Wallet/>} label={isAdmin ? "طلبات الدفع" : "طلبات الدفع"} value={String(payments.length)} tone="green"/>
          </div>
          <div className="section-heading"><div><h3>{isAdmin ? "أحدث المناهج" : "مناهجك الدراسية"}</h3><p>المحتوى المنشور على المنصة</p></div><button className="text-button" onClick={() => setSection("courses")}>عرض الكل ←</button></div>
          <div className="course-grid">{courses.slice(0, 3).map(c => <CourseCard key={c.id} course={c}/>)}
            {courses.length === 0 && <Empty icon={<BookOpen/>} title="لسه مفيش مناهج" text={isAdmin ? "ابدأ بإضافة أول مادة دراسية." : "المناهج هتظهر هنا لما الإدارة تنشرها."}/>}
          </div>
          {isAdmin && <div className="section-heading"><div><h3>متابعة سريعة</h3><p>ملخص إدارة المنصة</p></div></div>}
          {isAdmin && <div className="quick-grid"><Quick icon={<Users/>} title="إدارة الطلاب" text="عرض الطلاب المسجلين وأكوادهم" onClick={() => setSection("students")}/><Quick icon={<Wallet/>} title="المصاريف" text="مراجعة طلبات الدفع" onClick={() => setSection("finance")}/><Quick icon={<CalendarCheck/>} title="الحضور" text="متابعة الحضور والغياب" onClick={() => setSection("attendance")}/></div>}
        </>}
        {section === "students" && isAdmin && <><div className="section-heading"><div><h3>الطلاب المسجلون</h3><p>قائمة الطلاب من قاعدة البيانات</p></div><span className="count-pill">{students.length} طالب</span></div>
          <div className="table-tools"><div className="search-box"><Search size={18}/><input placeholder="ابحث بالاسم أو الإيميل أو الكود..." value={search} onChange={e => setSearch(e.target.value)}/></div></div>
          <div className="table-wrap"><table><thead><tr><th>الطالب</th><th>البريد الإلكتروني</th><th>كود الطالب</th><th>الحالة</th></tr></thead><tbody>
            {filteredStudents.map(s => <tr key={s.uid}><td><div className="person-cell"><div className="avatar">{initials(s.displayName)}</div><b>{s.displayName}</b></div></td><td>{s.email}</td><td><code>{s.studentCode || "لم يُخصص بعد"}</code></td><td><span className="status active">{s.status || "نشط"}</span></td></tr>)}
            {filteredStudents.length === 0 && <tr><td colSpan={4}><Empty icon={<Users/>} title="لا يوجد طلاب" text="سيظهر الطلاب هنا بعد التسجيل." /></td></tr>}
          </tbody></table></div>
        </>}
        {section === "courses" && <><div className="section-heading"><div><h3>المناهج والدروس</h3><p>المواد والملفات التعليمية المتاحة</p></div>{isAdmin && <button className="primary-button" onClick={() => setShowCourseForm(v => !v)}><Plus size={18}/> إضافة منهج</button>}</div>
          {showCourseForm && isAdmin && <form className="form-card" onSubmit={createCourse}><div className="form-title"><h3>إضافة منهج جديد</h3><button type="button" className="icon-button" onClick={() => setShowCourseForm(false)}><X size={18}/></button></div>
            <label>اسم المادة<input required value={courseTitle} onChange={e => setCourseTitle(e.target.value)} placeholder="مثال: الرياضيات"/></label>
            <label>اسم المدرس أو المجموعة<input value={courseSubject} onChange={e => setCourseSubject(e.target.value)} placeholder="مثال: الصف الثالث الثانوي"/></label>
            <label>وصف المنهج<textarea value={courseDesc} onChange={e => setCourseDesc(e.target.value)} placeholder="اكتب وصفًا مختصرًا"/></label>
            <label className="file-field"><Upload size={18}/> {courseFile ? courseFile.name : "اختيار ملف PDF أو مادة تعليمية"}<input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,video/*" onChange={e => setCourseFile(e.target.files?.[0] || null)}/></label>
            <button className="primary-button" type="submit"><Plus size={18}/> نشر المنهج</button>
          </form>}
          <div className="course-grid">{courses.map(c => <CourseCard key={c.id} course={c}/>)}{courses.length === 0 && <Empty icon={<BookOpen/>} title="لا توجد مناهج حتى الآن" text={isAdmin ? "اضغط إضافة منهج لرفع أول محتوى." : "ستظهر المناهج هنا عندما تنشرها الإدارة."}/>}</div>
        </>}
        {section === "attendance" && <div className="placeholder-panel"><div className="placeholder-icon"><CalendarCheck size={30}/></div><h3>الحضور والغياب</h3><p>واجهة القسم جاهزة. تسجيل الحضور الفعلي يحتاج جلسات محاضرات وقواعد بيانات وعمليات خلفية آمنة قبل استخدامه مع الطلاب.</p>{isAdmin && <div className="warning"><AlertCircle size={18}/> لا تسجل حضورًا حقيقيًا قبل تفعيل backend وقواعد الأمان.</div>}</div>}
        {section === "exams" && <div className="placeholder-panel"><div className="placeholder-icon"><ClipboardList size={30}/></div><h3>الامتحانات والدرجات</h3><p>القسم يحتاج تنفيذًا خلفيًا للأسئلة والتسليم والتصحيح. درجات الطلاب لا تُعرض هنا كتجربة وهمية.</p><div className="secure-note"><ShieldCheck size={19}/> الدرجات والإجابات الصحيحة يجب أن تكون محفوظة في مسارات لا يستطيع الطالب قراءتها.</div></div>}
        {section === "finance" && <><div className="section-heading"><div><h3>{isAdmin ? "طلبات الدفع" : "مصاريفي"}</h3><p>{isAdmin ? "طلبات تحتاج إلى مراجعة الإدارة" : "قدّم طلب دفع وتابع حالته"}</p></div></div>
          {!isAdmin && <form className="form-card narrow" onSubmit={submitPayment}><h3>إرسال طلب دفع</h3><p className="muted">الطلب سيظل قيد المراجعة حتى يتحقق الأدمن من الدفع.</p><label>المبلغ بالجنيه المصري<input type="number" min="1" step="0.01" required value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="مثال: 500"/></label><label>ملاحظة أو رقم مرجعي (اختياري)<input value={paymentNote} onChange={e => setPaymentNote(e.target.value)} placeholder="لا تكتب رقم PIN أو بيانات سرية"/></label><button className="primary-button"><CircleDollarSign size={18}/> إرسال للمراجعة</button></form>}
          <div className="table-wrap"><table><thead><tr><th>الطالب</th><th>المبلغ</th><th>التاريخ</th><th>الحالة</th>{isAdmin && <th>الإجراء</th>}</tr></thead><tbody>
            {payments.map(p => <tr key={p.id}><td>{p.studentName || (isAdmin ? p.studentUid : profile.displayName)}</td><td>{money(p.amountPiasters)}</td><td>{dateText(p.createdAt)}</td><td><span className={`status ${p.status === "confirmed" ? "active" : p.status === "rejected" ? "inactive" : "pending"}`}>{p.status === "confirmed" ? "مؤكد" : p.status === "rejected" ? "مرفوض" : "قيد المراجعة"}</span></td>{isAdmin && <td><button className="text-button" onClick={() => updatePayment(p, "confirmed")}>مراجعة عبر backend</button></td>}</tr>)}
            {payments.length === 0 && <tr><td colSpan={isAdmin ? 5 : 4}><Empty icon={<Wallet/>} title="لا توجد عمليات دفع" text={isAdmin ? "طلبات الدفع ستظهر هنا." : "لم ترسل أي طلب دفع حتى الآن."}/></td></tr>}
          </tbody></table></div>
          <div className="secure-note"><ShieldCheck size={18}/> هذا النموذج يسجل طلب دفع فقط، ولا يؤكد وصول الأموال أو يخصم الرصيد تلقائيًا.</div>
        </>}
      </div>
    </main>
  </div>;
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div><p>{label}</p><strong>{value}</strong></div><span className="stat-spark">↗</span></div>;
}
function CourseCard({ course }: { course: Course }) {
  return <article className="course-card"><div className="course-cover"><div className="cover-orb"/><div className="cover-icon"><BookOpen size={28}/></div><span className="course-tag">{course.subject || "مادة تعليمية"}</span></div>
    <div className="course-body"><h4>{course.title}</h4><p>{course.description || "محتوى تعليمي مضاف إلى منصة LEARNING."}</p>
      <div className="course-meta"><span><FileText size={15}/> ملفات ودروس</span><span><Clock3 size={15}/> متاح الآن</span></div>
      {course.resourceUrl && <a className="resource-link" href={course.resourceUrl} target="_blank" rel="noreferrer"><Video size={16}/> فتح المحتوى</a>}
    </div>
  </article>;
}
function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><b>{title}</b><p>{text}</p></div>;
}
function Quick({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick: () => void }) {
  return <button className="quick-card" onClick={onClick}><div className="quick-icon">{icon}</div><div><b>{title}</b><p>{text}</p></div><span>←</span></button>;
}

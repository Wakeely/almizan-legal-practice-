export type Language = 'ar' | 'en';

export interface TranslationDict {
  appName: string;
  middleEastEdition: string;
  activeCase: string;
  selectCase: string;
  newIntake: string;
  lawyerMode: string;
  clientMode: string;
  languageToggle: string;
  
  // Intake Form
  intakeTitle: string;
  intakeSub: string;
  matterTitle: string;
  clientName: string;
  clientEmail: string;
  jurisdiction: string;
  initialBudget: string;
  opposingParty: string;
  opposingCounsel: string;
  cancel: string;
  registerIntake: string;

  // Case Profile
  caseProfile: string;
  riskLevel: string;
  judge: string;
  statuteDeadline: string;
  budgetCap: string;
  spent: string;
  winProb: string;
  aiStrategy: string;
  
  // AI Risk Assessment
  sccaEngine: string;
  simulateTitle: string;
  simulateDesc: string;
  analyzeBtn: string;
  aiCoreFindings: string;
  riskIndex: string;
  successRatio: string;
  strategyDirectives: string;

  // Documents
  docManagement: string;
  filesCount: string;
  dragDrop: string;
  fileLimits: string;
  fileNamePlaceholder: string;
  category: string;
  addFile: string;
  noDocs: string;
  visiblePortal: string;
  internalOffice: string;
  version: string;
  runOcr: string;
  aiSummaryHeader: string;
  aiTagsHeader: string;
  selectDocPrompt: string;
  triggerAnalysis: string;
  analyzingText: string;

  // Tasks
  workflowTitle: string;
  addTask: string;
  taskTitleLabel: string;
  assignedLawyer: string;
  assignedStaff: string;
  taskDescLabel: string;
  dueDate: string;
  priority: string;
  clientVisible: string;
  saveTask: string;
  noTasks: string;
  back: string;
  next: string;
  completed: string;

  // Billing
  billingTitle: string;
  unbilledLedger: string;
  outstanding: string;
  sentInvoices: string;
  generateInvoice: string;
  trustFunds: string;
  realization: string;
  stopwatchTitle: string;
  startActive: string;
  stopLog: string;
  manualLogBtn: string;
  logHoursLabel: string;
  timeEntryDesc: string;
  hoursLogged: string;
  saveTime: string;
  emptyTimeLedger: string;
  emptyInvoiceHistory: string;
  clearPayment: string;

  // AI Copilot
  aiCopilotTitle: string;
  poweredBy: string;
  draftTemplate: string;
  demandNotice: string;
  settlementAccord: string;
  arbitrationPetition: string;
  statementDefense: string;
  draftDirectives: string;
  draftDirectivesPlaceholder: string;
  draftBtn: string;
  draftReady: string;
  copyBtn: string;
  copiedBtn: string;
  noDraftPrompt: string;
  draftLegalNotes: string;

  // Client Portal
  clientTransparency: string;
  loggedClient: string;
  auditTrail: string;
  noMilestones: string;
  settlementTitle: string;
  noInvoices: string;
  sharedFiles: string;
  noFilesShared: string;
  secureMessaging: string;
  noMessages: string;
  messagingPlaceholder: string;
  safeAiAssistant: string;
  permissionsChecked: string;
  safeAiTitle: string;
  safeAiDesc: string;
  safeAiPlaceholder: string;
  askAiBtn: string;
  advisorResponse: string;

  // Analytics Bento Cards
  riskFactorIndex: string;
  riskFactorDesc: string;
  resourceAllocation: string;
  allocatedStaff: string;
  primaryObjective: string;
  contractSaturation: string;
  complianceRating: string;
  pleadingCapStatus: string;
  budgetBalance: string;
  budgetExhausted: string;

  // Notifications
  notificationsTitle: string;
  unreadNotifications: string;
  emptyNotifications: string;
  markAllRead: string;
  urgentDeadline: string;
  pendingApproval: string;
  clientMessage: string;
  approveDocBtn: string;
  completeTaskBtn: string;
  notificationDismissed: string;
  notificationApproved: string;
  notificationCompleted: string;

  // Mobile App Native Navigation
  mobileNavMenu: string;
  mobileNavOverview: string;
  mobileNavTasks: string;
  mobileNavDocs: string;
  mobileNavAi: string;
  mobileNavBilling: string;
  mobileNavClient: string;
  mobileNavLawyer: string;
  mobileNavAll: string;
  mobileQuickActions: string;
  mobileCases: string;
  mobileDrawerTitle: string;
  mobileSiteEndpoints: string;
  mobileActiveCases: string;

  // Footer
  firmHash: string;
  copyright: string;
  matrixVer: string;

  // Global Search
  globalSearchPlaceholder: string;
  globalSearchTitle: string;
  globalSearchSub: string;
  globalSearchShortcut: string;
  searchFilterAll: string;
  searchFilterMatters: string;
  searchFilterDocs: string;
  searchFilterTasks: string;
  noSearchResults: string;
  openMatter: string;
  jumpTo: string;
  searchTypeMatter: string;
  searchTypeDoc: string;
  searchTypeTask: string;

  // Offline Mode & Storage
  offlineMode: string;
  offlineModeActive: string;
  offlineCachedNotice: string;
  onlineReconnected: string;
  syncingOfflineData: string;
  // Offline Mode & Storage — additional keys for write-queue / PWA UX
  offlinePendingChanges: string;          // "N pending changes"
  offlineLastSynced: string;              // "Last synced HH:MM"
  offlineNeverSynced: string;             // "Never synced"
  offlineSyncNow: string;                 // "Sync now"
  offlineSyncFailed: string;              // "Sync failed: <reason>"
  offlineMakeAvailable: string;           // "Make this matter available offline"
  offlineMakeAvailableProgress: string;   // "Caching matter for offline use…"
  offlineMakeAvailableDone: string;       // "Cached for offline use"
  offlineMakeAvailableFailed: string;     // "Could not cache matter offline"
  offlineAiRequiresNetwork: string;       // "AI features require an internet connection"

  // RAG — Legal Retrieval-Augmented Generation (grounded Q&A)
  ragTabAsk: string;                      // "Ask with Sources"
  ragTabDraft: string;                    // "Draft" (existing copilot tab)
  ragSubtitle: string;                    // "Curated Jordanian legal corpus + your matter files"
  ragPlaceholder: string;                 // "Ask a legal question grounded in this matter's files and Jordanian law…"
  ragAskBtn: string;                      // "Ask"
  ragToggleMatter: string;                // "Search matter files"
  ragToggleCorpus: string;                // "Search Jordanian law"
  ragGrounded: string;                    // "Grounded — N sources"
  ragUngrounded: string;                  // "No sources cited"
  ragNoSources: string;                   // "No supporting material found"
  ragDisclaimer: string;                  // "AI-assisted. Non-authoritative — lawyer remains responsible."
  ragSourceStatute: string;               // "Statute"
  ragSourceDocument: string;              // "Document"
  ragSourceTranscript: string;            // "Transcript"
  ragMatterHits: string;                  // "Matter files: N"
  ragCorpusHits: string;                  // "Corpus articles: N"
  ragTextFallback: string;                // "Vector search unavailable — using text search"
  ragThinking: string;                    // "Searching files and Jordanian law…"
  ragErrorGeneric: string;                // "Could not complete the request."
  ragSourcesTitle: string;                // "Sources"
  ragShowExcerpt: string;                 // "Show excerpt"
  ragHideExcerpt: string;                 // "Hide excerpt"
}

export const translations: Record<Language, TranslationDict> = {
  ar: {
    appName: "الميزان",
    middleEastEdition: "نسخة الشرق الأوسط",
    activeCase: "القضية النشطة",
    selectCase: "اختر القضية",
    newIntake: "قيد قضية جديد",
    lawyerMode: "بوابة المحامي",
    clientMode: "بوابة الموكل",
    languageToggle: "English",

    // Intake Form
    intakeTitle: "استمارة قيد قضية جديدة",
    intakeSub: "إدخال بيانات نزاع قضائي معقد في قاعدة بيانات المكتب.",
    matterTitle: "عنوان القضية",
    clientName: "اسم الموكل",
    clientEmail: "البريد الإلكتروني للموكل",
    jurisdiction: "الاختصاص القضائي",
    initialBudget: "الميزانية الأولية (دينار أردني)",
    opposingParty: "الطرف الخصم",
    opposingCounsel: "محامي الخصم",
    cancel: "إلغاء",
    registerIntake: "تسجيل القضية",

    // Case Profile
    caseProfile: "ملف القضية",
    riskLevel: "مستوى الخطورة",
    judge: "القاضي / المحكم",
    statuteDeadline: "تاريخ سقوط الحق / التقادم",
    budgetCap: "ميزانية أتعاب المكتب",
    spent: "المصروف",
    winProb: "نسبة النجاح المتوقعة",
    aiStrategy: "الخطة الاستراتيجية المعدة بالذكاء الاصطناعي",

    // AI Risk Assessment
    sccaEngine: "محرك التحكيم والمراجعة الشرعية",
    simulateTitle: "محاكاة المخاطر والإنفاذ الاستراتيجي",
    simulateDesc: "التحقق من السوابق القضائية، والامتثال لأحكام المعاملات المدنية، والتنبؤ بنتائج هيئات التحكيم والمحاكم.",
    analyzeBtn: "تحليل القضية",
    aiCoreFindings: "النتائج التحليلية الرئيسية للذكاء الاصطناعي",
    riskIndex: "مؤشر المخاطر القضائية",
    successRatio: "نسبة كسب الدعوى",
    strategyDirectives: "توجيهات خطة الدفاع الاستراتيجية",

    // Documents
    docManagement: "إدارة المستندات والتعرف الضوئي (OCR)",
    filesCount: "ملفات",
    dragDrop: "اسحب وأسقط المذكرات القانونية أو العقود هنا",
    fileLimits: "ملفات PDF أو Word أو صور ممسوحة حتى 25 ميجابايت",
    fileNamePlaceholder: "اسم الملف (مثال: لائحة_الدعوى_المعدلة.pdf)",
    category: "التصنيف",
    addFile: "إضافة ملف",
    noDocs: "لم يتم رفع أي مستندات لهذه القضية بعد.",
    visiblePortal: "مرئي في بوابة الموكل",
    internalOffice: "للاستخدام الداخلي بالمكتب فقط",
    version: "الإصدار",
    runOcr: "بدء تحليل البنود عبر الذاكاء الاصطناعي",
    aiSummaryHeader: "ملخص المستند وسجل المخاطر المؤتمت من جيمي",
    aiTagsHeader: "الوسوم الدلالية المستخرجة بالذكاء الاصطناعي",
    selectDocPrompt: "اختر مستنداً من القائمة الجانبية لمعاينة محتوياته وتلخيصه الذكي.",
    triggerAnalysis: "تشغيل تحليل مستندات جيمي",
    analyzingText: "جاري تحليل النص القانوني عبر جيمي...",

    // Tasks
    workflowTitle: "سير إجراءات التقاضي والمواعيد النهائية",
    addTask: "إضافة مهمة",
    taskTitleLabel: "عنوان المهمة",
    assignedLawyer: "المحامي المسؤول",
    assignedStaff: "الموظف المسؤول",
    taskDescLabel: "تفاصيل المهمة",
    dueDate: "تاريخ الاستحقاق",
    priority: "الأولوية",
    clientVisible: "مرئي للموكل",
    saveTask: "حفظ المهمة",
    noTasks: "لا توجد مهام",
    back: "السابق",
    next: "التالي",
    completed: "تم إنجازها",

    // Billing
    billingTitle: "الوقت والأتعاب وحسابات الأمانة",
    unbilledLedger: "دفتر الساعات غير المفوترة",
    outstanding: "ساعة معلقة",
    sentInvoices: "إجمالي الفواتير المرسلة",
    generateInvoice: "إصدار فاتورة جديدة",
    trustFunds: "أموال الأمانة المستلمة والمصفاة",
    realization: "نسبة التحصيل",
    stopwatchTitle: "ساعة تتبع الوقت التفاعلية",
    startActive: "بدء تتبع وقت المرافعة",
    stopLog: "إيقاف وتسجيل الوقت",
    manualLogBtn: "إدخال يدوي لوقت العمل",
    logHoursLabel: "ساعات العمل المنجزة",
    timeEntryDesc: "وصف العمل القانوني المنجز",
    hoursLogged: "الساعات المسجلة",
    saveTime: "حفظ الساعات",
    emptyTimeLedger: "لا توجد ساعات مسجلة بعد لهذه القضية.",
    emptyInvoiceHistory: "لا يوجد سجل فواتير صادرة بعد.",
    clearPayment: "تسوية الحساب وصرف الدفعة",

    // AI Copilot
    aiCopilotTitle: "مساعد الذكاء الاصطناعي لصياغة المذكرات والدفوع",
    poweredBy: "مدعوم بنظام الخادم التفاعلي",
    draftTemplate: "نموذج المستند المراد صياغته",
    demandNotice: "إنذار رسمي بالدفع / إعذار",
    settlementAccord: "اتفاقية تسوية ودية",
    arbitrationPetition: "لائحة دعوى تحكيم SCCA",
    statementDefense: "مذكرة جوابية بالدفاع والمرافعة",
    draftDirectives: "التوجيهات والتعليمات الخاصة بالصياغة",
    draftDirectivesPlaceholder: "مثال: الصياغة وفق نظام المعاملات المدنية السعودي، اشتراط السداد الفوري خلال 14 يوماً مع الإشارة لشرط القوة القاهرة...",
    draftBtn: "صياغة مستند القضية",
    draftReady: "المسودة جاهزة للمراجعة",
    copyBtn: "نسخ النص",
    copiedBtn: "تم النسخ",
    noDraftPrompt: "اختر نموذجاً، وأضف توجيهاتك الخاصة للصياغة القانونية الاحترافية.",
    draftLegalNotes: "تم التوليد عبر محرك الذكاء الاصطناعي للميزان • نموذج جيمي ٣.٥ فلاش",

    // Client Portal
    clientTransparency: "بوابة الشفافية وتتبع القضايا للموكل",
    loggedClient: "الموكل المسجل",
    auditTrail: "سجل الإجراءات المكتملة وتطورات النزاع",
    noMilestones: "لا توجد جلسات أو تطورات معلنة حالياً.",
    settlementTitle: "المطالبات المالية والفواتير المرسلة",
    noInvoices: "لا توجد مطالبات مالية معروضة حالياً.",
    sharedFiles: "المستندات والملفات المشتركة معك",
    noFilesShared: "لم يقم مستشاروك القانونيون بمشاركة أي ملفات بعد.",
    secureMessaging: "المراسلات والاتصال الآمن والمشفر",
    noMessages: "لا توجد رسائل متبادلة بعد.",
    messagingPlaceholder: "اكتب رسالتك للمستشار القانوني المسؤول...",
    safeAiAssistant: "مستشارك الذكي الآمن لتتبع القضية",
    permissionsChecked: "تم فحص صلاحيات الوصول وحماية سرية المكتب",
    safeAiTitle: "اسأل الذكاء الاصطناعي بأمان حول تقدم قضيتك",
    safeAiDesc: "يمكنك استشارة المساعد المخصص الذي يقرأ فقط البيانات والجلسات والملفات المشتركة معك بشكل علني. مستندات العمل السرية ومذكرات الدفاع الداخلية للمكتب تظل آمنة كلياً.",
    safeAiPlaceholder: "مثال: هل تم رفع سجل بوابات جمارك جبل علي في ملفات القضية؟",
    askAiBtn: "اسأل المساعد",
    advisorResponse: "إجابة المساعد الذكي المعتمد",

    // Analytics Bento Cards
    riskFactorIndex: "مؤشر عامل المخاطر",
    riskFactorDesc: "توقع سريان وانقضاء فترات التقاضي في دول مجلس التعاون الخليجي.",
    resourceAllocation: "توزيع الموارد البشرية",
    allocatedStaff: "المحامون المخصصون",
    primaryObjective: "الهدف الرئيسي للدعوى",
    contractSaturation: "تأمين بنود العقد والامتثال",
    complianceRating: "معدل الامتثال لمتطلبات ما قبل المحاكمة",
    pleadingCapStatus: "حالة سقف الميزانية والمصاريف",
    budgetBalance: "الرصيد المتبقي",
    budgetExhausted: "من الميزانية الكلية مستنفذ",

    // Notifications
    notificationsTitle: "التنبيهات والإشعارات",
    unreadNotifications: "إشعارات غير مقروءة",
    emptyNotifications: "لا توجد تنبيهات نشطة حالياً.",
    markAllRead: "تحديد الكل كمقروء",
    urgentDeadline: "موعد نهائي عاجل",
    pendingApproval: "مستند قيد المراجعة والاعتماد",
    clientMessage: "رسالة جديدة من الموكل",
    approveDocBtn: "اعتماد ونشر",
    completeTaskBtn: "إنجاز المهمة",
    notificationDismissed: "تم تجاهل الإشعار",
    notificationApproved: "تم اعتماد ونشر المستند بنجاح!",
    notificationCompleted: "تم إكمال المهمة بنجاح!",

    // Mobile App Native Navigation
    mobileNavMenu: "القائمة",
    mobileNavOverview: "التحليلات",
    mobileNavTasks: "المهام",
    mobileNavDocs: "المستندات",
    mobileNavAi: "جيمي AI",
    mobileNavBilling: "الفواتير",
    mobileNavClient: "الموكل",
    mobileNavLawyer: "المحامي",
    mobileNavAll: "الكل",
    mobileQuickActions: "إجراءات سريعة",
    mobileCases: "القضايا",
    mobileDrawerTitle: "التنقل وأقسام النظام",
    mobileSiteEndpoints: "أقسام المنظومة",
    mobileActiveCases: "القضايا القائمة",

    // Footer
    firmHash: "معرف المكتب الموثق: 0x821A_LEGAL_PRO",
    copyright: "حقوق الطبع محفوظة © ٢٠٢٦ نظام الميزان • متوافق مع مركز التحكيم ومحاكم مركز دبي المالي العالمي",
    matrixVer: "مصفوفة الذكاء القانوني إصدار ١.٠٨",

    // Global Search
    globalSearchPlaceholder: "ابحث عن المستندات، المهام، الموكلين، أو القضايا...",
    globalSearchTitle: "المحرك الشامل للبحث القانوني",
    globalSearchSub: "بحث سريع في جميع ملفات المكتب، المستندات المرفقة، والمهام القضائية",
    globalSearchShortcut: "Ctrl+K",
    searchFilterAll: "الكل",
    searchFilterMatters: "القضايا والموكلون",
    searchFilterDocs: "المستندات",
    searchFilterTasks: "المهام والمواعيد",
    noSearchResults: "لم يتم العثور على نتائج مطابقة لـ",
    openMatter: "الانتقال للقضية",
    jumpTo: "فتح",
    searchTypeMatter: "قضية / موكل",
    searchTypeDoc: "مستند",
    searchTypeTask: "مهمة",

    // Offline Mode & Storage
    offlineMode: "وضع عدم الاتصال",
    offlineModeActive: "وضع العمل أوفلاين (البيانات محفوظة محلياً)",
    offlineCachedNotice: "تم تحميل القضايا والمستندات من الذاكرة المحفوظة محلياً (IndexedDB)",
    onlineReconnected: "تمت إعادة الاتصال بشبكة الإنترنت بنجاح",
    syncingOfflineData: "جاري مزامنة السجلات والمستندات...",
    offlinePendingChanges: "تغييرات معلقة",
    offlineLastSynced: "آخر مزامنة",
    offlineNeverSynced: "لم تتم المزامنة بعد",
    offlineSyncNow: "مزامنة الآن",
    offlineSyncFailed: "فشلت المزامنة",
    offlineMakeAvailable: "إتاحة هذه القضية للعمل دون اتصال",
    offlineMakeAvailableProgress: "جاري حفظ القضية للاستخدام أوفلاين…",
    offlineMakeAvailableDone: "تم الحفظ للاستخدام أوفلاين",
    offlineMakeAvailableFailed: "تعذر حفظ القضية أوفلاين",
    offlineAiRequiresNetwork: "تتطلب ميزات الذكاء الاصطناعي اتصالاً بالإنترنت",

    // RAG — Legal Retrieval-Augmented Generation
    ragTabAsk: "اسأل بالمصادر",
    ragTabDraft: "صياغة",
    ragSubtitle: "مدوّنة قانونية أردنية منتقاة + ملفات القضية",
    ragPlaceholder: "اطرح سؤالاً قانونياً مستنداً إلى ملفات هذه القضية والقانون الأردني…",
    ragAskBtn: "اسأل",
    ragToggleMatter: "ابحث في ملفات القضية",
    ragToggleCorpus: "ابحث في القانون الأردني",
    ragGrounded: "موثّق — {n} مصدر",
    ragUngrounded: "لا توجد مصادر موثّقة",
    ragNoSources: "لم يتم العثور على مواد داعمة",
    ragDisclaimer: "مساعَد بالذكاء الاصطناعي. غير ملزم — يبقى المحامي مسؤولاً.",
    ragSourceStatute: "نص قانوني",
    ragSourceDocument: "مستند",
    ragSourceTranscript: "تفريغ",
    ragMatterHits: "ملفات القضية: {n}",
    ragCorpusHits: "مواد قانونية: {n}",
    ragTextFallback: "البحث المتجهي غير متاح — استخدام البحث النصي",
    ragThinking: "جارٍ البحث في الملفات والقانون الأردني…",
    ragErrorGeneric: "تعذّر إتمام الطلب.",
    ragSourcesTitle: "المصادر",
    ragShowExcerpt: "عرض المقتطف",
    ragHideExcerpt: "إخفاء المقتطف",
  },
  en: {
    appName: "Al Mizan",
    middleEastEdition: "Middle East Edition",
    activeCase: "Active Case",
    selectCase: "Select Case",
    newIntake: "New Matter Intake",
    lawyerMode: "Lawyer Mode",
    clientMode: "Client Mode",
    languageToggle: "العربية",

    // Intake Form
    intakeTitle: "New Case Intake Form",
    intakeSub: "Seed a complex litigation matter into the firm database.",
    matterTitle: "Matter Title",
    clientName: "Client Name",
    clientEmail: "Client Email",
    jurisdiction: "Jurisdiction",
    initialBudget: "Initial Budget (JOD)",
    opposingParty: "Opposing Party",
    opposingCounsel: "Opposing Counsel",
    cancel: "Cancel",
    registerIntake: "Register Intake",

    // Case Profile
    caseProfile: "Case Profile",
    riskLevel: "Risk Level",
    judge: "Judge / Arbitrator",
    statuteDeadline: "Statute Deadline",
    budgetCap: "Firm Billing Budget",
    spent: "Spent",
    winProb: "Win Probability",
    aiStrategy: "AI Recalculated Strategy",

    // AI Risk Assessment
    sccaEngine: "SCCA & Sharia Legal Engine",
    simulateTitle: "Simulate Risk & Strategic Enforcement",
    simulateDesc: "Verify court precedent, Sharia civil code compliance, and forecast SCCA tribunal outcomes.",
    analyzeBtn: "Analyze Case",
    aiCoreFindings: "AI Analytical Core Findings",
    riskIndex: "SCCA Risk Index",
    successRatio: "Success Ratio",
    strategyDirectives: "Defense Strategy Directives",

    // Documents
    docManagement: "Document Management & OCR",
    filesCount: "Files",
    dragDrop: "Drag & drop legal briefs, contracts, or e-files",
    fileLimits: "PDF, Word, or Scanned Scopes up to 25MB",
    fileNamePlaceholder: "File name (e.g. defense_letter_v2.pdf)",
    category: "Category",
    addFile: "Add File",
    noDocs: "No documents uploaded for this matter yet.",
    visiblePortal: "Visible to Client Portal",
    internalOffice: "Internal Office Only",
    version: "Version",
    runOcr: "Trigger Gemini AI Clause Analysis",
    aiSummaryHeader: "Gemini Automated Summary & Risk Log",
    aiTagsHeader: "AI Extracted Semantic Tags",
    selectDocPrompt: "Select a document from the left list to inspect its contents and AI summarization.",
    triggerAnalysis: "Trigger Gemini AI Clause Analysis",
    analyzingText: "Analyzing Legal Text via Gemini...",

    // Tasks
    workflowTitle: "Litigation Workflows & Deadlines",
    addTask: "Add Task",
    taskTitleLabel: "Task Title",
    assignedLawyer: "Assigned Lawyer",
    assignedStaff: "Assigned Staff",
    taskDescLabel: "Task Description",
    dueDate: "Due Date",
    priority: "Priority",
    clientVisible: "Client Visible",
    saveTask: "Save Task",
    noTasks: "No items",
    back: "← Back",
    next: "Next →",
    completed: "Completed",

    // Billing
    billingTitle: "Time, Billing & Trust Accounts",
    unbilledLedger: "Unbilled Work Ledger",
    outstanding: "hours outstanding",
    sentInvoices: "Total Sent Invoices",
    generateInvoice: "Generate Invoice",
    trustFunds: "Trust Funds Cleared",
    realization: "Realization",
    stopwatchTitle: "Stopwatch Case Tracker",
    startActive: "Start Active billing",
    stopLog: "Stop & Log hours",
    manualLogBtn: "Manual Pleading Log",
    logHoursLabel: "Hours Logged",
    timeEntryDesc: "Time Block Description",
    hoursLogged: "Detailed Case Pleading Ledger",
    saveTime: "Save Time Entry",
    emptyTimeLedger: "No time hours logged yet.",
    emptyInvoiceHistory: "No invoices generated yet.",
    clearPayment: "Clear payment",

    // AI Copilot
    aiCopilotTitle: "AI Legal Pleading Copilot",
    poweredBy: "Vite Server Powered",
    draftTemplate: "Draft Document Template",
    demandNotice: "Formal Demand Notice",
    settlementAccord: "Settlement Accord",
    arbitrationPetition: "Arbitration Petition",
    statementDefense: "Statement of Defense",
    draftDirectives: "Custom Drafting Directives",
    draftDirectivesPlaceholder: "e.g. Draft in accordance with Saudi construction civil regulations, specify immediate wire payment of 50,000 JOD with 14-day notice, mention force majeure...",
    draftBtn: "Draft Case Document",
    draftReady: "DRAFT READY",
    copyBtn: "Copy",
    copiedBtn: "Copied",
    noDraftPrompt: "Select a template, customize directives, and generate a professional pleading.",
    draftLegalNotes: "Generated via AlMizan SCCA Legal Engine • gemini-3.5-flash",

    // Client Portal
    clientTransparency: "Client Transparency Portal",
    loggedClient: "Logged in Client",
    auditTrail: "Case Audit & Action Trail",
    noMilestones: "No visible case milestones scheduled.",
    settlementTitle: "Settlement & Invoices",
    noInvoices: "No pending bills posted to portal.",
    sharedFiles: "Shared Case Files",
    noFilesShared: "No case files shared by your legal team yet.",
    secureMessaging: "Secure Messaging",
    noMessages: "No messages exchanged yet.",
    messagingPlaceholder: "Ask your legal representative...",
    safeAiAssistant: "Safe AI Case Assistant",
    permissionsChecked: "Client Permissions Checked",
    safeAiTitle: "Ask the secure AI about your case progress",
    safeAiDesc: "Consult a specialized model that understands only the public, shared milestones and files. Confidential lawyer work product remains isolated.",
    safeAiPlaceholder: "e.g. Have we uploaded the latest JAFZ gate logs?",
    askAiBtn: "Ask AI",
    advisorResponse: "Case Advisor Response",

    // Analytics Bento Cards
    riskFactorIndex: "Risk Factor Index",
    riskFactorDesc: "Projected pleading slippage risk inside 12-month GCC cycle.",
    resourceAllocation: "Resource Allocation",
    allocatedStaff: "Allocated Staff",
    primaryObjective: "Primary Objective",
    contractSaturation: "Contract Saturation",
    complianceRating: "compliance rating by pre-trial discovery hearing",
    pleadingCapStatus: "Pleading Cap Status",
    budgetBalance: "Budget Balance",
    budgetExhausted: "Budget Exhausted",

    // Notifications
    notificationsTitle: "Notifications & Alerts",
    unreadNotifications: "unread notifications",
    emptyNotifications: "No active alerts or notifications.",
    markAllRead: "Mark all as read",
    urgentDeadline: "Urgent Deadline",
    pendingApproval: "Pending Document Approval",
    clientMessage: "New Client Message",
    approveDocBtn: "Approve & Publish",
    completeTaskBtn: "Complete Task",
    notificationDismissed: "Notification dismissed",
    notificationApproved: "Document approved and published successfully!",
    notificationCompleted: "Task completed successfully!",

    // Mobile App Native Navigation
    mobileNavMenu: "Menu",
    mobileNavOverview: "Metrics",
    mobileNavTasks: "Tasks",
    mobileNavDocs: "Docs",
    mobileNavAi: "Gemini AI",
    mobileNavBilling: "Billing",
    mobileNavClient: "Client",
    mobileNavLawyer: "Lawyer",
    mobileNavAll: "All",
    mobileQuickActions: "Quick Actions",
    mobileCases: "Cases",
    mobileDrawerTitle: "Navigation & Modules",
    mobileSiteEndpoints: "Site Modules",
    mobileActiveCases: "Active Disputes",

    // Footer
    firmHash: "Firm Hash: 0x821A_LEGAL_PRO",
    copyright: "© 2026 Al Mizan System • DIFC & SCCA Compliant",
    matrixVer: "Legal intelligence Matrix v1.08",

    // Global Search
    globalSearchPlaceholder: "Search documents, tasks, clients, or cases...",
    globalSearchTitle: "Global Legal Search Engine",
    globalSearchSub: "Instant search across all firm matters, uploaded documents, and litigation workflows",
    globalSearchShortcut: "Ctrl+K",
    searchFilterAll: "All",
    searchFilterMatters: "Matters & Clients",
    searchFilterDocs: "Documents",
    searchFilterTasks: "Tasks & Deadlines",
    noSearchResults: "No results matching",
    openMatter: "Jump to Matter",
    jumpTo: "Open",
    searchTypeMatter: "Matter / Client",
    searchTypeDoc: "Document",
    searchTypeTask: "Task",

    // Offline Mode & Storage
    offlineMode: "Offline Mode",
    offlineModeActive: "Offline Mode Active (Cached Data)",
    offlineCachedNotice: "Loaded matters & documents from IndexedDB local storage",
    onlineReconnected: "Reconnected to Internet",
    syncingOfflineData: "Synchronizing legal records...",
    offlinePendingChanges: "pending changes",
    offlineLastSynced: "Last synced",
    offlineNeverSynced: "Never synced",
    offlineSyncNow: "Sync now",
    offlineSyncFailed: "Sync failed",
    offlineMakeAvailable: "Make this matter available offline",
    offlineMakeAvailableProgress: "Caching matter for offline use…",
    offlineMakeAvailableDone: "Cached for offline use",
    offlineMakeAvailableFailed: "Could not cache matter offline",
    offlineAiRequiresNetwork: "AI features require an internet connection",

    // RAG — Legal Retrieval-Augmented Generation
    ragTabAsk: "Ask with Sources",
    ragTabDraft: "Draft",
    ragSubtitle: "Curated Jordanian legal corpus (selected articles) + your matter files",
    ragPlaceholder: "Ask a legal question grounded in this matter's files and Jordanian law…",
    ragAskBtn: "Ask",
    ragToggleMatter: "Search matter files",
    ragToggleCorpus: "Search Jordanian law",
    ragGrounded: "Grounded — {n} sources",
    ragUngrounded: "No sources cited",
    ragNoSources: "No supporting material found",
    ragDisclaimer: "AI-assisted. Non-authoritative — lawyer remains responsible.",
    ragSourceStatute: "Statute",
    ragSourceDocument: "Document",
    ragSourceTranscript: "Transcript",
    ragMatterHits: "Matter files: {n}",
    ragCorpusHits: "Corpus articles: {n}",
    ragTextFallback: "Vector search unavailable — using text search",
    ragThinking: "Searching files and Jordanian law…",
    ragErrorGeneric: "Could not complete the request.",
    ragSourcesTitle: "Sources",
    ragShowExcerpt: "Show excerpt",
    ragHideExcerpt: "Hide excerpt",
  }
};

const staticTranslations: Record<string, string> = {
  // Matters titles
  "Al-Tayer Logistics vs. Global Port Authority": "شركة الطاير للخدمات اللوجستية ضد الهيئة العامة للموانئ",
  "Al-Ghanim Family Corporate Restructuring": "إعادة هيكلة شركات عائلة الغانم القابضة",
  "PetroRiyadh Solar Project Arbitration": "تحكيم مشروع بترورائد للطاقة الشمسية",

  // Matters descriptions
  "Multi-party commercial contract dispute regarding delayed shipments, localized custom clearances, and force majeure claims in Jebel Ali Free Zone (JAFZ). Requires Sharia contract compliance review.": "نزاع تجاري حول عقود متعددة الأطراف بخصوص الشحنات المتأخرة، والتخليص الجمركي المحلي، وادعاءات القوة القاهرة في منطقة جبل علي الحرة (جافزا). يتطلب مراجعة توافق العقد والضمانات القانونية الشرعية.",
  "Complex reorganization of a multi-generational family estate and group holding company across Kuwait and UAE. Includes cross-border assets, trust setup, and liquidation analysis.": "إعادة تنظيم معقدة لتركة عائلية ومجموعة شركات قابضة عبر الكويت والإمارات، تشمل أصولاً عابرة للحدود، تأسيس صناديق ائتمانية، وتحليل التصفية تماشياً مع قواعد حوكمة الشركات والشرائع المحلية.",
  "Arbitration proceedings for construction delays on a 150MW utility-scale solar project under FIDIC Silver Book conditions. High exposure claim involving supply chain disruptions.": "إجراءات تحكيم بشأن تأخر المقاول وأعمال البناء في مشروع محطة طاقة شمسية بقوة 150 ميجاوات بموجب شروط عقد فيديك الفضي (FIDIC Silver Book)، وهي مطالبة مالية ذات مخاطر عالية بسبب اضطرابات سلاسل الإمداد العالمية.",

  // Jurisdictions
  "Dubai Commercial Court (DIFC-compliant)": "محكمة دبي التجارية (متوافقة مع قوانين DIFC)",
  "Kuwait Court of Cassation & DIFC Wills Registry": "محكمة التمييز الكويتية وسجل وصايا DIFC",
  "Saudi Commercial Arbitration Center (SCCA), Riyadh": "مركز التحكيم التجاري السعودي (SCCA)، الرياض",

  // Judges/Courts
  "Judge Abdulrahman Al-Mansoori": "القاضي عبد الرحمن المنصوري",
  "Justice Tareq Al-Saeed": "المستشار طارق السعيد",
  "Dr. S. Al-Suwailem (Arbitrator)": "د. س. السويلم (محكّم معتمد)",
  "Dubai Court of First Instance": "محكمة دبي الابتدائية",
  "Kuwait Corporate Tribunal": "المحكمة التجارية الكويتية",
  "SCCA Panel No. 4": "هيئة التحكيم الرابعة بـ SCCA",

  // People
  "Tariq Al-Tayer": "طارق الطاير",
  "Fatima Al-Ghanim": "فاطمة الغانم",
  "Eng. Khalid bin Fahd": "المهندس خالد بن فهد",
  "Farah Al-Sabah (Senior Associate)": "المستشار فرح الصباح (محامٍ أول)",
  "Walid Al-Gharaballi (Partner)": "المستشار وليد الغربللي (شريك)",
  "Farah Al-Sabah": "فرح الصباح",
  "Walid Al-Gharaballi": "وليد الغربللي",

  // Document categories
  "Contract": "عقد",
  "Pleading": "لائحة دعوى",
  "Corporate": "شركات / مؤسسي",
  "Discovery": "إفصاح",
  "Evidence": "بينة / دليل",

  // Document Summaries
  "Logistics SLA between Al-Tayer Logistics and GPA. Section 14.2 contains a disputed liquidated damages clause charging 15,000 JOD per day of delay, subject to force majeure caps.": "اتفاقية مستوى الخدمة للخدمات اللوجستية بين شركة الطاير والهيئة العامة للموانئ. يتضمن البند 14.2 شرطاً جزائياً متنازعاً عليه يفرض غرامة 15,000 د.أ عن كل يوم تأخير، خاضعاً لسقوف القوة القاهرة.",
  "Draft Statement of Claim alleging GPA's breach of contract due to arbitrary port gate closures. Seeking 120,000 JOD in direct damages.": "مسودة لائحة الدعوى التي تدعي إخلال الهيئة بالعقد بسبب الإغلاق التعسفي لبوابات الميناء. المطالبة بتعويض 120,000 د.أ عن الأضرار المباشرة.",
  "Proposed trust restructure separating commercial operations from real estate holding. Restructuring will secure asset distribution in line with family agreements and Kuwait commercial law.": "إعادة هيكلة الصناديق الائتمانية المقترحة لفصل العمليات التجارية واللوجستية عن الأصول العقارية. ستعمل الهيكلة على تأمين توزيع التركات وفقاً للاتفاقيات العائلية والقوانين الكويتية.",

  // Document tags
  "SLA": "اتفاقية مستوى الخدمة",
  "Disputed Clause": "البند المتنازع عليه",
  "Liquidated Damages": "الشرط الجزائي",
  "Force Majeure": "القوة القاهرة",
  "Claim": "المطالبة والمستندات",
  "Port Gates": "بوابات الميناء",
  "Direct Damages": "الأضرار المباشرة",
  "Trust": "صندوق ائتماني",
  "Restructuring": "إعادة هيكلة",
  "Estate Planning": "تخطيط التركات",
  "Family Protocol": "البروتوكول العائلي",

  // Task titles & descriptions
  "Obtain Port Gate Logs from JAFZ Customs Authority": "الحصول على سجلات بوابات الميناء من جمارك جافزا",
  "Request official logs of port gate closures for July 3-7 to substantiate GPA closures claim.": "طلب السجلات الرسمية لإغلاق بوابات الميناء للفترة من 3 إلى 7 يوليو لدعم ادعاء إغلاق بوابات الميناء.",
  "Draft Amended Statement of Claim": "صياغة لائحة الدعوى المعدلة",
  "Integrate GPA's force majeure defense and update damages calculation.": "دمج دفوع القوة القاهرة للخصم وتحديث حساب التعويضات والمطالبات المالية.",
  "Prepare Client Deposition Brief": "إعداد مذكرة جلسة الاستماع واستجواب الموكل",
  "Brief Tariq Al-Tayer on cross-examination strategy for the upcoming court hearing.": "تحضير الموكل طارق الطاير وتدريبه على استراتيجية الاستجواب للجلسة القضائية المقبلة.",
  "Review DIFC Wills Registry Compliance": "مراجعة الامتثال لسجل وصايا مركز دبي المالي العالمي",
  "Ensure the draft trust protocol aligns perfectly with the non-Muslim wills registry rules.": "التأكد من توافق مسودة بروتوكول الائتمان تماماً مع قواعد سجل وصايا غير المسلمين في DIFC.",

  // Priorities
  "High": "عالية",
  "Medium": "متوسطة",
  "Low": "منخفضة",

  // Task Statuses
  "In Progress": "قيد الإنجاز",
  "To Do": "مطلوب عملها",
  "Completed": "مكتملة",
  "Under Review": "قيد المراجعة",

  // Time entries
  "Review of SLA and gate logs": "مراجعة اتفاقية مستوى الخدمة وسجلات بوابات الميناء",
  "Drafting responsive pleading notes and defense arguments": "صياغة مذكرات جوابية ودفوع دفاعية تفصيلية",
  "Consultation call with Fatima Al-Ghanim regarding trusts": "اتصال استشاري مع فاطمة الغانم بشأن الصناديق الائتمانية والتركات",

  // Timeline events titles & descriptions
  "Statement of Claim Filed": "تسجيل لائحة الدعوى رسمياً",
  "The initial claim statement filed electronically with the JAFZ commercial dispute tribunal.": "تقديم صحيفة الدعوى إلكترونياً لدى لجنة تسوية النزاعات التجارية بجافزا.",
  "Mediation Meeting with Arbitrator": "جلسة وساطة مع المحكم المعتمد",
  "Briefing session at Dubai Court of First Instance with Judge Al-Mansoori.": "جلسة تمهيدية بمحكمة دبي الابتدائية بحضور القاضي عبد الرحمن المنصوري.",
  "Deadline for Amended Defense Pleading": "الموعد النهائي لتقديم اللائحة الجوابية المعدلة",
  "Critical final date to file the response to opposing counsel's motion.": "التاريخ الحرج الأخير لتقديم الرد على طلبات محامي الخصم.",
  "First Formal Hearing": "جلسة الاستماع الرسمية الأولى",
  "Dubai Commercial Court Oral Arguments.": "المرافعة الشفهية وتقديم الدفاع الشفهي أمام محكمة دبي التجارية.",

  // Invoice statuses
  "Paid": "مدفوعة",
  "Sent": "مرسلة",
  "Overdue": "متأخرة",

  // Messages senders/text
  "Lawyer": "المستشار فرح الصباح",
  "Client": "الموكل",
  "Dear Tariq, we have finalized the draft deposition brief. Let's schedule a Zoom session tomorrow at 11 AM to practice standard questions from the panel.": "عزيزي طارق، لقد انتهينا من صياغة مسودة استجواب الجلسة. لنرتب اتصالاً عبر زووم غداً في الساعة 11 صباحاً للتدريب على الأسئلة المتوقعة من اللجنة.",
  "Excellent work Farah. I am free at 11 AM. Did we include the gate logs from JAFZ customs in the defense bundle?": "عمل رائع يا فرح. أنا متاح غداً الساعة 11 صباحاً. هل أرفقنا سجلات بوابات جمارك جافزا في ملف الدفاع والبيانات؟",
  "Yes, they are attached to Document 1. I've also set that document to 'Visible' in your portal for review.": "نعم، تم إرفاقها بالمستند رقم 1. وقد جعلت هذا المستند مرئياً في بوابتك لتتمكن من مراجعته وقراءته كلياً."
};

export function translateStaticText(text: string, isRtl: boolean): string {
  if (!isRtl || !text) return text;
  return staticTranslations[text.trim()] || text;
}


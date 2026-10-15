package app.pars.engine

/** متن‌های رابط (فارسی) */
object Str {
    const val tagline = "مرورگر امن، سریع و بی‌ردپا"
    const val privateTagline = "حالت خصوصی؛ بعد از بستن هیچ ردی نمی‌ماند"
    const val httpsOnly = "فقط HTTPS"
    const val blocked = "مسدود"
    const val extensions = "اکستنشن"
    const val searchHint = "جستجو یا وارد کردن نشانی…"
    const val newTab = "تب جدید"
    const val privateTab = "تب خصوصی"
    const val bookmarks = "نشان‌ها"
    const val history = "تاریخچه"
    const val settings = "تنظیمات"
    const val allow = "اجازه"
    const val deny = "مسدود"
    const val install = "نصب"
    const val cancel = "انصراف"
    const val done = "تمام"
    const val noBookmarks = "هنوز نشانی ذخیره نکرده‌ای؛ ستاره را بزن."
    const val noHistory = "تاریخچه خالی است."
    const val noExt = "اکستنشنی نصب نیست."
    const val installHint = "لینک یا نام افزونه در addons.mozilla.org"
    const val clearData = "پاک کردن اطلاعات مرور"
    const val clearHistory = "پاک کردن تاریخچه"
    const val searchEngine = "موتور جستجو"
    const val strictTracking = "مسدودسازی سخت‌گیرانه‌ی ردیاب‌ها"
    const val strictTrackingDesc = "ردیاب‌ها، اثرانگشت و کریپتوماینرها"
    const val httpsOnlyDesc = "هیچ صفحه‌ای بدون رمزنگاری باز نمی‌شود مگر با تأیید تو"
    const val clearOnExit = "پاک‌سازی هنگام خروج"
    const val clearOnExitDesc = "کوکی، حافظه‌ی نهان و تاریخچه با بستن برنامه پاک شود"
    const val secureWindow = "مخفی کردن از اسکرین‌شات و لیست برنامه‌ها"
    const val secureWindowDesc = "پنجره در حالت خصوصی همیشه محافظت می‌شود"
    const val alwaysOn = "همیشه فعال: جداسازی فرایندها، رد گواهی نامعتبر، GPC، رد پیش‌فرض مجوزها و فایل‌های خطرناک."
    const val allSites = "خواندن و تغییر داده‌های همه‌ی وب‌سایت‌ها"
    const val extWarn = "فقط اکستنشن‌های مورد اعتماد را نصب کن. اکستنشن‌ها در تب خصوصی اجرا نمی‌شوند."

    fun permLabel(kind: String) = when (kind) {
        "geo" -> "موقعیت مکانی"
        "notif" -> "ارسال اعلان"
        "camera" -> "دوربین"
        "mic" -> "میکروفون"
        "camera+mic" -> "دوربین و میکروفون"
        else -> kind
    }

    fun extPerm(p: String) = when (p) {
        "tabs" -> "اطلاعات تب‌ها"
        "cookies" -> "خواندن کوکی‌ها"
        "history" -> "تاریخچه‌ی مرور"
        "webRequest" -> "مشاهده‌ی درخواست‌های شبکه"
        "webRequestBlocking" -> "تغییر درخواست‌های شبکه"
        "downloads" -> "مدیریت دانلودها"
        "clipboardRead" -> "خواندن کلیپ‌بورد"
        "nativeMessaging" -> "ارتباط با برنامه‌های روی دستگاه"
        "proxy" -> "کنترل پروکسی"
        "bookmarks" -> "نشان‌ها"
        "storage" -> "ذخیره‌ی داده"
        "notifications" -> "اعلان‌ها"
        "geolocation" -> "موقعیت مکانی"
        "activeTab" -> "تب فعال"
        "scripting" -> "اجرای اسکریپت در صفحات"
        else -> p
    }
}

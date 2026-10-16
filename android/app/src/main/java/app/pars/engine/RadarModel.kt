package app.pars.engine

/** ورودیِ خام از لاگ مسدودسازی Gecko (مستقل از اندروید تا قابل تست باشد). */
data class RawBlock(val origin: String, val category: Int, val blocked: Boolean, val count: Int)

class RadarNode(val host: String, val kind: Int, val blocked: Int, val allowed: Int)

object RadarModel {
    // همان بیت‌های ContentBlocking.AntiTracking
    const val AD = 2; const val ANALYTIC = 4; const val SOCIAL = 8; const val CONTENT = 16
    const val CRYPTO = 64; const val FINGERPRINT = 128

    private val order = listOf(CRYPTO, FINGERPRINT, AD, ANALYTIC, SOCIAL, CONTENT)

    /** مهم‌ترین دسته‌ی یک مورد؛ 0 یعنی کوکی/سایر */
    fun kindOf(category: Int): Int = order.firstOrNull { category and it != 0 } ?: 0

    fun label(kind: Int) = when (kind) {
        AD -> "تبلیغات"; ANALYTIC -> "تحلیل و ردیابی"; SOCIAL -> "شبکه‌ی اجتماعی"; CONTENT -> "ردیاب محتوا"
        CRYPTO -> "ماینر رمزارز"; FINGERPRINT -> "اثرانگشت مرورگر"; else -> "کوکی / سایر"
    }

    fun describe(kind: Int) = when (kind) {
        AD -> "شبکه‌ی تبلیغاتی؛ رفتار تو را برای نمایش آگهی دنبال می‌کند."
        ANALYTIC -> "سرویس آمار؛ بازدیدها و کلیک‌هایت را ثبت می‌کند."
        SOCIAL -> "دکمه/اسکریپت شبکه‌ی اجتماعی؛ می‌تواند حتی بدون کلیک بازدیدت را گزارش کند."
        CONTENT -> "ردیاب مبتنی بر محتوای جاسازی‌شده."
        CRYPTO -> "اسکریپت ماینر؛ پردازنده و باتری‌ات را برای رمزارز مصرف می‌کند."
        FINGERPRINT -> "تلاش برای ساختن اثرانگشت یکتا از دستگاهت."
        else -> "کوکی یا درخواست جانبی."
    }

    fun siteOf(host: String): String { val p = host.split('.'); return if (p.size <= 2) host else p.takeLast(2).joinToString(".") }

    private fun hostOfOrigin(origin: String): String = Security.hostOf(origin).ifEmpty { origin.substringAfter("://").substringBefore('/').substringBefore(':') }

    /** ردیاب‌های شخص‌ثالث را بر اساس میزبان جمع می‌کند (شخص‌اول حذف می‌شود). */
    fun build(raw: List<RawBlock>, pageHost: String): List<RadarNode> {
        val first = siteOf(pageHost)
        val by = linkedMapOf<String, IntArray>()   // host → [kindBits, blocked, allowed]
        for (r in raw) {
            val h = hostOfOrigin(r.origin).removePrefix("www.")
            if (h.isEmpty() || siteOf(h) == first || r.category == 0) continue
            val a = by.getOrPut(h) { intArrayOf(0, 0, 0) }
            a[0] = a[0] or r.category
            if (r.blocked) a[1] += r.count else a[2] += r.count
        }
        return by.map { (h, a) -> RadarNode(h, kindOf(a[0]), a[1], a[2]) }.sortedByDescending { it.blocked + it.allowed }.take(40)
    }

    /** نمره‌ی 0..100 */
    fun score(nodes: List<RadarNode>, secure: Boolean): Int {
        val leaked = nodes.count { it.allowed > 0 }
        val risky = nodes.count { it.allowed > 0 && (it.kind == CRYPTO || it.kind == FINGERPRINT) }
        return (100 - leaked * 9 - risky * 15 - (if (secure) 0 else 25)).coerceIn(0, 100)
    }

    fun grade(score: Int) = when { score >= 92 -> "A+"; score >= 80 -> "A"; score >= 65 -> "B"; score >= 50 -> "C"; score >= 35 -> "D"; else -> "F" }
    fun verdict(score: Int) = when { score >= 80 -> "عالی"; score >= 65 -> "خوب"; score >= 50 -> "متوسط"; score >= 35 -> "ضعیف"; else -> "خطرناک" }
}

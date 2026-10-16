package app.pars.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import app.pars.R
import app.pars.engine.Store

/** یک تم کامل. a1 رنگ اصلی (تأکید)، a2 رنگ دوم گرادیان. */
class Palette(
    val id: String, val name: String, val dark: Boolean,
    val bg: Long, val surface: Long, val surface2: Long, val line: Long, val text: Long, val muted: Long,
    val a1: Long, val a2: Long, val cyan: Long = 0xFF5CF2FF, val mint: Long = 0xFF6DFFB8, val red: Long = 0xFFFF2E63, val amber: Long = 0xFFFFB300,
)

object Palettes {
    val all = listOf(
        Palette("neon", "نئون", true, 0xFF07060D, 0xFF110F1C, 0xFF1A1729, 0xFF2A2540, 0xFFF4EFFF, 0xFF8E87A8, 0xFFFF87FF, 0xFFDC00FF),
        Palette("aurora", "شفق", true, 0xFF04100F, 0xFF081B1A, 0xFF0E2827, 0xFF17403D, 0xFFE6FFFB, 0xFF7FB5AD, 0xFF4DF0C8, 0xFF22D3EE),
        Palette("midnight", "نیمه‌شب", true, 0xFF060913, 0xFF0D1325, 0xFF141C36, 0xFF232F58, 0xFFE8EEFF, 0xFF8794BC, 0xFF7C9CFF, 0xFF5B6CFF),
        Palette("sunset", "غروب", true, 0xFF120708, 0xFF1E0E10, 0xFF2B1416, 0xFF4A2327, 0xFFFFF0EA, 0xFFB58C85, 0xFFFF8A5C, 0xFFFF3D6E),
        Palette("ocean", "اقیانوس", true, 0xFF03121B, 0xFF071E2C, 0xFF0C2B3F, 0xFF15435C, 0xFFE3F6FF, 0xFF7FA9BF, 0xFF38BDF8, 0xFF0EA5E9, mint = 0xFF34D399),
        Palette("forest", "جنگل", true, 0xFF07110A, 0xFF0E1C12, 0xFF15291B, 0xFF23422B, 0xFFE9F7EC, 0xFF87AE90, 0xFF86EFAC, 0xFF22C55E),
        Palette("sakura", "شکوفه", true, 0xFF150A12, 0xFF22101C, 0xFF301729, 0xFF53284A, 0xFFFFEAF6, 0xFFC08BB0, 0xFFF9A8D4, 0xFFEC4899),
        Palette("oled", "OLED مشکی", true, 0xFF000000, 0xFF0A0A0A, 0xFF141414, 0xFF262626, 0xFFF2F2F2, 0xFF8A8A8A, 0xFFE5E5E5, 0xFFA3A3A3),
        Palette("dracula", "دراکولا", true, 0xFF1E1F29, 0xFF282A36, 0xFF343746, 0xFF44475A, 0xFFF8F8F2, 0xFF9AA0C0, 0xFFBD93F9, 0xFFFF79C6, 0xFF8BE9FD, 0xFF50FA7B, 0xFFFF5555, 0xFFF1FA8C),
        Palette("nord", "نورد", true, 0xFF20242D, 0xFF2B303B, 0xFF363D4B, 0xFF4C566A, 0xFFECEFF4, 0xFF9AA5B8, 0xFF88C0D0, 0xFF81A1C1, 0xFF8FBCBB, 0xFFA3BE8C, 0xFFBF616A, 0xFFEBCB8B),
        Palette("cyber", "سایبرپانک", true, 0xFF0A0612, 0xFF140B22, 0xFF1F1233, 0xFF3B2160, 0xFFF5F0FF, 0xFF9A84C9, 0xFFFCEE0A, 0xFFFF2A6D, 0xFF05D9E8, 0xFF01FFC3),
        Palette("gold", "طلای ایرانی", true, 0xFF0F0B05, 0xFF1B140A, 0xFF281E0F, 0xFF4A3716, 0xFFFFF4DC, 0xFFB79E6E, 0xFFF5C451, 0xFFD97706, 0xFF5EEAD4, 0xFF86EFAC),
        Palette("lavender", "اسطوخودوس", true, 0xFF0E0A1A, 0xFF181230, 0xFF231B45, 0xFF3D3270, 0xFFEFE9FF, 0xFF9D93CC, 0xFFC4B5FD, 0xFF8B5CF6),
        Palette("coffee", "قهوه", true, 0xFF120D09, 0xFF1E1610, 0xFF2B2018, 0xFF4A382A, 0xFFF6EDE4, 0xFFB09A86, 0xFFE0A96D, 0xFFC2410C),
        Palette("solar", "سولاریزد", true, 0xFF002B36, 0xFF073642, 0xFF0B4352, 0xFF18596A, 0xFFEEE8D5, 0xFF93A1A1, 0xFFB58900, 0xFFCB4B16, 0xFF2AA198, 0xFF859900),
        Palette("paper", "کاغذ (روشن)", false, 0xFFF6F3EE, 0xFFFFFFFF, 0xFFEFEAE2, 0xFFDDD5C8, 0xFF1E1B16, 0xFF7A7266, 0xFF0F766E, 0xFF115E59, 0xFF0E7490, 0xFF15803D, 0xFFDC2626, 0xFFB45309),
        Palette("mint", "نعنا (روشن)", false, 0xFFEEF7F3, 0xFFFFFFFF, 0xFFE2F0EA, 0xFFCBE3D8, 0xFF0F2A22, 0xFF5E7F73, 0xFF059669, 0xFF047857, 0xFF0891B2, 0xFF16A34A, 0xFFDC2626, 0xFFB45309),
        Palette("rose", "گل‌سرخ (روشن)", false, 0xFFFDF2F8, 0xFFFFFFFF, 0xFFFCE7F3, 0xFFF5CCE3, 0xFF3B0A24, 0xFF9D5B7E, 0xFFDB2777, 0xFFBE185D, 0xFF0E7490, 0xFF15803D, 0xFFDC2626, 0xFFB45309),
        Palette("sky", "آسمان (روشن)", false, 0xFFEFF6FF, 0xFFFFFFFF, 0xFFDBEAFE, 0xFFBFDBFE, 0xFF0B1B3B, 0xFF5B7099, 0xFF2563EB, 0xFF1D4ED8, 0xFF0891B2, 0xFF15803D, 0xFFDC2626, 0xFFB45309),
    )
    fun byId(id: String) = all.firstOrNull { it.id == id } ?: all.first()

    /** رنگ‌های تأکید قابل‌انتخاب */
    val accents = listOf(0xFFFF87FF, 0xFFFF5C8A, 0xFFFF8A5C, 0xFFF5C451, 0xFF86EFAC, 0xFF4DF0C8, 0xFF5CF2FF, 0xFF7C9CFF, 0xFFA78BFA, 0xFFE5E5E5, 0xFF2563EB, 0xFF059669, 0xFFDB2777)
}

/** رنگ‌های زنده‌ی برنامه؛ همه‌ی C.xxx با تغییر تم/رنگ تأکید خودکار بازترسیم می‌شوند. */
object C {
    private var p by mutableStateOf(Palettes.all.first())
    private var accent by mutableStateOf<Color?>(null)
    fun apply(palette: Palette, accentOverride: Long?) { p = palette; accent = accentOverride?.let { Color(it) } }

    val isDark get() = p.dark
    val Bg get() = Color(p.bg)
    val Surface get() = Color(p.surface)
    val Surface2 get() = Color(p.surface2)
    val Line get() = Color(p.line)
    val Text get() = Color(p.text)
    val Muted get() = Color(p.muted)
    val Magenta get() = accent ?: Color(p.a1)
    val Violet get() = accent?.let { lerp(it, Color(p.a2), .55f) } ?: Color(p.a2)
    val Cyan get() = Color(p.cyan)
    val Mint get() = Color(p.mint)
    val Red get() = Color(p.red)
    val Amber get() = Color(p.amber)
    val Neon get() = Brush.linearGradient(listOf(Magenta, Violet))
    val Aurora get() = Brush.linearGradient(listOf(Cyan, Magenta, Violet))
}

class FontOpt(val id: String, val name: String, val family: FontFamily)

object Fonts {
    private fun r(id: String, name: String, res: Int) = FontOpt(id, name, FontFamily(Font(res)))
    val all = listOf(
        FontOpt("default", "پیش‌فرض سیستم", FontFamily.Default),
        FontOpt("sans", "Sans-serif", FontFamily.SansSerif),
        FontOpt("serif", "Serif", FontFamily.Serif),
        FontOpt("mono", "Monospace", FontFamily.Monospace),
        FontOpt("cursive", "Cursive", FontFamily.Cursive),
        r("vazirmatn", "وزیرمتن", R.font.vazirmatn), r("notosans", "نوتو سنس عربی", R.font.notosansarabic),
        r("notonaskh", "نوتو نسخ", R.font.notonaskh), r("plex", "آی‌بی‌ام پلکس", R.font.plexarabic),
        r("cairo", "قاهره", R.font.cairo), r("almarai", "المرعی", R.font.almarai), r("mada", "مدی", R.font.mada),
        r("changa", "چنگا", R.font.changa), r("elmessiri", "المسیری", R.font.elmessiri), r("baloo", "بالو", R.font.baloo),
        r("amiri", "امیری", R.font.amiri), r("scheherazade", "شهرزاد", R.font.scheherazade), r("markazi", "مرکزی", R.font.markazi),
        r("harmattan", "هارماتان", R.font.harmattan), r("kufam", "کوفام", R.font.kufam), r("reemkufi", "ریم کوفی", R.font.reemkufi),
        r("lemonada", "لیمونادا", R.font.lemonada), r("lalezar", "لاله‌زار", R.font.lalezar), r("rakkas", "رَکّاس", R.font.rakkas),
        r("arefruqaa", "عارف رقعه", R.font.arefruqaa), r("katibeh", "کاتبه", R.font.katibeh), r("mirza", "میرزا", R.font.mirza),
        r("jomhuria", "جمهوریه", R.font.jomhuria),
    )
    fun byId(id: String) = all.firstOrNull { it.id == id } ?: all.first()
}

/** تنظیمات ظاهری کاربر (ذخیره روی دیسک). */
object Look {
    var themeId by mutableStateOf("neon")
    var accent by mutableStateOf<Long?>(null)
    var fontId by mutableStateOf("default")
    var textScale by mutableFloatStateOf(1f)      // اندازه‌ی متن رابط
    var uiScale by mutableFloatStateOf(1f)        // اندازه‌ی کل عناصر رابط
    var round by mutableFloatStateOf(1f)          // گردی گوشه‌ها
    var barTop by mutableStateOf(false)           // نوار آدرس بالا یا پایین
    var particles by mutableStateOf(true)         // ذرات صفحه‌ی شروع
    var wordmark by mutableStateOf("")        // نوشته‌ی بزرگ صفحه‌ی شروع
    var webTextScale by mutableFloatStateOf(1f)   // اندازه‌ی متن صفحات وب
    var webScheme by mutableStateOf("system")     // system / light / dark

    fun font() = Fonts.byId(fontId)

    fun load(s: Store) {
        themeId = s.str("theme", "neon"); accent = s.str("accent", "").toLongOrNull()
        fontId = s.str("font", "default")
        textScale = s.str("textScale", "1").toFloatOrNull()?.coerceIn(.7f, 1.8f) ?: 1f
        uiScale = s.str("uiScale", "1").toFloatOrNull()?.coerceIn(.75f, 1.4f) ?: 1f
        round = s.str("round", "1").toFloatOrNull()?.coerceIn(0f, 1.8f) ?: 1f
        barTop = s.str("barTop", "0") == "1"; particles = s.str("particles", "1") == "1"
        wordmark = s.str("wordmark", "").take(14)
        webTextScale = s.str("webText", "1").toFloatOrNull()?.coerceIn(.5f, 2f) ?: 1f
        webScheme = s.str("webScheme", "system")
        refresh()
    }

    fun save(s: Store) {
        s.setStr("theme", themeId); s.setStr("accent", accent?.toString() ?: ""); s.setStr("font", fontId)
        s.setStr("textScale", textScale.toString()); s.setStr("uiScale", uiScale.toString()); s.setStr("round", round.toString())
        s.setStr("barTop", if (barTop) "1" else "0"); s.setStr("particles", if (particles) "1" else "0"); s.setStr("wordmark", wordmark)
        s.setStr("webText", webTextScale.toString()); s.setStr("webScheme", webScheme)
    }

    fun refresh() = C.apply(Palettes.byId(themeId), accent)

    fun reset() {
        themeId = "neon"; accent = null; fontId = "default"; textScale = 1f; uiScale = 1f; round = 1f
        barTop = false; particles = true; wordmark = ""; webTextScale = 1f; webScheme = "system"; refresh()
    }
}

/** گوشه‌ی گرد با ضریب انتخابی کاربر */
fun Rd(dp: Float) = RoundedCornerShape((dp * Look.round).dp)

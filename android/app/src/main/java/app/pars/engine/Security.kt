package app.pars.engine

import java.net.URI
import java.net.URLEncoder

/** منطق خالص (بدون وابستگی به اندروید) تا با تست واحد قابل بررسی باشد. */
object Security {
    val searchEngines = linkedMapOf(
        "duckduckgo" to "https://duckduckgo.com/?q=%s",
        "brave" to "https://search.brave.com/search?q=%s",
        "startpage" to "https://www.startpage.com/do/search?q=%s",
        "google" to "https://www.google.com/search?q=%s",
    )

    private val dangerousExt = Regex("""\.(exe|msi|bat|cmd|com|scr|pif|ps1|vbs|js|jar|apk|dmg|pkg|sh|run|deb|rpm|lnk|reg|hta)$""", RegexOption.IGNORE_CASE)
    private val schemeRe = Regex("""^[a-z][a-z0-9+.-]*://""", RegexOption.IGNORE_CASE)
    private val domainRe = Regex("""^(localhost|[\w-]+(\.[\w-]+)+)(:\d+)?(/\S*)?$""", RegexOption.IGNORE_CASE)
    private val ipRe = Regex("""^\d{1,3}(\.\d{1,3}){3}(:\d+)?(/\S*)?$""")

    fun isDangerousFile(name: String) = dangerousExt.containsMatchIn(name)

    fun isSafeNavigationUrl(u: String): Boolean = runCatching {
        val s = URI(u).scheme?.lowercase(); s == "https" || s == "http"
    }.getOrDefault(false)

    fun isLocalHost(host: String) =
        host == "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
            Regex("""^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)""").containsMatchIn(host)

    /** ورودی نوار آدرس → آدرس نهایی یا جستجو. رشته‌ی خالی یعنی رد شد. */
    fun resolveInput(raw: String, engine: String): String {
        val text = raw.trim()
        if (text.isEmpty()) return ""
        if (schemeRe.containsMatchIn(text)) return if (isSafeNavigationUrl(text)) text else ""
        if (!text.contains(' ') && domainRe.matches(text)) {
            val host = text.split('/', ':')[0]
            return (if (isLocalHost(host)) "http://" else "https://") + text
        }
        if (ipRe.matches(text)) return "http://$text"
        val tpl = searchEngines[engine] ?: searchEngines.getValue("duckduckgo")
        return tpl.replace("%s", URLEncoder.encode(text, "UTF-8").replace("+", "%20"))
    }

    fun hostOf(url: String): String = runCatching { URI(url).host ?: "" }.getOrDefault("")

    /** لینک یا نام افزونه‌ی AMO → آدرس xpi امضاشده. فقط addons.mozilla.org پذیرفته می‌شود. */
    fun amoXpiUrl(input: String): String? {
        val t = input.trim()
        Regex("""^https://addons\.mozilla\.org/[^?#]*?/addon/([\w.@-]+)""").find(t)?.let {
            return "https://addons.mozilla.org/firefox/downloads/latest/${it.groupValues[1]}/latest.xpi"
        }
        if (t.startsWith("https://addons.mozilla.org/") && t.substringBefore('?').endsWith(".xpi")) return t
        if (Regex("""^[\w.@-]{2,60}$""").matches(t)) return "https://addons.mozilla.org/firefox/downloads/latest/$t/latest.xpi"
        return null
    }

    /** لینک Chrome Web Store → نام افزونه (برای جستجوی معادلش در AMO). رشته‌ی خالی = شناسه‌ی بدون نام. null = لینک کروم‌استور نیست. */
    fun chromeStoreName(input: String): String? {
        val t = input.trim()
        Regex("""^https://(?:chromewebstore\.google\.com/detail|chrome\.google\.com/webstore/detail)/([^/?#]+)""").find(t)?.let {
            return java.net.URLDecoder.decode(it.groupValues[1], "UTF-8").replace('-', ' ')
        }
        if (Regex("""^https://(?:chromewebstore\.google\.com|chrome\.google\.com)/""").containsMatchIn(t) || Regex("""^[a-p]{32}$""").matches(t)) return ""
        return null
    }

    fun amoSearchUrl(q: String) = "https://addons.mozilla.org/firefox/search/?q=" + URLEncoder.encode(q, "UTF-8")
}

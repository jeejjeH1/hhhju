package app.pars.engine

import org.json.JSONArray
import org.json.JSONObject

/** یک «پین زنده»: بخشی از یک صفحه که مرتب خوانده می‌شود. */
data class Pin(
    val id: String, val title: String, val url: String, val sel: String,
    val value: String = "", val prev: String = "", val first: String = "",
    val checked: Long = 0, val changed: Long = 0, val ok: Boolean = true,
)

class Applied(val pin: Pin, val changed: Boolean)

/** منطق خالص پین‌ها (قابل تست بدون اندروید) */
object PinLogic {
    fun normalizeUrl(u: String): String = u.substringBefore('#').trimEnd('/')

    fun apply(p: Pin, text: String, ok: Boolean, now: Long): Applied {
        if (!ok) return Applied(p.copy(ok = false, checked = now), false)
        val v = text.trim().take(200)
        return when {
            v.isEmpty() -> Applied(p.copy(ok = false, checked = now), false)
            p.value.isEmpty() -> Applied(p.copy(value = v, first = v, ok = true, checked = now, changed = now), false)   // خواندن اول: تغییر حساب نمی‌شود
            v == p.value -> Applied(p.copy(ok = true, checked = now), false)
            else -> Applied(p.copy(prev = p.value, value = v, ok = true, checked = now, changed = now), true)
        }
    }

    /** ورودی‌ای که از صفحه می‌آید قابل اعتماد نیست؛ اعتبارسنجی */
    fun validPick(url: String, sel: String, text: String): Boolean =
        Security.isSafeNavigationUrl(url) && sel.isNotBlank() && sel.length <= 400 && text.isNotBlank()

    fun toJson(l: List<Pin>): String {
        val a = JSONArray()
        l.forEach { a.put(JSONObject().put("id", it.id).put("t", it.title).put("u", it.url).put("s", it.sel).put("v", it.value).put("p", it.prev).put("f", it.first).put("c", it.checked).put("h", it.changed).put("k", it.ok)) }
        return a.toString()
    }

    fun fromJson(s: String): List<Pin> = runCatching {
        val a = JSONArray(s)
        (0 until a.length()).map { val o = a.getJSONObject(it); Pin(o.getString("id"), o.getString("t"), o.getString("u"), o.getString("s"), o.optString("v"), o.optString("p"), o.optString("f"), o.optLong("c"), o.optLong("h"), o.optBoolean("k", true)) }
    }.getOrDefault(emptyList())

    fun ago(ms: Long, now: Long): String {
        if (ms <= 0) return "—"
        val m = (now - ms) / 60000
        return when { m < 1 -> "همین الان"; m < 60 -> "$m دقیقه پیش"; m < 1440 -> "${m / 60} ساعت پیش"; else -> "${m / 1440} روز پیش" }
    }
}

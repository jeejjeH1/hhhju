package app.pars.engine

import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/**
 * نصب افزونه از Chrome Web Store روی موتور Firefox:
 * CRX را می‌گیرد → هدرش را برمی‌دارد → manifest را برای Firefox سازگار می‌کند → به‌صورت xpi نصب می‌شود.
 * بخش‌های بدون وابستگی به اندروید اینجاست تا با تست واحد بررسی شوند.
 */
class Converted(val xpi: ByteArray, val geckoId: String, val popup: String)

object ChromeStore {
    private const val MAX_CRX = 64 * 1024 * 1024
    private const val MAX_UNZIPPED = 256L * 1024 * 1024
    private val idRe = Regex("[a-p]{32}")

    /** شناسه‌ی ۳۲ حرفیِ لینک/شناسه‌ی کروم‌استور؛ برای ورودی‌های دیگر null. */
    fun parseId(input: String): String? {
        val t = input.trim()
        val isStore = t.startsWith("https://chromewebstore.google.com/") || t.startsWith("https://chrome.google.com/webstore/") || idRe.matches(t)
        return if (isStore) idRe.find(t)?.value else null
    }

    /** دانلود CRX (فقط HTTPS و فقط دامنه‌ی گوگل). */
    fun download(id: String): ByteArray {
        require(idRe.matches(id)) { "شناسه‌ی نامعتبر" }
        return fetch("https://clients2.google.com/service/update2/crx?response=redirect&acceptformat=crx2,crx3&prodversion=130.0.0.0&x=" +
            java.net.URLEncoder.encode("id=$id&uc", "UTF-8"), listOf(".google.com", ".googleusercontent.com"))
    }

    /** دانلود امن: فقط HTTPS، ریدایرکت فقط به دامنه‌های مجاز، سقف حجم. */
    fun fetch(url: String, allowedSuffixes: List<String>): ByteArray {
        var u = URL(url)
        repeat(5) {
            val c = u.openConnection() as HttpURLConnection
            c.instanceFollowRedirects = false; c.connectTimeout = 15000; c.readTimeout = 30000
            c.setRequestProperty("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")
            val code = c.responseCode
            if (code in 300..399) {
                val next = URL(u, c.getHeaderField("Location") ?: throw IllegalStateException("ریدایرکت نامعتبر"))
                require(next.protocol == "https" && allowedSuffixes.any { next.host.endsWith(it) }) { "میزبان غیرمجاز" }
                u = next; return@repeat
            }
            check(code == 200) { "دانلود ناموفق (HTTP $code)" }
            val out = ByteArrayOutputStream()
            c.inputStream.use { ins -> val buf = ByteArray(16384); while (true) { val n = ins.read(buf); if (n < 0) break; out.write(buf, 0, n); check(out.size() <= MAX_CRX) { "حجم بیش از حد" } } }
            return out.toByteArray()
        }
        error("ریدایرکت‌های زیاد")
    }

    fun crxToZip(b: ByteArray): ByteArray {
        if (b.size > 4 && b[0] == 'P'.code.toByte() && b[1] == 'K'.code.toByte()) return b
        require(b.size > 16 && String(b, 0, 4, Charsets.US_ASCII) == "Cr24") { "فایل CRX معتبر نیست" }
        val bb = ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN)
        return when (bb.getInt(4)) {
            3 -> b.copyOfRange(12 + bb.getInt(8), b.size)
            2 -> b.copyOfRange(16 + bb.getInt(8) + bb.getInt(12), b.size)
            else -> throw IllegalArgumentException("نسخه‌ی CRX پشتیبانی نمی‌شود")
        }
    }

    /** بازبسته‌بندی به xpi با manifest سازگار با Firefox. مسیرهای مشکوک (zip-slip) حذف می‌شوند. */
    fun convert(zip: ByteArray, id: String): Converted {
        val files = linkedMapOf<String, ByteArray>()
        var total = 0L
        ZipInputStream(ByteArrayInputStream(zip)).use { zin ->
            while (true) {
                val e = zin.nextEntry ?: break
                if (e.isDirectory || e.name.contains("..") || e.name.startsWith("/") || e.name.contains('\\')) continue
                val data = zin.readBytes(); total += data.size
                require(total <= MAX_UNZIPPED) { "حجم باز‌شده بیش از حد است" }
                files[e.name] = data
            }
        }
        val raw = files["manifest.json"] ?: throw IllegalArgumentException("manifest.json پیدا نشد")
        val fixed = fixManifest(String(raw, Charsets.UTF_8).removePrefix("\uFEFF"), id)
        files["manifest.json"] = fixed.toByteArray(Charsets.UTF_8)
        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { z ->
            val order = listOf("manifest.json") + files.keys.filter { it != "manifest.json" }
            for (n in order) { z.putNextEntry(ZipEntry(n)); z.write(files.getValue(n)); z.closeEntry() }
        }
        return Converted(out.toByteArray(), geckoIdOf(fixed), popupOf(fixed))
    }

    fun geckoIdOf(json: String): String = JSONObject(json).getJSONObject("browser_specific_settings").getJSONObject("gecko").getString("id")

    /** مسیر پاپ‌آپ دکمه‌ی نوار ابزار (برای باز کردن مستقیم اگر Gecko پاپ‌آپ نداد) */
    fun popupOf(json: String): String {
        val m = JSONObject(json)
        for (k in listOf("action", "browser_action", "page_action")) m.optJSONObject(k)?.optString("default_popup")?.takeIf { it.isNotEmpty() }?.let { return it }
        return ""
    }

    fun fixManifest(json: String, id: String): String {
        val m = JSONObject(json)
        val bss = m.optJSONObject("browser_specific_settings") ?: JSONObject().also { m.put("browser_specific_settings", it) }
        val gecko = bss.optJSONObject("gecko") ?: JSONObject().also { bss.put("gecko", it) }
        if (!gecko.has("id")) gecko.put("id", "$id@chromestore.pars")
        // MV3: Firefox سرویس‌ورکر پس‌زمینه ندارد؛ همان فایل را به‌عنوان background script اجرا می‌کنیم
        m.optJSONObject("background")?.let { bg ->
            val sw = bg.optString("service_worker")
            if (sw.isNotEmpty() && !bg.has("scripts")) bg.put("scripts", JSONArray().put(sw))
        }
        if (m.optString("incognito") == "split") m.remove("incognito")   // در Firefox خطا می‌دهد
        m.remove("key"); m.remove("update_url")                           // جلوگیری از به‌روزرسانی خودکار از گوگل
        return m.toString()
    }
}

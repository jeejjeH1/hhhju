package app.pars.engine

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.compose.runtime.*
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import app.pars.MainActivity
import app.pars.R
import app.pars.widget.PinsWidget
import org.json.JSONArray
import org.json.JSONObject
import org.mozilla.geckoview.*
import java.util.UUID

/**
 * «پین زنده»: افزونه‌ی داخلی (assets/pars-bridge) داخل صفحه‌ها اجرا می‌شود، با اپ پیام رد و بدل می‌کند و
 * مقدار بخش‌های پین‌شده را می‌خواند. به‌روزرسانی با یک سشن پنهان (با کوکی‌های همین مرورگر) انجام می‌شود.
 */
class PinBridge(private val app: Context, private val runtime: GeckoRuntime, private val store: Store, private val allSessions: () -> List<GeckoSession>) {
    val pins = mutableStateListOf<Pin>()
    var picking by mutableStateOf(false)
    var status by mutableStateOf("")
    var pinEvent by mutableIntStateOf(0)
    var refreshing by mutableStateOf(false)
    var onNeedNotifPerm: (() -> Unit)? = null

    private val ui = Handler(Looper.getMainLooper())
    private var ext: WebExtension? = null
    private val ports = HashMap<GeckoSession, WebExtension.Port>()
    private val waiters = HashMap<GeckoSession, () -> Unit>()
    private var lastRefresh = 0L
    private val attached = LinkedHashSet<GeckoSession>()

    private val delegate = object : WebExtension.MessageDelegate {
        override fun onConnect(port: WebExtension.Port) {
            val s = port.sender.session
            // فقط اسکریپت صفحه‌ی اصلی؛ هر چیز دیگر رد می‌شود
            if (s == null || port.name != "pars" || port.sender.environmentType != WebExtension.MessageSender.ENV_TYPE_CONTENT_SCRIPT || !port.sender.isTopLevel) { port.disconnect(); return }
            ports[s] = port
            port.setDelegate(object : WebExtension.PortDelegate {
                override fun onPortMessage(message: Any, port: WebExtension.Port) { (message as? JSONObject)?.let { handle(s, port, it) } }
                override fun onDisconnect(port: WebExtension.Port) { if (ports[s] === port) ports.remove(s) }
            })
        }
    }

    init {
        pins.addAll(PinLogic.fromJson(store.str("pins", "[]")))
        runtime.webExtensionController.ensureBuiltIn("resource://android/assets/pars-bridge/", "bridge@pars.app").accept({ e ->
            ext = e; e?.setMessageDelegate(delegate, "pars")
            (allSessions() + attached).distinct().forEach { attach(it) }
        }, { status = "افزونه‌ی داخلی بارگذاری نشد: ${it?.message ?: "خطا"}" })
    }

    /** پیام‌های اسکریپت داخل صفحه فقط از delegate سطح «سشن» می‌رسد؛ برای هر تب (و سشن پنهان) باید ست شود. */
    fun attach(s: GeckoSession) {
        attached.add(s)
        ext?.let { s.webExtensionController.setMessageDelegate(it, delegate, "pars") }
    }

    private fun handle(s: GeckoSession, port: WebExtension.Port, m: JSONObject) {
        when (m.optString("type")) {
            "hello" -> {
                val url = PinLogic.normalizeUrl(m.optString("url"))
                val mine = pins.filter { PinLogic.normalizeUrl(it.url) == url }
                if (mine.isNotEmpty()) port.postMessage(JSONObject().put("cmd", "watch").put("pins", JSONArray().also { a -> mine.forEach { a.put(JSONObject().put("id", it.id).put("sel", it.sel)) } }))
            }
            "values" -> {
                val a = m.optJSONArray("values") ?: return
                for (i in 0 until a.length()) { val o = a.optJSONObject(i) ?: continue; applyValue(o.optString("id"), o.optString("text"), o.optBoolean("ok")) }
                persist(); waiters[s]?.invoke()
            }
            "picked" -> onPicked(m)
            "pickCancelled" -> picking = false
        }
    }

    private fun applyValue(id: String, text: String, ok: Boolean) {
        val i = pins.indexOfFirst { it.id == id }.takeIf { it >= 0 } ?: return
        val r = PinLogic.apply(pins[i], text, ok, System.currentTimeMillis())
        pins[i] = r.pin
        if (r.changed) notifyChange(r.pin)
    }

    private fun onPicked(m: JSONObject) {
        picking = false
        val url = m.optString("url"); val sel = m.optString("sel"); val text = m.optString("text")
        if (!PinLogic.validPick(url, sel, text)) { status = "انتخاب نامعتبر بود."; return }
        val now = System.currentTimeMillis()
        val title = m.optString("title").ifBlank { Security.hostOf(url) }.take(40)
        pins.add(0, Pin(UUID.randomUUID().toString(), title, url, sel, text.trim().take(200), "", text.trim().take(200), now, now))
        persist(); pinEvent++
        onNeedNotifPerm?.invoke()
    }

    private fun persist() { store.setStr("pins", PinLogic.toJson(pins)); PinsWidget.refreshAll(app) }

    // ───────── API برای UI ─────────
    fun startPick(session: GeckoSession?): Boolean {
        val port = session?.let { ports[it] }
        if (port == null) {
            status = if (ext == null) "افزونه‌ی داخلی بارگذاری نشده است (وضعیت: ${status.ifEmpty { "نامشخص" }})."
            else "افزونه‌ی داخلی لود شده ولی این صفحه به آن وصل نشده است (صفحه را یک بار تازه‌سازی کن و دوباره امتحان کن)."
            return false
        }
        picking = true; port.postMessage(JSONObject().put("cmd", "pick")); return true
    }

    fun cancelPick(session: GeckoSession?) { picking = false; session?.let { ports[it] }?.postMessage(JSONObject().put("cmd", "cancelPick")) }

    fun remove(id: String) { pins.removeAll { it.id == id }; persist() }

    fun refreshIfStale(maxAgeMs: Long) { if (pins.isNotEmpty() && System.currentTimeMillis() - lastRefresh > maxAgeMs) refreshAll() }

    /** هر آدرس را یک بار در یک سشن پنهان (با همان کوکی‌های واردشده) باز می‌کند و مقدار پین‌هایش را می‌خواند. */
    fun refreshAll() {
        if (refreshing || pins.isEmpty() || ext == null) return
        refreshing = true; lastRefresh = System.currentTimeMillis()
        next(ArrayDeque(pins.map { PinLogic.normalizeUrl(it.url) }.distinct().filter { Security.isSafeNavigationUrl(it) }))
    }

    private fun next(q: ArrayDeque<String>) {
        val url = q.removeFirstOrNull() ?: run { refreshing = false; persist(); return }
        val s = GeckoSession(GeckoSessionSettings.Builder().usePrivateMode(false).build())
        s.open(runtime)
        attach(s)
        var done = false
        fun finish() { if (done) return; done = true; waiters.remove(s); ports.remove(s); attached.remove(s); s.close(); next(q) }
        waiters[s] = { ui.postDelayed({ finish() }, 300) }
        ui.postDelayed({ finish() }, 25000)
        s.loadUri(url)
    }

    // ───────── اعلان ─────────
    private fun notifyChange(p: Pin) {
        if (Build.VERSION.SDK_INT >= 33 && app.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val nm = app.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel("pins", "تغییر پین‌ها", NotificationManager.IMPORTANCE_DEFAULT))
        val open = PendingIntent.getActivity(app, 0, Intent(app, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(app, "pins").setSmallIcon(R.drawable.ic_stat_pin).setContentTitle(p.title)
            .setContentText("${p.prev}  ←  ${p.value}").setStyle(NotificationCompat.BigTextStyle().bigText("قبلی: ${p.prev}\nجدید: ${p.value}"))
            .setContentIntent(open).setAutoCancel(true).build()
        NotificationManagerCompat.from(app).notify(p.id.hashCode(), n)
    }
}

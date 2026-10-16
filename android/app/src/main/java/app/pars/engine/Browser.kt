package app.pars.engine

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.webkit.URLUtil
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.ImageBitmap
import org.mozilla.geckoview.*
import org.mozilla.geckoview.GeckoSession.PermissionDelegate as PD

class Tab(val id: Int, val priv: Boolean, val session: GeckoSession) {
    var url by mutableStateOf("")
    var title by mutableStateOf("")
    var progress by mutableIntStateOf(0)
    var loading by mutableStateOf(false)
    var canBack by mutableStateOf(false)
    var canForward by mutableStateOf(false)
    var secure by mutableStateOf(false)
    var blocked by mutableIntStateOf(0)
    var desktop by mutableStateOf(false)
    var thumb by mutableStateOf<ImageBitmap?>(null)
    val isBlank get() = url.isEmpty() || url == "about:blank"
}

class PermRequest(val origin: String, val kind: String, val answer: (Boolean) -> Unit)
class InstallRequest(val name: String, val perms: List<String>, val origins: List<String>, val unverified: Boolean, val answer: (Boolean) -> Unit)
class DownloadRequest(val name: String, val uri: String, val risky: Boolean)
class ExtInfo(val ext: WebExtension) {
    val optionsUrl: String? get() = ext.metaData.optionsPageUrl?.takeIf { it.isNotEmpty() }
    val id get() = ext.id
    val name get() = ext.metaData.name ?: ext.id
    val version get() = ext.metaData.version ?: ""
    val description get() = ext.metaData.description ?: ""
}

/** هسته‌ی مرورگر: یک GeckoRuntime مشترک + مدیریت تب‌ها + مجوزها + اکستنشن‌ها. */
class Browser(private val app: Context) {
    val store = Store(app)
    val runtime: GeckoRuntime

    val tabs = mutableStateListOf<Tab>()
    var activeId by mutableIntStateOf(-1)
    var fullscreen by mutableStateOf(false)
    var blockedTotal by mutableIntStateOf(store.blockedTotal)
    var permRequest by mutableStateOf<PermRequest?>(null)
    var installRequest by mutableStateOf<InstallRequest?>(null)
    var downloadRequest by mutableStateOf<DownloadRequest?>(null)
    var extStatus by mutableStateOf("")
    var popup by mutableStateOf<GeckoSession?>(null)
    val extensions = mutableStateListOf<ExtInfo>()
    lateinit var pinBridge: PinBridge
    var version by mutableIntStateOf(0)      // با هر تغییر نشان‌ها/تاریخچه/تنظیمات بالا می‌رود تا UI تازه شود

    /** درخواست مجوز اندروید از Activity (دوربین/میکروفون/موقعیت) */
    var requestAndroidPerms: ((Array<String>, (Boolean) -> Unit) -> Unit)? = null

    private val loadedExts = ArrayList<WebExtension>()
    private var popupRequested = false
    private val actions = HashMap<String, WebExtension.Action>()   // اکشن دکمه‌ی نوار ابزار هر افزونه (با رفرش لیست پاک نمی‌شود)
    var extMessage by mutableStateOf("")
    private var nextId = 1
    private var unverifiedNext = false
    private val ui = android.os.Handler(android.os.Looper.getMainLooper())
    val active: Tab? get() = tabs.firstOrNull { it.id == activeId }

    init {
        val cb = ContentBlocking.Settings.Builder()
            .antiTracking(if (store.strictTracking) ContentBlocking.AntiTracking.STRICT else ContentBlocking.AntiTracking.DEFAULT)
            .enhancedTrackingProtectionLevel(if (store.strictTracking) ContentBlocking.EtpLevel.STRICT else ContentBlocking.EtpLevel.DEFAULT)
            .cookieBehavior(ContentBlocking.CookieBehavior.ACCEPT_FIRST_PARTY_AND_ISOLATE_OTHERS)
            .safeBrowsing(ContentBlocking.SafeBrowsing.DEFAULT)
            .build()
        runtime = GeckoRuntime.create(
            app,
            GeckoRuntimeSettings.Builder()
                .aboutConfigEnabled(false)
                .remoteDebuggingEnabled(false)
                .globalPrivacyControlEnabled(true)
                .allowInsecureConnections(if (store.httpsOnly) GeckoRuntimeSettings.HTTPS_ONLY else GeckoRuntimeSettings.ALLOW_ALL)
                .contentBlocking(cb)
                .build(),
        )
        setupExtensions()
        refreshExtensions()
        pinBridge = PinBridge(app, runtime, store)
        val saved = store.savedTabs()
        if (saved.isEmpty()) newTab() else saved.forEachIndexed { i, u -> newTab(u, select = i == saved.lastIndex) }
    }

    // ───────── تب‌ها ─────────
    fun newTab(url: String = "", priv: Boolean = false, session: GeckoSession? = null, select: Boolean = true): Tab {
        val s = session ?: GeckoSession(GeckoSessionSettings.Builder().usePrivateMode(priv).build())
        val tab = Tab(nextId++, priv, s)
        attach(tab)
        if (session == null) {
            s.open(runtime)
            if (url.isNotEmpty() && Security.isSafeNavigationUrl(url)) s.loadUri(url)
        }
        tabs.add(tab)
        if (select) select(tab.id)
        return tab
    }

    fun select(id: Int) {
        activeId = id
        tabs.forEach { it.session.setActive(it.id == id) }
    }

    fun closeTab(id: Int) {
        val i = tabs.indexOfFirst { it.id == id }.takeIf { it >= 0 } ?: return
        val t = tabs.removeAt(i)
        t.session.close()
        if (tabs.isEmpty()) newTab() else if (activeId == id) select(tabs[minOf(i, tabs.size - 1)].id)
    }

    fun go(input: String) {
        val t = active ?: return
        val url = Security.resolveInput(input, store.searchEngine)
        if (url.isNotEmpty()) t.session.loadUri(url)
    }

    fun toggleBookmark() {
        val t = active ?: return
        if (t.priv || !Security.isSafeNavigationUrl(t.url)) return
        store.toggleBookmark(t.url, t.title); version++
    }

    fun persistTabs() = store.saveTabs(tabs.filter { !it.priv && Security.isSafeNavigationUrl(it.url) }.map { it.url })

    private fun attach(tab: Tab) {
        val s = tab.session
        s.contentDelegate = object : GeckoSession.ContentDelegate {
            override fun onTitleChange(session: GeckoSession, title: String?) {
                tab.title = title ?: ""
                if (!tab.priv) store.updateHistoryTitle(tab.url, tab.title)
            }
            override fun onFullScreen(session: GeckoSession, fullScreen: Boolean) { if (tab.id == activeId) fullscreen = fullScreen }
            override fun onExternalResponse(session: GeckoSession, response: WebResponse) { askDownload(response) }
            override fun onCloseRequest(session: GeckoSession) { closeTab(tab.id) }
        }
        s.navigationDelegate = object : GeckoSession.NavigationDelegate {
            override fun onLocationChange(session: GeckoSession, url: String?, perms: MutableList<PD.ContentPermission>, hasUserGesture: Boolean) {
                tab.url = url ?: ""
                if (!tab.priv && url != null && Security.isSafeNavigationUrl(url)) { store.addHistory(url, tab.title); version++ }
            }
            override fun onCanGoBack(session: GeckoSession, canGoBack: Boolean) { tab.canBack = canGoBack }
            override fun onCanGoForward(session: GeckoSession, canGoForward: Boolean) { tab.canForward = canGoForward }
            override fun onLoadRequest(session: GeckoSession, request: GeckoSession.NavigationDelegate.LoadRequest): GeckoResult<AllowOrDeny>? {
                val u = request.uri
                val ok = u.startsWith("https://") || u.startsWith("http://") || u.startsWith("about:") || u.startsWith("blob:") || u.startsWith("moz-extension://")
                return if (ok) GeckoResult.allow() else GeckoResult.deny()   // file:, intent:, javascript:, content: … رد می‌شود
            }
            override fun onNewSession(session: GeckoSession, uri: String): GeckoResult<GeckoSession> {
                val ns = GeckoSession(GeckoSessionSettings.Builder().usePrivateMode(tab.priv).build())
                newTab(session = ns, priv = tab.priv)
                return GeckoResult.fromValue(ns)
            }
        }
        s.progressDelegate = object : GeckoSession.ProgressDelegate {
            override fun onPageStart(session: GeckoSession, url: String) { tab.loading = true; tab.progress = 0; tab.blocked = 0 }
            override fun onPageStop(session: GeckoSession, success: Boolean) { tab.loading = false; tab.progress = 100 }
            override fun onProgressChange(session: GeckoSession, progress: Int) { tab.progress = progress }
            override fun onSecurityChange(session: GeckoSession, info: GeckoSession.ProgressDelegate.SecurityInformation) { tab.secure = info.isSecure }
        }
        s.setContentBlockingDelegate(object : ContentBlocking.Delegate {
            override fun onContentBlocked(session: GeckoSession, event: ContentBlocking.BlockEvent) {
                tab.blocked++; blockedTotal++; store.blockedTotal = blockedTotal
            }
        })
        loadedExts.forEach { s.webExtensionController.setActionDelegate(it, actionDelegate) }
        s.permissionDelegate = object : PD {
            override fun onAndroidPermissionsRequest(session: GeckoSession, permissions: Array<out String>?, callback: PD.Callback) {
                val req = requestAndroidPerms
                if (permissions == null || req == null) { callback.reject(); return }
                req(arrayOf(*permissions)) { granted -> if (granted) callback.grant() else callback.reject() }
            }

            override fun onContentPermissionRequest(session: GeckoSession, perm: PD.ContentPermission): GeckoResult<Int>? {
                val kind = when (perm.permission) {
                    PD.PERMISSION_GEOLOCATION -> "geo"
                    PD.PERMISSION_DESKTOP_NOTIFICATION -> "notif"
                    else -> null
                }
                if (kind == null) {   // پیش‌فرض: رد (به‌جز پخش خودکار بی‌صدا و DRM)
                    val ok = perm.permission == PD.PERMISSION_AUTOPLAY_INAUDIBLE || perm.permission == PD.PERMISSION_MEDIA_KEY_SYSTEM_ACCESS
                    return GeckoResult.fromValue(if (ok) PD.ContentPermission.VALUE_ALLOW else PD.ContentPermission.VALUE_DENY)
                }
                val r = GeckoResult<Int>()
                permRequest = PermRequest(perm.uri, kind) { allow ->
                    permRequest = null
                    r.complete(if (allow) PD.ContentPermission.VALUE_ALLOW else PD.ContentPermission.VALUE_DENY)
                }
                return r
            }

            override fun onMediaPermissionRequest(
                session: GeckoSession, uri: String, video: Array<out PD.MediaSource>?, audio: Array<out PD.MediaSource>?, callback: PD.MediaCallback,
            ) {
                val kind = when { video?.isNotEmpty() == true && audio?.isNotEmpty() == true -> "camera+mic"; video?.isNotEmpty() == true -> "camera"; else -> "mic" }
                permRequest = PermRequest(uri, kind) { allow ->
                    permRequest = null
                    if (allow) callback.grant(video?.firstOrNull(), audio?.firstOrNull()) else callback.reject()
                }
            }
        }
    }

    // ───────── دانلود ─────────
    private fun askDownload(r: WebResponse) {
        val h = r.headers
        val disp = h["Content-Disposition"] ?: h["content-disposition"]
        val mime = h["Content-Type"] ?: h["content-type"]
        val name = URLUtil.guessFileName(r.uri, disp, mime)
        downloadRequest = DownloadRequest(name, r.uri, Security.isDangerousFile(name))
    }

    fun confirmDownload(ok: Boolean) {
        val d = downloadRequest ?: return
        downloadRequest = null
        if (!ok || !Security.isSafeNavigationUrl(d.uri)) return
        val req = DownloadManager.Request(Uri.parse(d.uri))
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalFilesDir(app, Environment.DIRECTORY_DOWNLOADS, d.name)
        (app.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(req)
    }

    // ───────── اکستنشن‌ها ─────────
    private fun setupExtensions() {
        runtime.webExtensionController.setPromptDelegate(object : WebExtensionController.PromptDelegate {
            override fun onInstallPromptRequest(
                extension: WebExtension, permissions: Array<out String>, origins: Array<out String>, dataCollectionPermissions: Array<out String>,
            ): GeckoResult<WebExtension.PermissionPromptResponse>? {
                val r = GeckoResult<WebExtension.PermissionPromptResponse>()
                installRequest = InstallRequest(extension.metaData.name ?: extension.id, permissions.toList(), origins.toList(), unverifiedNext) { ok ->
                    installRequest = null
                    // حالت خصوصی و جمع‌آوری داده‌ی فنی همیشه رد می‌شود
                    r.complete(WebExtension.PermissionPromptResponse(ok, false, false))
                }
                return r
            }
        })
    }

    private val actionDelegate = object : WebExtension.ActionDelegate {
        override fun onBrowserAction(extension: WebExtension, session: GeckoSession?, action: WebExtension.Action) { updateAction(extension, action) }
        override fun onTogglePopup(extension: WebExtension, action: WebExtension.Action): GeckoResult<GeckoSession>? = openPopup()
        override fun onOpenPopup(extension: WebExtension, action: WebExtension.Action): GeckoResult<GeckoSession>? = openPopup()
    }

    /** delegate هم روی خود افزونه و هم روی هر تب ست می‌شود؛ بدون این، پاپ‌آپ بعضی افزونه‌ها هرگز باز نمی‌شود. */
    private fun hookActions(ext: WebExtension) {
        loadedExts.add(ext)
        ext.setActionDelegate(actionDelegate)
        tabs.forEach { it.session.webExtensionController.setActionDelegate(ext, actionDelegate) }
    }

    private fun openPopup(): GeckoResult<GeckoSession> {
        popupRequested = true
        val s = GeckoSession(); s.open(runtime); popup = s
        return GeckoResult.fromValue(s)
    }

    private fun updateAction(ext: WebExtension, action: WebExtension.Action) { actions[ext.id] = action }

    fun refreshExtensions() {
        runtime.webExtensionController.list().accept({ list ->
            extensions.clear(); loadedExts.clear()
            list?.filter { !it.isBuiltIn }?.forEach { hookActions(it); extensions.add(ExtInfo(it)) }
        }, { extStatus = "خطا در خواندن اکستنشن‌ها" })
    }

    fun installExtension(input: String) {
        ChromeStore.parseId(input)?.let { installFromChromeStore(it); return }
        // لینک کروم‌استور بدون شناسه (فقط نام) → معادلش را در AMO جستجو می‌کنیم.
        Security.chromeStoreName(input)?.let { name ->
            extStatus = "این لینک مال Chrome Store است و روی این مرورگر نصب نمی‌شود. معادل Firefox آن را در یک تب جدید جستجو کردم؛ نام افزونه‌ی AMO را همین‌جا بنویس و «نصب» بزن."
            newTab(Security.amoSearchUrl(name.ifBlank { "extensions" }))
            return
        }
        val url = Security.amoXpiUrl(input)
        if (url == null) { extStatus = "فقط لینک یا نام افزونه از addons.mozilla.org پذیرفته می‌شود."; return }
        extStatus = "در حال دریافت…"
        runtime.webExtensionController.install(url).accept({ ext ->
            extStatus = "«${ext?.metaData?.name}» نصب شد."; refreshExtensions()
        }, { e -> extStatus = if (e?.message?.contains("USER_CANCELED") == true) "" else "نصب نشد: ${e?.message ?: "خطا"}" })
    }

    /** Chrome Web Store → تبدیل به xpi → نصب (با اجازه‌ی کاربر). بدون امضای Mozilla؛ سازگاری کامل تضمین نیست. */
    private fun installFromChromeStore(id: String) {
        extStatus = "در حال دریافت از Chrome Store…"
        Thread {
            try {
                val conv = ChromeStore.convert(ChromeStore.crxToZip(ChromeStore.download(id)), id)
                if (conv.popup.isNotEmpty()) store.setStr("popup:${conv.geckoId}", conv.popup)
                val f = java.io.File(app.cacheDir, "cws-$id.xpi").also { it.writeBytes(conv.xpi) }
                ui.post {
                    GeckoPreferenceController.setGeckoPref("xpinstall.signatures.required", false, GeckoPreferenceController.PREF_BRANCH_USER)
                        .accept({
                            unverifiedNext = true
                            runtime.webExtensionController.install("file://" + f.absolutePath).accept({ ext ->
                                unverifiedNext = false; f.delete()
                                extStatus = "«${ext?.metaData?.name}» نصب شد. (بعضی افزونه‌های کروم ممکن است کامل کار نکنند)"; refreshExtensions()
                            }, { e -> unverifiedNext = false; f.delete(); extStatus = if (e?.message?.contains("USER_CANCELED") == true) "" else "نصب نشد: ${e?.message ?: "خطا"}" })
                        }, { extStatus = "تنظیم نصب افزونه‌ی بررسی‌نشده ممکن نشد." })
                }
            } catch (e: Exception) {
                ui.post { extStatus = "دریافت/تبدیل ناموفق: ${e.message ?: "خطا"}" }
            }
        }.start()
    }

    fun removeExtension(e: ExtInfo) {
        runtime.webExtensionController.uninstall(e.ext).accept({ refreshExtensions() }, { extStatus = "حذف نشد" })
    }

    /** باز کردن افزونه: پاپ‌آپ دکمه‌ی نوار ابزار؛ اگر باز نشد، گزینه‌ها یا خود صفحه‌ی پاپ‌آپ در تب جدید. */
    fun openExtension(e: ExtInfo) {
        val act = actions[e.id]
        popupRequested = false
        act?.click()
        ui.postDelayed({
            if (popupRequested || popup != null) return@postDelayed
            val base = e.ext.metaData.baseUrl
            val pp = store.str("popup:${e.id}", "")
            when {
                base != null && pp.isNotEmpty() -> openExtensionPage(base.trimEnd('/') + "/" + pp.trimStart('/'))
                e.optionsUrl != null -> openExtensionPage(e.optionsUrl!!)
                else -> extStatus = "«${e.name}» پاپ‌آپ یا صفحه‌ی تنظیمات ندارد (اکشن نوار ابزار: ${if (act == null) "ثبت نشده" else "ثبت شده"}). ممکن است فقط در پس‌زمینه یا روی صفحات خاص کار کند."
            }
        }, if (act != null) 900L else 0L)
    }

    fun openExtensionPage(url: String) {
        val t = newTab()                 // آدرس moz-extension:// فقط از اینجا (نه از ورودی کاربر) باز می‌شود
        t.session.loadUri(url)
    }

    // ───────── ذخیره‌ی فایل افزونه ─────────
    /** فایل کامل افزونه (CRX از Chrome Store یا XPI از AMO) را بدون نصب در Downloads/Pars ذخیره می‌کند. */
    fun saveExtensionFile(input: String) {
        val cws = ChromeStore.parseId(input)
        val amo = if (cws == null) Security.amoXpiUrl(input) else null
        if (cws == null && amo == null) { extStatus = "لینک Chrome Store یا addons.mozilla.org را وارد کن."; return }
        extStatus = "در حال دانلود فایل افزونه…"
        Thread {
            try {
                val (name, bytes) = if (cws != null) "$cws.crx" to ChromeStore.download(cws)
                else Regex("/latest/([^/]+)/").find(amo!!)!!.groupValues[1].let { "$it.xpi" to ChromeStore.fetch(amo, listOf(".mozilla.org", ".mozilla.net", ".mozilla.com")) }
                val where = saveToDownloads(name, bytes)
                ui.post { extStatus = "ذخیره شد: $where (${bytes.size / 1024} کیلوبایت)" }
            } catch (e: Exception) { ui.post { extStatus = "دانلود ناموفق: ${e.message ?: "خطا"}" } }
        }.start()
    }

    private fun saveToDownloads(name: String, bytes: ByteArray): String {
        val safe = name.replace(Regex("[^A-Za-z0-9._-]"), "_")
        if (android.os.Build.VERSION.SDK_INT >= 29) {
            val v = android.content.ContentValues().apply {
                put(android.provider.MediaStore.Downloads.DISPLAY_NAME, safe)
                put(android.provider.MediaStore.Downloads.MIME_TYPE, "application/octet-stream")
                put(android.provider.MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Pars")
            }
            val uri = app.contentResolver.insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, v) ?: error("ذخیره ممکن نشد")
            app.contentResolver.openOutputStream(uri)!!.use { it.write(bytes) }
            return "Download/Pars/$safe"
        }
        val f = java.io.File(app.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), safe)
        f.writeBytes(bytes); return f.absolutePath
    }

    // ───────── ظاهر وب و حالت دسکتاپ ─────────
    fun toggleDesktop() {
        val t = active ?: return
        t.desktop = !t.desktop
        t.session.settings.setUserAgentMode(if (t.desktop) GeckoSessionSettings.USER_AGENT_MODE_DESKTOP else GeckoSessionSettings.USER_AGENT_MODE_MOBILE)
        t.session.settings.setViewportMode(if (t.desktop) GeckoSessionSettings.VIEWPORT_MODE_DESKTOP else GeckoSessionSettings.VIEWPORT_MODE_MOBILE)
        t.session.reload()
    }

    /** اندازه‌ی متن صفحات وب و روشن/تیره بودنشان */
    fun applyWebLook(textScale: Float, scheme: String) {
        runtime.settings.setAutomaticFontSizeAdjustment(false)
        runtime.settings.setFontSizeFactor(textScale)
        runtime.settings.setPreferredColorScheme(when (scheme) { "light" -> GeckoRuntimeSettings.COLOR_SCHEME_LIGHT; "dark" -> GeckoRuntimeSettings.COLOR_SCHEME_DARK; else -> GeckoRuntimeSettings.COLOR_SCHEME_SYSTEM })
    }

    // ───────── تنظیمات ─────────
    fun setHttpsOnly(on: Boolean) {
        store.httpsOnly = on; version++
        runtime.settings.setAllowInsecureConnections(if (on) GeckoRuntimeSettings.HTTPS_ONLY else GeckoRuntimeSettings.ALLOW_ALL)
    }

    fun setStrict(on: Boolean) {
        store.strictTracking = on; version++
        runtime.settings.contentBlocking.setAntiTracking(if (on) ContentBlocking.AntiTracking.STRICT else ContentBlocking.AntiTracking.DEFAULT)
        runtime.settings.contentBlocking.setEnhancedTrackingProtectionLevel(if (on) ContentBlocking.EtpLevel.STRICT else ContentBlocking.EtpLevel.DEFAULT)
    }

    fun clearAll(onDone: () -> Unit = {}) {
        runtime.storageController.clearData(StorageController.ClearFlags.ALL).accept({ store.clearHistory(); version++; onDone() }, { onDone() })
    }
}

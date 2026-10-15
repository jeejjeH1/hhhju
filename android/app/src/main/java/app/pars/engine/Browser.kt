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
    var thumb by mutableStateOf<ImageBitmap?>(null)
    val isBlank get() = url.isEmpty() || url == "about:blank"
}

class PermRequest(val origin: String, val kind: String, val answer: (Boolean) -> Unit)
class InstallRequest(val name: String, val perms: List<String>, val origins: List<String>, val answer: (Boolean) -> Unit)
class DownloadRequest(val name: String, val uri: String, val risky: Boolean)
class ExtInfo(val ext: WebExtension, val action: WebExtension.Action?) {
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
    var version by mutableIntStateOf(0)      // با هر تغییر نشان‌ها/تاریخچه/تنظیمات بالا می‌رود تا UI تازه شود

    /** درخواست مجوز اندروید از Activity (دوربین/میکروفون/موقعیت) */
    var requestAndroidPerms: ((Array<String>, (Boolean) -> Unit) -> Unit)? = null

    private var nextId = 1
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
                installRequest = InstallRequest(extension.metaData.name ?: extension.id, permissions.toList(), origins.toList()) { ok ->
                    installRequest = null
                    // حالت خصوصی و جمع‌آوری داده‌ی فنی همیشه رد می‌شود
                    r.complete(WebExtension.PermissionPromptResponse(ok, false, false))
                }
                return r
            }
        })
    }

    private fun hookActions(ext: WebExtension) {
        ext.setActionDelegate(object : WebExtension.ActionDelegate {
            override fun onBrowserAction(extension: WebExtension, session: GeckoSession?, action: WebExtension.Action) { updateAction(extension, action) }
            override fun onTogglePopup(extension: WebExtension, action: WebExtension.Action): GeckoResult<GeckoSession>? = openPopup()
            override fun onOpenPopup(extension: WebExtension, action: WebExtension.Action): GeckoResult<GeckoSession>? = openPopup()
        })
    }

    private fun openPopup(): GeckoResult<GeckoSession> {
        val s = GeckoSession(); s.open(runtime); popup = s
        return GeckoResult.fromValue(s)
    }

    private fun updateAction(ext: WebExtension, action: WebExtension.Action) {
        val i = extensions.indexOfFirst { it.id == ext.id }
        if (i >= 0) extensions[i] = ExtInfo(ext, action)
    }

    fun refreshExtensions() {
        runtime.webExtensionController.list().accept({ list ->
            extensions.clear()
            list?.filter { !it.isBuiltIn }?.forEach { hookActions(it); extensions.add(ExtInfo(it, null)) }
        }, { extStatus = "خطا در خواندن اکستنشن‌ها" })
    }

    fun installExtension(input: String) {
        // افزونه‌های Chrome Web Store روی موتور Firefox نصب نمی‌شوند؛ معادلش را در AMO پیدا می‌کنیم.
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

    fun removeExtension(e: ExtInfo) {
        runtime.webExtensionController.uninstall(e.ext).accept({ refreshExtensions() }, { extStatus = "حذف نشد" })
    }

    fun clickExtension(e: ExtInfo) { e.action?.click() ?: run { extStatus = "این اکستنشن دکمه‌ی نوار ابزار ندارد." } }

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

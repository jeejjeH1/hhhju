package app.pars

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.platform.LocalLayoutDirection
import app.pars.engine.Security
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.core.view.WindowCompat
import app.pars.ui.BrowserScreen
import app.pars.ui.C
import app.pars.ui.Look
import app.pars.ui.ParsTheme

class MainActivity : ComponentActivity() {
    private val browser get() = (application as ParsApp).browser
    private val notifLauncher = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }
    private var permCallback: ((Boolean) -> Unit)? = null
    private val permLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r ->
        permCallback?.invoke(r.values.all { it }); permCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT))
        browser.requestAndroidPerms = { perms, cb ->
            val missing = perms.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
            if (missing.isEmpty()) cb(true) else { permCallback = cb; permLauncher.launch(missing.toTypedArray()) }
        }
        browser.pinBridge.onNeedNotifPerm = { if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS) }
        handleIntent(intent)
        Look.load(browser.store)
        browser.applyWebLook(Look.webTextScale, Look.webScheme)
        setContent {
            val base = LocalDensity.current
            // اندازه‌ی عناصر و متن را کاربر تنظیم می‌کند؛ متن مستقل از اندازه‌ی عناصر مقیاس می‌گیرد
            CompositionLocalProvider(LocalDensity provides Density(base.density * Look.uiScale, base.fontScale * Look.textScale / Look.uiScale)) {
              ParsTheme {
                // رابط راست‌به‌چپ (فارسی)؛ آدرس‌ها خودشان LTR نمایش داده می‌شوند
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    LaunchedEffect(C.isDark) {
                        val c = WindowCompat.getInsetsController(window, window.decorView)
                        c.isAppearanceLightStatusBars = !C.isDark; c.isAppearanceLightNavigationBars = !C.isDark
                    }
                    val priv = browser.active?.priv == true
                    LaunchedEffect(priv) {
                        // تب خصوصی: جلوگیری از اسکرین‌شات و پیش‌نمایش در لیست برنامه‌ها
                        if (priv) window.addFlags(WindowManager.LayoutParams.FLAG_SECURE) else window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                    }
                    BrowserScreen(browser)
                }
              }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    /** لینک‌های بیرونی فقط اگر http/https باشند باز می‌شوند. */
    private fun handleIntent(i: Intent?) {
        val u = i?.dataString ?: return
        if (i.action == Intent.ACTION_VIEW && Security.isSafeNavigationUrl(u)) browser.newTab(u)
    }

    override fun onStart() {
        super.onStart()
        browser.pinBridge.refreshIfStale(if (intent?.getBooleanExtra("refresh", false) == true) 0L else 15 * 60_000L)
    }

    override fun onStop() {
        super.onStop()
        browser.persistTabs()
    }

    override fun onDestroy() {
        if (isFinishing && browser.store.clearOnExit) browser.clearAll()
        super.onDestroy()
    }
}

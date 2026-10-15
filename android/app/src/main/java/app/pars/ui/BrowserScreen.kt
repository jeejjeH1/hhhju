package app.pars.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import app.pars.engine.Browser
import app.pars.engine.Security
import org.mozilla.geckoview.GeckoView

enum class Panel { None, Menu, Bookmarks, History, Extensions, Settings }

@Composable
fun BrowserScreen(b: Browser) {
    var panel by remember { mutableStateOf(Panel.None) }
    var searching by remember { mutableStateOf(false) }
    var switcher by remember { mutableStateOf(false) }
    val tab = b.active
    val geckoRef = remember { arrayOfNulls<GeckoView>(1) }

    BackHandler(enabled = panel != Panel.None || searching || switcher || b.popup != null || (tab != null && (tab.canBack || tabCount(b) > 1))) {
        when {
            b.popup != null -> { b.popup?.close(); b.popup = null }
            searching -> searching = false
            switcher -> switcher = false
            panel != Panel.None -> panel = Panel.None
            tab != null && tab.canBack -> tab.session.goBack()
            tab != null -> b.closeTab(tab.id)
        }
    }

    Box(Modifier.fillMaxSize().background(C.Bg)) {
        // موتور وب: یک GeckoView مشترک که سشن تب فعال را نشان می‌دهد
        val barPad = if (b.fullscreen) 0.dp else 118.dp
        AndroidView(
            factory = { ctx -> GeckoView(ctx).also { geckoRef[0] = it } },
            update = { v -> tab?.let { if (v.session !== it.session) { v.releaseSession(); v.setSession(it.session) } } },
            modifier = Modifier.fillMaxSize().padding(bottom = barPad).statusBarsPadding(),
        )
        if (tab != null) {
            AnimatedVisibility(tab.isBlank, enter = fadeIn(tween(250)), exit = fadeOut(tween(350)) + scaleOut(targetScale = 1.08f, animationSpec = tween(350))) {
                StartScreen(
                    isPrivate = tab.priv, bookmarks = remember(b.version) { b.store.bookmarks() }, blockedTotal = b.blockedTotal,
                    onSearch = { searching = true }, onOpen = { b.go(it) },
                )
            }
        }
        if (!b.fullscreen && tab != null) {
            BottomBar(
                b, Modifier.align(Alignment.BottomCenter),
                onOmni = { searching = true },
                onTabs = { geckoRef[0]?.capturePixels()?.accept({ bmp -> tab.thumb = bmp?.asImageBitmap() }, { }); switcher = true },
                onMenu = { panel = Panel.Menu },
            )
        }

        AnimatedVisibility(searching, enter = fadeIn(tween(160)) + scaleIn(spring(.8f, 400f), initialScale = .94f, transformOrigin = androidx.compose.ui.graphics.TransformOrigin(.5f, 1f)), exit = fadeOut(tween(120)) + scaleOut(targetScale = .96f)) {
            SearchOverlay(b, onClose = { searching = false })
        }
        AnimatedVisibility(switcher, enter = fadeIn(tween(200)) + scaleIn(spring(.75f, 300f), initialScale = .85f), exit = fadeOut(tween(150)) + scaleOut(targetScale = .9f)) {
            TabSwitcher(b, onClose = { switcher = false })
        }
        Sheets(b, panel, onPanel = { panel = it })
        b.popup?.let { ext -> ExtensionPopup(ext) { b.popup?.close(); b.popup = null } }
        Dialogs(b)
    }
}

private fun tabCount(b: Browser) = b.tabs.size

@Composable
private fun BottomBar(b: Browser, modifier: Modifier, onOmni: () -> Unit, onTabs: () -> Unit, onMenu: () -> Unit) {
    val t = b.active ?: return
    val bookmarked = remember(b.version, t.url) { b.store.isBookmarked(t.url) }
    val accent = if (t.priv) C.Cyan else C.Magenta
    Column(
        modifier.fillMaxWidth().background(BarBg).navigationBarsPadding().progressLine(if (t.loading) t.progress / 100f else 0f).padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // نوار آدرس (قرص) با نور چرخان هنگام بارگذاری
        Row(
            Modifier.fillMaxWidth().height(48.dp).sweepGlow(t.loading, t.progress / 100f).clip(RoundedCornerShape(24.dp)).background(C.Surface2)
                .border(1.dp, C.Line, RoundedCornerShape(24.dp)).clickable(onClick = onOmni).padding(horizontal = 14.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            val lockColor by animateColorAsState(when { t.isBlank -> C.Muted; t.secure -> C.Mint; t.url.startsWith("http://") -> C.Red; else -> C.Muted }, tween(400), label = "lock")
            Glyph(if (t.isBlank) G.Search else if (t.secure) G.Lock else G.Warn, lockColor, 20.dp)
            Text(
                if (t.isBlank) "جستجو یا وارد کردن نشانی…" else Security.hostOf(t.url).ifEmpty { t.url }.removePrefix("www."),
                color = if (t.isBlank) C.Muted else C.Text, fontSize = 14.sp, fontFamily = if (t.isBlank) null else F.Mono,
                maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
            )
            ShieldBadge(t.blocked, accent)
            if (t.priv) Glyph(G.Mask, C.Cyan, 20.dp)
            Box(Modifier.size(32.dp).clip(CircleShape).clickable { if (t.loading) t.session.stop() else t.session.reload() }, contentAlignment = Alignment.Center) {
                val rot by animateFloatAsState(if (t.loading) 90f else 0f, spring(.6f, 200f), label = "rl")
                Glyph(if (t.loading) G.Close else G.Reload, C.Muted, 20.dp, modifier = Modifier.graphicsLayer { rotationZ = rot })
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
            BarButton(G.Back, enabled = t.canBack) { t.session.goBack() }
            BarButton(G.Forward, enabled = t.canForward) { t.session.goForward() }
            TabsButton(b.tabs.size, accent, onTabs)
            BarButton(G.Star, tint = if (bookmarked) C.Amber else C.Muted, filled = bookmarked, enabled = !t.isBlank && !t.priv) { b.toggleBookmark() }
            BarButton(G.Menu, onClick = onMenu)
        }
    }
}

private val BarBg = Color(0xF2090812)

@Composable
fun ShieldBadge(count: Int, accent: Color) {
    AnimatedVisibility(count > 0, enter = scaleIn(spring(.5f, 400f)) + fadeIn(), exit = scaleOut() + fadeOut()) {
        Row(
            Modifier.clip(CircleShape).background(accent.copy(alpha = .14f)).padding(horizontal = 8.dp, vertical = 3.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Glyph(G.Shield, accent, 14.dp)
            AnimatedContent(count, transitionSpec = { (slideInVertically { it } + fadeIn()) togetherWith (slideOutVertically { -it } + fadeOut()) }, label = "cnt") {
                Text(it.toString(), color = accent, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = F.Mono)
            }
        }
    }
}

@Composable
private fun BarButton(path: String, tint: Color = C.Muted, filled: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    val src = remember { MutableInteractionSource() }
    val pressed by src.collectIsPressedAsState()
    val s by animateFloatAsState(if (pressed) .8f else 1f, spring(.5f, 600f), label = "press")
    Box(Modifier.size(48.dp).graphicsScale(s).clip(CircleShape).clickable(enabled = enabled, interactionSource = src, indication = null, onClick = onClick), contentAlignment = Alignment.Center) {
        Glyph(path, if (enabled) (if (tint == C.Muted) C.Text else tint) else C.Line, 24.dp)
        if (filled) Glyph(path, tint.copy(alpha = .35f), 24.dp, 6f)
    }
}

@Composable
private fun TabsButton(count: Int, accent: Color, onClick: () -> Unit) {
    Box(Modifier.size(48.dp).clip(CircleShape).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        Box(Modifier.size(26.dp).border(2.dp, accent, RoundedCornerShape(8.dp)), contentAlignment = Alignment.Center) {
            AnimatedContent(count, transitionSpec = { (scaleIn(spring(.5f, 500f)) + fadeIn()) togetherWith (scaleOut() + fadeOut()) }, label = "tabs") {
                Text(it.toString(), color = C.Text, fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = F.Mono)
            }
        }
    }
}

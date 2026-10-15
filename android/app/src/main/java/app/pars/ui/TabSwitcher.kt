package app.pars.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pars.engine.Browser
import app.pars.engine.Security
import app.pars.engine.Str
import kotlin.math.abs

/** سوئیچر تب‌ها: کارت‌های سه‌بعدی با چرخش و مقیاس بر اساس فاصله از مرکز. */
@Composable
fun TabSwitcher(b: Browser, onClose: () -> Unit) {
    val start = b.tabs.indexOfFirst { it.id == b.activeId }.coerceAtLeast(0)
    val pager = rememberPagerState(initialPage = start) { b.tabs.size }
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(C.Bg.copy(alpha = .97f), C.Surface.copy(alpha = .985f))))) {
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding(), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("${b.tabs.size} تب", color = C.Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 18.dp), fontFamily = F.Mono)
            HorizontalPager(pager, Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(horizontal = 56.dp), pageSpacing = 8.dp) { page ->
                val tab = b.tabs.getOrNull(page) ?: return@HorizontalPager
                val off = (pager.currentPage - page) + pager.currentPageOffsetFraction
                val accent = if (tab.priv) C.Cyan else C.Magenta
                Column(
                    Modifier.fillMaxWidth().padding(vertical = 28.dp).graphicsLayer {
                        val a = abs(off).coerceIn(0f, 1f)
                        scaleX = 1f - .14f * a; scaleY = 1f - .14f * a; alpha = 1f - .45f * a
                        rotationY = off * -28f; cameraDistance = 14f * density
                    }.clip(Rd(26f)).background(C.Surface2).border(1.5.dp, if (page == pager.currentPage) accent.copy(alpha = .8f) else C.Line, Rd(26f))
                        .clickable { b.select(tab.id); onClose() },
                ) {
                    Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 8.dp, bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        if (tab.priv) { Glyph(G.Mask, C.Cyan, 18.dp); Spacer(Modifier.width(6.dp)) }
                        Text(tab.title.ifBlank { Security.hostOf(tab.url).ifBlank { if (tab.priv) Str.privateTab else Str.newTab } }, color = C.Text, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                        Box(Modifier.size(36.dp).clip(CircleShape).clickable { b.closeTab(tab.id) }, contentAlignment = Alignment.Center) { Glyph(G.Close, C.Muted, 18.dp) }
                    }
                    Box(Modifier.fillMaxWidth().weight(1f).background(C.Bg), contentAlignment = Alignment.Center) {
                        val th = tab.thumb
                        if (th != null && tab.id == b.activeId) Image(th, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop, alignment = Alignment.TopCenter)
                        else Text(if (tab.isBlank) "PARS" else Security.hostOf(tab.url).take(1).uppercase(), color = accent.copy(alpha = .55f), fontFamily = F.Display, fontSize = 64.sp)
                    }
                }
            }
            Row(Modifier.padding(bottom = 16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
                Pill(G.Mask, Str.privateTab, C.Cyan) { b.newTab(priv = true); onClose() }
                Pill(G.Plus, Str.newTab, C.Magenta, filled = true) { b.newTab(); onClose() }
                Pill(G.Check, Str.done, C.Mint) { onClose() }
            }
        }
    }
}

@Composable
private fun Pill(icon: String, label: String, color: androidx.compose.ui.graphics.Color, filled: Boolean = false, onClick: () -> Unit) {
    Row(
        Modifier.clip(CircleShape).background(if (filled) color else color.copy(alpha = .12f)).border(1.dp, color.copy(alpha = .5f), CircleShape).clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Glyph(icon, if (filled) C.Bg else color, 18.dp)
        Text(label, color = if (filled) C.Bg else color, fontSize = 13.sp, maxLines = 1)
    }
}

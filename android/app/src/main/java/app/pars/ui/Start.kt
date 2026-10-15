package app.pars.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pars.engine.Bookmark
import app.pars.engine.Str
import kotlinx.coroutines.delay

/** صفحه‌ی شروع: ذرات → حلقه → شاک‌ویو → لوگو حرف‌به‌حرف → نوار جستجو از پایین بالا می‌آید. */
@Composable
fun StartScreen(
    isPrivate: Boolean, bookmarks: List<Bookmark>, blockedTotal: Int,
    onSearch: () -> Unit, onOpen: (String) -> Unit, modifier: Modifier = Modifier, padTop: androidx.compose.ui.unit.Dp = 0.dp, padBottom: androidx.compose.ui.unit.Dp = 0.dp,
) {
    var pulse by remember { mutableIntStateOf(0) }
    val accent = if (isPrivate) C.Cyan else C.Magenta
    Box(modifier.fillMaxSize().background(C.Bg).pointerInput(Unit) { detectTapGestures { pulse++ } }) {
        ParticleField(pulse = pulse, accent = accent, calm = !Look.particles)
        Column(Modifier.fillMaxSize().padding(top = padTop, bottom = padBottom).padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Spacer(Modifier.weight(.13f))
            Wordmark(if (isPrivate) "MASK" else Look.wordmark, accent)
            Spacer(Modifier.height(10.dp))
            Rise(delayMs = 2000) {
                Text(if (isPrivate) Str.privateTagline else Str.tagline, color = C.Muted, fontSize = 14.sp, textAlign = TextAlign.Center)
            }
            Spacer(Modifier.weight(.42f))
            Rise(delayMs = 2200) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Chip(Str.httpsOnly, C.Mint); Chip("${Str.blocked} ${blockedTotal.toString()}", C.Cyan); Chip(Str.extensions, C.Magenta)
                }
            }
            Spacer(Modifier.height(18.dp))
            if (!isPrivate && bookmarks.isNotEmpty()) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally)) {
                    bookmarks.take(4).forEachIndexed { i, b -> Rise(delayMs = 2400 + i * 90) { Tile(b) { onOpen(b.url) } } }
                }
                Spacer(Modifier.height(18.dp))
            }
            Rise(delayMs = 2300, fromY = 90f) {
                Row(
                    Modifier.fillMaxWidth().height(56.dp).clip(Rd(28f)).background(C.Surface)
                        .border(1.dp, C.Line, Rd(28f)).clickable(onClick = onSearch).padding(horizontal = 20.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Glyph(G.Search, accent, 22.dp)
                    Text(Str.searchHint, color = C.Muted, fontSize = 15.sp, modifier = Modifier.weight(1f))
                }
            }
            Spacer(Modifier.height(20.dp))
        }
    }
}

@Composable
private fun Wordmark(text: String, accent: androidx.compose.ui.graphics.Color) {
    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        text.forEachIndexed { i, ch ->
            var on by remember { mutableStateOf(false) }
            LaunchedEffect(Unit) { delay(1750L + i * 110L); on = true }
            val p by animateFloatAsState(if (on) 1f else 0f, spring(.55f, 120f), label = "ch$i")
            Text(
                ch.toString(), fontFamily = if (text.all { it.code < 128 }) F.Display else Look.font().family, fontSize = (54f * 4f / maxOf(4, text.length)).coerceAtLeast(24f).sp, fontWeight = FontWeight.Bold,
                style = TextStyle(brush = if (accent == C.Cyan) C.Aurora else C.Neon),
                modifier = Modifier.graphicsLayer { translationY = (1f - p) * 90f; alpha = p.coerceIn(0f, 1f); scaleX = .7f + .3f * p; scaleY = .7f + .3f * p; rotationZ = (1f - p) * -14f },
            )
        }
    }
}

@Composable
fun Rise(delayMs: Int, fromY: Float = 40f, content: @Composable () -> Unit) {
    var on by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { delay(delayMs.toLong()); on = true }
    val p by animateFloatAsState(if (on) 1f else 0f, spring(.7f, 160f), label = "rise")
    Box(Modifier.graphicsLayer { translationY = (1f - p) * fromY; alpha = p.coerceIn(0f, 1f) }) { content() }
}

@Composable
private fun Chip(label: String, color: androidx.compose.ui.graphics.Color) {
    val inf = rememberInfiniteTransition(label = "dot")
    val a by inf.animateFloat(.35f, 1f, infiniteRepeatable(tween(1100), RepeatMode.Reverse), label = "a")
    Row(
        Modifier.clip(CircleShape).background(color.copy(alpha = .10f)).border(1.dp, color.copy(alpha = .35f), CircleShape).padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(Modifier.size(6.dp).alpha(a).background(color, CircleShape))
        Text(label, color = color, fontSize = 11.sp, maxLines = 1)
    }
}

@Composable
private fun Tile(b: Bookmark, onClick: () -> Unit) {
    Column(Modifier.width(72.dp).clip(Rd(16f)).clickable(onClick = onClick).padding(6.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(Modifier.size(48.dp).clip(Rd(15f)).background(C.Surface2).border(1.dp, C.Line, Rd(15f)), contentAlignment = Alignment.Center) {
            Text((b.title.firstOrNull() ?: '•').uppercase(), fontFamily = F.Display, color = C.Magenta, fontSize = 18.sp)
        }
        Text(b.title, color = C.Muted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

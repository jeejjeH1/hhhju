package app.pars.ui

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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import app.pars.engine.Browser
import app.pars.engine.Security
import app.pars.engine.Str
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.GeckoView

/** همه‌ی پرسش‌های امنیتی (مجوز سایت، نصب اکستنشن، دانلود خطرناک) با یک کارت شناور. */
@Composable
fun Dialogs(b: Browser) {
    val perm = b.permRequest
    val inst = b.installRequest
    val dl = b.downloadRequest
    val show = perm != null || inst != null || dl != null
    AnimatedVisibility(show, enter = fadeIn(tween(150)), exit = fadeOut(tween(150))) {
        Box(Modifier.fillMaxSize().background(Color(0xB0000000)).clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}, contentAlignment = Alignment.Center) {
            val accent = if (inst != null) C.Violet else if (dl != null) C.Amber else C.Cyan
            val pulse by rememberInfiniteTransition(label = "p").animateFloat(1f, 1.18f, infiniteRepeatable(tween(1100), RepeatMode.Reverse), label = "ps")
            Column(
                Modifier.padding(24.dp).fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(C.Surface).border(1.5.dp, accent.copy(alpha = .6f), RoundedCornerShape(28.dp)).padding(22.dp),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Box(Modifier.size(64.dp).graphicsLayer { scaleX = pulse; scaleY = pulse }.clip(CircleShape).background(accent.copy(alpha = .14f)), contentAlignment = Alignment.Center) {
                    Glyph(if (inst != null) G.Puzzle else if (dl != null) G.Download else G.Shield, accent, 32.dp)
                }
                when {
                    perm != null -> {
                        Text(Security.hostOf(perm.origin).ifEmpty { perm.origin }, color = C.Text, fontFamily = F.Mono, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                        Text("می‌خواهد به «${Str.permLabel(perm.kind)}» دسترسی داشته باشد.", color = C.Muted, fontSize = 14.sp)
                        Buttons(Str.deny, Str.allow, accent, { perm.answer(false) }, { perm.answer(true) })
                    }
                    inst != null -> {
                        Text("نصب «${inst.name}»؟", color = C.Text, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        val all = inst.origins.any { it == "<all_urls>" || it.contains("*://*/*") }
                        val lines = buildList {
                            if (all) add("⚠️ ${Str.allSites}") else if (inst.origins.isNotEmpty()) add("دسترسی به ${inst.origins.size} سایت")
                            inst.perms.forEach { add(Str.extPerm(it)) }
                        }
                        Text(if (lines.isEmpty()) "مجوز ویژه‌ای نمی‌خواهد." else lines.joinToString("\n") { "• $it" }, color = C.Muted, fontSize = 13.sp)
                        Buttons(Str.cancel, Str.install, accent, { inst.answer(false) }, { inst.answer(true) })
                    }
                    dl != null -> {
                        Text(dl.name, color = C.Text, fontFamily = F.Mono, fontSize = 14.sp)
                        Text(if (dl.risky) "⚠️ این یک فایل اجرایی/نصبی است. فقط اگر به منبع اعتماد داری ادامه بده." else "این فایل دانلود شود؟", color = C.Muted, fontSize = 13.sp)
                        Buttons(Str.cancel, "دانلود", accent, { b.confirmDownload(false) }, { b.confirmDownload(true) })
                    }
                }
            }
        }
    }
}

@Composable
private fun Buttons(no: String, yes: String, accent: Color, onNo: () -> Unit, onYes: () -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(no, color = C.Text, fontSize = 14.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            modifier = Modifier.weight(1f).clip(CircleShape).background(C.Surface2).clickable(onClick = onNo).padding(vertical = 13.dp))
        Text(yes, color = C.Bg, fontSize = 14.sp, fontWeight = FontWeight.Bold, textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            modifier = Modifier.weight(1f).clip(CircleShape).background(accent).clickable(onClick = onYes).padding(vertical = 13.dp))
    }
}

/** پنجره‌ی پاپ‌آپ اکستنشن (یک GeckoView جدا) */
@Composable
fun ExtensionPopup(session: GeckoSession, onClose: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Color(0xB0000000)).clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onClose), contentAlignment = Alignment.Center) {
        Box(Modifier.padding(20.dp).fillMaxWidth().height(480.dp).clip(RoundedCornerShape(24.dp)).background(C.Surface).border(1.dp, C.Violet.copy(alpha = .6f), RoundedCornerShape(24.dp)).clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}) {
            AndroidView({ ctx -> GeckoView(ctx).also { it.setSession(session) } }, Modifier.fillMaxSize())
        }
    }
}

package app.pars.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pars.engine.*
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.*

private fun kindColor(k: Int): Color = when (k) {
    RadarModel.AD -> C.Red; RadarModel.ANALYTIC -> C.Amber; RadarModel.SOCIAL -> C.Cyan; RadarModel.CONTENT -> C.Violet
    RadarModel.CRYPTO -> C.Red; RadarModel.FINGERPRINT -> C.Magenta; else -> C.Muted
}

private fun ring(k: Int) = when (k) { RadarModel.CRYPTO, RadarModel.FINGERPRINT -> 0; RadarModel.AD -> 1; RadarModel.ANALYTIC -> 2; RadarModel.SOCIAL, RadarModel.CONTENT -> 3; else -> 3 }

private fun hash01(s: String): Float { var h = 17; for (c in s) h = h * 31 + c.code; return ((h and 0x7fffffff) % 10000) / 10000f }

/**
 * «رادار حریم خصوصی»: سایت وسط، ردیاب‌ها دورش. یک اسکنر می‌چرخد و هر گره‌ای را که رد می‌کند روشن می‌کند؛
 * گره‌ی مسدودشده با انفجار می‌رسد و با ضربدر می‌ماند، گره‌ی مجاز با حلقه‌ی هشدار.
 */
@Composable
fun RadarScreen(b: Browser, onClose: () -> Unit) {
    val tab = b.active ?: return
    var nodes by remember { mutableStateOf(emptyList<RadarNode>()) }
    var week by remember { mutableStateOf(List(7) { 0 }) }
    var total by remember { mutableIntStateOf(0) }
    var selected by remember { mutableStateOf<String?>(null) }
    val ctl = b.runtime.contentBlockingController

    // لاگ مسدودسازی همین صفحه را زنده می‌خوانیم
    LaunchedEffect(tab.id) {
        while (true) {
            ctl.getLog(tab.session).accept({ l ->
                val raw = (l ?: emptyList()).flatMap { e -> e.blockingData.map { RawBlock(e.origin, it.category, it.blocked, it.count) } }
                nodes = RadarModel.build(raw, Security.hostOf(tab.url))
            }, { })
            delay(1400)
        }
    }
    LaunchedEffect(Unit) {
        val day = 24L * 3600 * 1000; val now = System.currentTimeMillis()
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val keys = (6 downTo 0).map { fmt.format(Date(now - it * day)) }
        ctl.getTrackingDbEventsByDateRange(now - 7 * day, now).accept({ ev ->
            val m = HashMap<String, Int>(); ev?.forEach { m[it.date.take(10)] = (m[it.date.take(10)] ?: 0) + it.count }
            week = keys.map { m[it] ?: 0 }
        }, { })
        ctl.sumAllTrackingDbEvents().accept({ total = it ?: 0 }, { })
    }

    val score = RadarModel.score(nodes, tab.secure)
    val scoreAnim by animateFloatAsState(score / 100f, tween(900, easing = FastOutSlowInEasing), label = "score")
    val gradeColor = when { score >= 80 -> C.Mint; score >= 50 -> C.Amber; else -> C.Red }
    val blockedSum = nodes.sumOf { it.blocked }; val allowedSum = nodes.sumOf { it.allowed }

    Column(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(C.Bg, C.Surface))).statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(40.dp).clip(CircleShape).clickable(onClick = onClose), contentAlignment = Alignment.Center) { Glyph(G.Close, C.Muted, 22.dp) }
            Column(Modifier.weight(1f).padding(horizontal = 8.dp)) {
                Text("رادار حریم خصوصی", color = C.Text, fontSize = 17.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                Text(Security.hostOf(tab.url).ifEmpty { "—" }, color = C.Muted, fontSize = 12.sp, fontFamily = F.Mono, style = TextStyle(textDirection = TextDirection.Ltr))
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(Modifier.size(64.dp), contentAlignment = Alignment.Center) {
                    androidx.compose.foundation.Canvas(Modifier.fillMaxSize()) {
                        drawCircle(C.Line, size.minDimension / 2 - 4.dp.toPx(), style = Stroke(6.dp.toPx()))
                        drawArc(gradeColor, -90f, 360f * scoreAnim, false, topLeft = Offset(4.dp.toPx(), 4.dp.toPx()), size = androidx.compose.ui.geometry.Size(size.width - 8.dp.toPx(), size.height - 8.dp.toPx()), style = Stroke(6.dp.toPx(), cap = StrokeCap.Round))
                    }
                    Text(RadarModel.grade(score), color = gradeColor, fontSize = 20.sp, fontFamily = F.Display)
                }
                Text(RadarModel.verdict(score), color = gradeColor, fontSize = 11.sp)
            }
        }

        RadarCanvas(nodes, selected, tab.secure, gradeColor, Modifier.weight(1f).fillMaxWidth()) { selected = it }

        // کارت جزئیات یا خلاصه
        val sel = nodes.firstOrNull { it.host == selected }
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp).clip(Rd(20f)).background(C.Surface2).border(1.dp, C.Line, Rd(20f)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (sel != null) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.size(12.dp).clip(CircleShape).background(kindColor(sel.kind)))
                    Text(sel.host, color = C.Text, fontSize = 14.sp, fontFamily = F.Mono, modifier = Modifier.weight(1f), style = TextStyle(textDirection = TextDirection.Ltr), maxLines = 1)
                    Text(RadarModel.label(sel.kind), color = kindColor(sel.kind), fontSize = 12.sp)
                }
                Text(RadarModel.describe(sel.kind), color = C.Muted, fontSize = 12.sp)
                Text(buildString {
                    if (sel.blocked > 0) append("🛡️ ${sel.blocked} درخواست مسدود شد")
                    if (sel.blocked > 0 && sel.allowed > 0) append("   ")
                    if (sel.allowed > 0) append("⚠️ ${sel.allowed} درخواست اجازه یافت")
                }, color = C.Text, fontSize = 13.sp)
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                    Stat("مسدود", blockedSum.toString(), C.Mint); Stat("نشت‌کرده", allowedSum.toString(), if (allowedSum > 0) C.Amber else C.Muted)
                    Stat("ردیاب", nodes.size.toString(), C.Cyan); Stat("کل زمان‌ها", total.toString(), C.Magenta)
                }
                if (nodes.isEmpty()) Text("هنوز ردیابی دیده نشده؛ صفحه را کمی بچرخان یا بگذار کامل بارگذاری شود.", color = C.Muted, fontSize = 12.sp)
                else Text("روی هر گره بزن تا جزئیاتش را ببینی.", color = C.Muted, fontSize = 12.sp)
                WeekBars(week)
            }
        }
    }
}

@Composable
private fun Stat(label: String, value: String, color: Color) {
    Column {
        Text(value, color = color, fontSize = 20.sp, fontFamily = F.Mono)
        Text(label, color = C.Muted, fontSize = 11.sp)
    }
}

@Composable
private fun WeekBars(week: List<Int>) {
    val mx = (week.maxOrNull() ?: 0).coerceAtLeast(1)
    Row(Modifier.fillMaxWidth().height(46.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Bottom) {
        week.forEachIndexed { i, v ->
            val h by animateFloatAsState(v / mx.toFloat(), tween(700, delayMillis = i * 60), label = "w$i")
            Box(Modifier.weight(1f).fillMaxHeight(), contentAlignment = Alignment.BottomCenter) {
                Box(Modifier.fillMaxWidth().fillMaxHeight(h.coerceAtLeast(.06f)).clip(Rd(6f)).background(if (i == 6) C.Neon else Brush.verticalGradient(listOf(C.Line, C.Line))))
            }
        }
    }
    Text("۷ روز گذشته", color = C.Muted, fontSize = 10.sp)
}

@Composable
private fun RadarCanvas(nodes: List<RadarNode>, selected: String?, secure: Boolean, centerColor: Color, modifier: Modifier, onSelect: (String?) -> Unit) {
    val measurer = rememberTextMeasurer()
    var t by remember { mutableFloatStateOf(0f) }
    val born = remember { HashMap<String, Float>() }       // زمان تولد هر گره (برای انیمیشن ورود)
    LaunchedEffect(Unit) {
        var start = 0L
        while (true) withInfiniteAnimationFrameNanos { n -> if (start == 0L) start = n; t = (n - start) / 1e9f }
    }
    val pos = remember { HashMap<String, Offset>() }
    Canvas(modifier.pointerInput(nodes) {
        detectTapGestures { p ->
            val hit = pos.entries.minByOrNull { (it.value - p).getDistance() }?.takeIf { (it.value - p).getDistance() < 44.dp.toPx() }
            onSelect(if (hit?.key == selected) null else hit?.key)
        }
    }) {
        val c = Offset(size.width / 2, size.height / 2)
        val maxR = min(size.width, size.height) / 2 - 22.dp.toPx()
        val radii = listOf(.34f, .55f, .76f, .96f).map { it * maxR }
        // حلقه‌ها
        radii.forEachIndexed { i, r -> drawCircle(C.Line.copy(alpha = .55f), r, c, style = Stroke(1.dp.toPx(), pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(6f, 10f), t * 14f * (i + 1)))) }
        // اسکنر
        val sweep = (t * 70f) % 360f
        // sweepGradient از زاویه‌ی 0 شروع می‌شود؛ با چرخش بوم آن را به زاویه‌ی اسکنر می‌بریم
        androidx.compose.ui.graphics.drawscope.rotate(sweep, c) {
            drawCircle(Brush.sweepGradient(0f to Color.Transparent, .84f to Color.Transparent, 1f to centerColor.copy(alpha = .38f), center = c), maxR, c)
            drawLine(centerColor.copy(alpha = .7f), c, Offset(c.x + maxR, c.y), 2.dp.toPx())
        }
        pos.clear()
        nodes.forEach { n ->
            val first = born.getOrPut(n.host) { t }
            val age = t - first
            val k = (age / .7f).coerceIn(0f, 1f); val e = 1f - (1f - k).pow(3)
            val r = radii[ring(n.kind)] * (0.86f + 0.14f * hash01(n.host + "r"))
            val ang = hash01(n.host) * 6.2832f + t * (if (ring(n.kind) % 2 == 0) .06f else -.045f)
            val target = Offset(c.x + cos(ang) * r, c.y + sin(ang) * r)
            val from = Offset(c.x + cos(ang) * maxR * 1.35f, c.y + sin(ang) * maxR * 1.35f)       // از بیرون می‌آید
            val p = Offset(from.x + (target.x - from.x) * e, from.y + (target.y - from.y) * e)
            pos[n.host] = p
            val col = kindColor(n.kind)
            val rad = (6f + sqrt((n.blocked + n.allowed).toFloat()) * 2.2f).coerceAtMost(17f).dp.toPx() * (.4f + .6f * e)
            // برخورد: انفجار هنگام رسیدن
            if (age in .62f..1.5f) { val bk = (age - .62f) / .88f; drawCircle(col.copy(alpha = (1f - bk) * .8f), rad + bk * 46.dp.toPx(), p, style = Stroke(2.dp.toPx())) }
            val sel = n.host == selected
            // خط اتصال
            drawLine(col.copy(alpha = if (sel) .8f else .22f), c, p, if (sel) 2.dp.toPx() else 1.dp.toPx())
            // روشن شدن هنگام عبور اسکنر
            val a360 = (Math.toDegrees(atan2((p.y - c.y).toDouble(), (p.x - c.x).toDouble())).toFloat() + 360f) % 360f
            val d = ((sweep - a360 + 360f) % 360f); val flash = if (d < 40f) 1f - d / 40f else 0f
            drawCircle(col.copy(alpha = .18f + .5f * flash), rad * (2f + flash), p)
            if (n.allowed > 0 && n.blocked == 0) {
                drawCircle(col, rad, p, style = Stroke(2.dp.toPx()))                       // مجاز: حلقه‌ی توخالی هشدار
                drawCircle(C.Amber.copy(alpha = .5f + .4f * sin(t * 4f)), rad * 1.5f, p, style = Stroke(1.dp.toPx()))
            } else {
                drawCircle(col, rad, p)
                val x = rad * .45f                                                           // مسدود: ضربدر
                drawLine(C.Bg, Offset(p.x - x, p.y - x), Offset(p.x + x, p.y + x), 2.dp.toPx(), StrokeCap.Round)
                drawLine(C.Bg, Offset(p.x - x, p.y + x), Offset(p.x + x, p.y - x), 2.dp.toPx(), StrokeCap.Round)
            }
            if (sel || nodes.size <= 12) {
                val txt = n.host.removePrefix("www.").take(18)
                val lay = measurer.measure(txt, TextStyle(color = C.Text.copy(alpha = if (sel) 1f else .7f), fontSize = 10.sp, fontFamily = F.Mono))
                drawText(lay, topLeft = Offset((p.x - lay.size.width / 2f).coerceIn(2f, size.width - lay.size.width - 2f), p.y + rad + 3.dp.toPx()))
            }
        }
        // مرکز: سایت
        val pulse = 1f + .06f * sin(t * 2.2f)
        drawCircle(Brush.radialGradient(listOf(centerColor.copy(alpha = .45f), Color.Transparent), c, 54.dp.toPx() * pulse), 54.dp.toPx() * pulse, c)
        drawCircle(C.Surface2, 24.dp.toPx(), c); drawCircle(centerColor, 24.dp.toPx(), c, style = Stroke(3.dp.toPx()))
        val lay = measurer.measure(if (secure) "🔒" else "⚠", TextStyle(fontSize = 18.sp))
        drawText(lay, topLeft = Offset(c.x - lay.size.width / 2f, c.y - lay.size.height / 2f))
    }
}

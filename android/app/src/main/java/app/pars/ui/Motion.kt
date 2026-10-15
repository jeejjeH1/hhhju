package app.pars.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.unit.dp
import kotlin.math.*
import kotlin.random.Random

private fun easeInOut(x: Float): Float { val t = x.coerceIn(0f, 1f); return if (t < .5f) 4 * t * t * t else 1 - (-2 * t + 2).pow(3) / 2 }
private fun easeOut(x: Float): Float { val t = x.coerceIn(0f, 1f); return 1 - (1 - t).pow(3) }

/**
 * پس‌زمینه‌ی موشن‌گرافیکی: ذرات از هرجا جمع می‌شوند و حلقه‌ی مداری می‌سازند،
 * بعد یک شاک‌ویو منفجر می‌شود. با هر `pulse` جدید (یا لمس) دوباره شاک‌ویو می‌آید.
 */
@Composable
fun ParticleField(modifier: Modifier = Modifier, pulse: Int = 0, accent: Color = C.Magenta, calm: Boolean = false) {
    val n = 110
    val rnd = remember { Random(7) }
    val a0 = remember { FloatArray(n) { rnd.nextFloat() * 6.2831f } }
    val rr = remember { FloatArray(n) { .45f + rnd.nextFloat() * .95f } }
    val sx = remember { FloatArray(n) { rnd.nextFloat() } }
    val sy = remember { FloatArray(n) { rnd.nextFloat() } }
    val spd = remember { FloatArray(n) { (.12f + rnd.nextFloat() * .35f) * (if (rnd.nextBoolean()) 1 else -1) } }
    val col = remember { listOf(C.Magenta, C.Cyan, C.Violet, C.Mint, C.Magenta, C.Magenta) }
    val waves = remember { mutableStateListOf<Float>() }
    var t by remember { mutableFloatStateOf(0f) }
    var lastPulse by remember { mutableIntStateOf(pulse) }

    LaunchedEffect(Unit) {
        var start = 0L
        while (true) {
            withInfiniteAnimationFrameNanos { now ->
                if (start == 0L) start = now
                t = (now - start) / 1e9f
            }
        }
    }
    LaunchedEffect(Unit) { if (!calm) { snapshotFlow { t > 1.75f }.collect { if (it && waves.isEmpty()) waves.add(1.75f) } } }
    LaunchedEffect(pulse) { if (pulse != lastPulse) { lastPulse = pulse; waves.add(t) } }

    Canvas(modifier.fillMaxSize()) {
        val w = size.width; val h = size.height
        val c = Offset(w / 2f, h * .36f)
        val base = min(w, h) * .30f
        val intro = if (calm) 1f else easeInOut((t - .1f) / 1.5f)
        // هاله‌ی نفس‌کش
        val breath = 1f + .06f * sin(t * 1.6f)
        drawCircle(Brush.radialGradient(listOf(accent.copy(alpha = .34f * intro), Color.Transparent), center = c, radius = base * 2.1f * breath), radius = base * 2.1f * breath, center = c)
        val px = FloatArray(n); val py = FloatArray(n)
        for (i in 0 until n) {
            val ang = a0[i] + t * spd[i] * .6f
            val rad = base * rr[i] * (1f + .05f * sin(t * 1.3f + i))
            var ox = c.x + cos(ang) * rad
            var oy = c.y + sin(ang) * rad * .82f
            // فشار شاک‌ویوها روی ذرات
            for (b in waves) {
                val age = t - b; if (age < 0f || age > 2.2f) continue
                val r = age * w * .62f
                val d = hypot(ox - c.x, oy - c.y)
                val k = exp(-((d - r) / 46f).pow(2)) * (1f - age / 2.2f) * 34f
                if (d > 1f) { ox += (ox - c.x) / d * k; oy += (oy - c.y) / d * k }
            }
            px[i] = (sx[i] * w) + (ox - sx[i] * w) * intro
            py[i] = (sy[i] * h * .8f) + (oy - sy[i] * h * .8f) * intro
        }
        // خطوط صورت‌فلکی
        for (i in 0 until n) for (j in i + 1 until n) {
            val d = hypot(px[i] - px[j], py[i] - py[j])
            if (d < 86f) drawLine(accent.copy(alpha = (1f - d / 86f) * .22f * intro), Offset(px[i], py[i]), Offset(px[j], py[j]), strokeWidth = 1f)
        }
        for (i in 0 until n) {
            val s = (1.2f + (i % 4) * .7f) * (1f + .35f * sin(t * 2f + i))
            drawCircle(col[i % col.size].copy(alpha = (.35f + .5f * ((i % 5) / 5f)) * intro.coerceAtLeast(.25f)), s * 1.8f, Offset(px[i], py[i]))
        }
        // شاک‌ویو
        waves.removeAll { t - it > 2.4f }
        for (b in waves) {
            val age = t - b; if (age < 0f) continue
            val e = easeOut(age / 2.2f)
            val r = e * w * .62f
            val a = (1f - age / 2.2f).coerceIn(0f, 1f)
            drawCircle(Brush.sweepGradient(listOf(C.Cyan, C.Magenta, C.Violet, C.Cyan), c), r, c, alpha = a, style = Stroke(width = 3f + 10f * (1f - e)))
            drawCircle(accent.copy(alpha = a * .12f), r, c)
        }
    }
}

/** نور چرخان دور یک شکل وقتی `active` است (نشانگر بارگذاری). */
fun Modifier.sweepGlow(active: Boolean, progress: Float, radius: Float = 26f): Modifier = composed {
    val inf = rememberInfiniteTransition(label = "glow")
    val rot by inf.animateFloat(0f, 360f, infiniteRepeatable(tween(1600, easing = LinearEasing)), label = "rot")
    val alpha by animateFloatAsState(if (active) 1f else 0f, tween(300), label = "a")
    drawBehind {
        if (alpha <= 0.01f) return@drawBehind
        val stroke = 2.5.dp.toPx()
        rotate(rot, center) {
            drawRoundRect(
                Brush.sweepGradient(listOf(Color.Transparent, C.Cyan, C.Magenta, C.Violet, Color.Transparent), center),
                topLeft = Offset(-1f, -1f), size = Size(size.width + 2f, size.height + 2f), cornerRadius = CornerRadius(radius.dp.toPx()),
                alpha = alpha, style = Stroke(stroke),
            )
        }
    }
}

/** خط پیشرفت نئونی زیر نوار آدرس */
fun Modifier.progressLine(progress: Float): Modifier = drawBehind {
    if (progress in 0.001f..0.999f) {
        val w = size.width * progress
        drawRect(C.Neon, topLeft = Offset(0f, size.height - 3.dp.toPx()), size = Size(w, 3.dp.toPx()))
        drawCircle(Brush.radialGradient(listOf(C.Magenta, Color.Transparent), Offset(w, size.height), 24.dp.toPx()), 24.dp.toPx(), Offset(w, size.height))
    }
}

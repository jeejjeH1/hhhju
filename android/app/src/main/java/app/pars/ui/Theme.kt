package app.pars.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import app.pars.R

/** پالت دقیقاً از موشن‌گرافیک پروژه: مشکی عمیق + سرخابی نئون + سایان/بنفش/نعنایی */
object C {
    val Bg = Color(0xFF07060D)
    val Surface = Color(0xFF110F1C)
    val Surface2 = Color(0xFF1A1729)
    val Line = Color(0xFF2A2540)
    val Text = Color(0xFFF4EFFF)
    val Muted = Color(0xFF8E87A8)
    val Magenta = Color(0xFFFF87FF)
    val Violet = Color(0xFFDC00FF)
    val Cyan = Color(0xFF5CF2FF)
    val Mint = Color(0xFF6DFFB8)
    val Red = Color(0xFFFF2E63)
    val Amber = Color(0xFFFFB300)
    val Neon = Brush.linearGradient(listOf(Magenta, Violet))
    val Aurora = Brush.linearGradient(listOf(Cyan, Magenta, Violet))
}

object F {
    val Display = FontFamily(Font(R.font.unbounded_700, FontWeight.Bold))
    val Mono = FontFamily(Font(R.font.jbm_500, FontWeight.Medium))
    val Latin = FontFamily(Font(R.font.sg_700, FontWeight.Bold))
}

val BodyStyle = TextStyle(color = C.Text, fontSize = 15.sp)

@Composable
fun ParsTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = C.Magenta, onPrimary = C.Bg, secondary = C.Cyan, background = C.Bg, surface = C.Surface,
            onSurface = C.Text, onBackground = C.Text, surfaceVariant = C.Surface2, outline = C.Line, error = C.Red,
        ),
        content = content,
    )
}

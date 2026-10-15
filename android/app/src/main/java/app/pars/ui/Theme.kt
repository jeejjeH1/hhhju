package app.pars.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import app.pars.R

object F {
    val Display = FontFamily(Font(R.font.unbounded_700, FontWeight.Bold))
    val Mono = FontFamily(Font(R.font.jbm_500, FontWeight.Medium))
    val Latin = FontFamily(Font(R.font.sg_700, FontWeight.Bold))
}

val BodyStyle = TextStyle(color = C.Text, fontSize = 15.sp)

@Composable
fun ParsTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = (if (C.isDark) darkColorScheme() else androidx.compose.material3.lightColorScheme()).copy(
            primary = C.Magenta, onPrimary = C.Bg, secondary = C.Cyan, background = C.Bg, surface = C.Surface,
            onSurface = C.Text, onBackground = C.Text, surfaceVariant = C.Surface2, outline = C.Line, error = C.Red,
        ),
        content = { androidx.compose.material3.ProvideTextStyle(TextStyle(fontFamily = Look.font().family), content) },
    )
}

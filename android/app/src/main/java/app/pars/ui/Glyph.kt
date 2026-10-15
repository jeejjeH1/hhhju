package app.pars.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** آیکون‌های خطی ۲۴×۲۴ — بدون وابستگی به کتابخانه‌ی آیکون. */
object G {
    const val Back = "M5 12h14M13 6l6 6-6 6"            // در RTL «عقب» به راست اشاره می‌کند
    const val Forward = "M19 12H5M11 6l-6 6 6 6"
    const val Reload = "M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5"
    const val Close = "M6 6l12 12M18 6L6 18"
    const val Plus = "M12 5v14M5 12h14"
    const val Lock = "M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3"
    const val Warn = "M12 4l9 16H3zM12 10v4M12 17v.01"
    const val Search = "M11 5a6 6 0 1 0 0 12 6 6 0 1 0 0-12zM20 20l-4-4"
    const val Star = "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"
    const val Menu = "M4 7h16M4 12h16M4 17h16"
    const val Puzzle = "M10 4h4v3a2 2 0 1 0 0 4h3v4h-3a2 2 0 1 0-4 0H7v-4a2 2 0 1 1 0-4h3z"
    const val Shield = "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"
    const val Mask = "M3 8c3-2 6-2 9 0 3-2 6-2 9 0v4c0 4-3 7-6 7-1.5 0-2.2-1-3-1s-1.5 1-3 1c-3 0-6-3-6-7zM8 12h.01M16 12h.01"
    const val Clock = "M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM12 7v5l3 2"
    const val Download = "M12 4v11M7 11l5 5 5-5M5 20h14"
    const val Gear = "M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"
    const val Trash = "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"
    const val Tabs = "M5 6h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"
    const val Find = "M10 4a6 6 0 1 0 0 12 6 6 0 1 0 0-12zM20 20l-5.5-5.5"
    const val Check = "M5 12l5 5L20 7"
}

@Composable
fun Glyph(path: String, tint: Color, size: Dp = 24.dp, stroke: Float = 1.8f, modifier: Modifier = Modifier) {
    val p = remember(path) { PathParser().parsePathString(path).toPath() }
    Canvas(modifier.size(size)) {
        scale(this.size.width / 24f, pivot = Offset.Zero) {
            drawPath(p, tint, style = Stroke(width = stroke, cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
    }
}

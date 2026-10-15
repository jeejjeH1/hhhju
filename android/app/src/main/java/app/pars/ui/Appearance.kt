package app.pars.ui

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pars.engine.Browser

/** پنل «ظاهر و شخصی‌سازی»: تم، رنگ تأکید، فونت، اندازه‌ها و چیدمان. هر تغییر فوراً اعمال و ذخیره می‌شود. */
@Composable
fun AppearancePanel(b: Browser, go: (Panel) -> Unit) {
    fun save() = Look.save(b.store)
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.size(36.dp).clip(CircleShape).clickable { go(Panel.Menu) }, contentAlignment = Alignment.Center) { Glyph(G.Back, C.Muted, 22.dp) }
        Text("ظاهر و شخصی‌سازی", color = C.Text, fontSize = 17.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, modifier = Modifier.weight(1f))
        Text("بازنشانی", color = C.Red, fontSize = 12.sp, modifier = Modifier.clip(CircleShape).clickable { Look.reset(); save(); b.applyWebLook(Look.webTextScale, Look.webScheme) }.padding(horizontal = 12.dp, vertical = 6.dp))
    }
    Column(Modifier.heightIn(max = 540.dp).verticalScroll(rememberScrollState()).padding(bottom = 16.dp)) {
        Section("تم (${Palettes.all.size})")
        Palettes.all.chunked(3).forEach { row ->
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { p -> ThemeCard(p, Look.themeId == p.id, Modifier.weight(1f)) { Look.themeId = p.id; Look.refresh(); save() } }
                repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }

        Section("رنگ تأکید")
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("پیش‌فرض تم", color = if (Look.accent == null) C.Bg else C.Text, fontSize = 12.sp,
                modifier = Modifier.clip(CircleShape).background(if (Look.accent == null) C.Magenta else C.Surface2).clickable { Look.accent = null; Look.refresh(); save() }.padding(horizontal = 12.dp, vertical = 8.dp))
            Palettes.accents.forEach { c ->
                val sel = Look.accent == c
                Box(Modifier.size(34.dp).clip(CircleShape).background(Color(c)).border(if (sel) 3.dp else 1.dp, if (sel) C.Text else C.Line, CircleShape).clickable { Look.accent = c; Look.refresh(); save() })
            }
        }

        Section("فونت (${Fonts.all.size})")
        Column(Modifier.heightIn(max = 250.dp).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Fonts.all.forEach { f ->
                val sel = Look.fontId == f.id
                Row(
                    Modifier.fillMaxWidth().clip(Rd(14f)).background(if (sel) C.Magenta.copy(alpha = .16f) else C.Surface2).border(1.dp, if (sel) C.Magenta else C.Line, Rd(14f))
                        .clickable { Look.fontId = f.id; save() }.padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("پارس، مرورگر امن ۱۲۳", color = C.Text, fontSize = 16.sp, fontFamily = f.family, modifier = Modifier.weight(1f), maxLines = 1)
                    Text(f.name, color = if (sel) C.Magenta else C.Muted, fontSize = 11.sp, maxLines = 1)
                }
            }
        }

        Section("اندازه‌ها")
        SliderRow("اندازه‌ی متن رابط", Look.textScale, .7f..1.8f, "${(Look.textScale * 100).toInt()}٪", { Look.textScale = it }, ::save)
        SliderRow("اندازه‌ی عناصر رابط (دکمه‌ها و نوارها)", Look.uiScale, .75f..1.4f, "${(Look.uiScale * 100).toInt()}٪", { Look.uiScale = it }, ::save)
        SliderRow("گردی گوشه‌ها", Look.round, 0f..1.8f, if (Look.round < .05f) "تیز" else "${(Look.round * 100).toInt()}٪", { Look.round = it }, ::save)
        SliderRow("اندازه‌ی متن صفحات وب", Look.webTextScale, .5f..2f, "${(Look.webTextScale * 100).toInt()}٪", { Look.webTextScale = it }, { save(); b.applyWebLook(Look.webTextScale, Look.webScheme) })

        Section("چیدمان و صفحه‌ی شروع")
        Switch("نوار آدرس در بالا", "پیش‌فرض: پایین صفحه (راحت‌تر برای شست)", Look.barTop) { Look.barTop = it; save() }
        Switch("ذرات و شاک‌ویو در صفحه‌ی شروع", "خاموش = پس‌زمینه‌ی ساده و کم‌مصرف‌تر", Look.particles) { Look.particles = it; save() }
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("نوشته‌ی صفحه‌ی شروع", color = C.Text, fontSize = 14.sp, modifier = Modifier.weight(1f))
            BasicTextField(
                Look.wordmark, { Look.wordmark = it.take(14); save() }, Modifier.width(130.dp).clip(Rd(12f)).background(C.Surface2).border(1.dp, C.Line, Rd(12f)).padding(10.dp), singleLine = true,
                textStyle = TextStyle(color = C.Text, fontSize = 14.sp, textAlign = TextAlign.Center), cursorBrush = SolidColor(C.Magenta),
            )
        }

        Section("ظاهر وب‌سایت‌ها")
        Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("system" to "مطابق سیستم", "light" to "روشن", "dark" to "تیره").forEach { (k, label) ->
                val sel = Look.webScheme == k
                Text(label, color = if (sel) C.Bg else C.Text, fontSize = 12.sp, modifier = Modifier.clip(CircleShape).background(if (sel) C.Magenta else C.Surface2).clickable { Look.webScheme = k; save(); b.applyWebLook(Look.webTextScale, k) }.padding(horizontal = 14.dp, vertical = 8.dp))
            }
        }
    }
}

@Composable private fun Section(t: String) = Text(t, color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(start = 20.dp, top = 16.dp, bottom = 8.dp))

@Composable
private fun ThemeCard(p: Palette, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Column(
        modifier.clip(Rd(14f)).background(Brush.verticalGradient(listOf(Color(p.bg), Color(p.surface2)))).border(if (selected) 2.dp else 1.dp, if (selected) Color(p.a1) else Color(p.line), Rd(14f))
            .clickable(onClick = onClick).padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            listOf(p.a1, p.a2, p.cyan, p.mint).forEach { Box(Modifier.size(14.dp).clip(CircleShape).background(Color(it))) }
        }
        Text(p.name, color = Color(p.text), fontSize = 12.sp, maxLines = 1)
    }
}

@Composable
private fun SliderRow(label: String, v: Float, range: ClosedFloatingPointRange<Float>, shown: String, onChange: (Float) -> Unit, onDone: () -> Unit) {
    Column(Modifier.padding(horizontal = 20.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(label, color = C.Text, fontSize = 13.sp, modifier = Modifier.weight(1f))
            Text(shown, color = C.Magenta, fontSize = 12.sp, fontFamily = F.Mono)
        }
        Slider(v, onChange, valueRange = range, onValueChangeFinished = onDone,
            colors = SliderDefaults.colors(thumbColor = C.Magenta, activeTrackColor = C.Magenta, inactiveTrackColor = C.Line))
    }
}

@Composable
private fun Switch(title: String, desc: String, on: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().clickable { onChange(!on) }.padding(horizontal = 20.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f)) { Text(title, color = C.Text, fontSize = 14.sp); Text(desc, color = C.Muted, fontSize = 11.sp) }
        Box(Modifier.size(46.dp, 26.dp).clip(CircleShape).background(if (on) C.Magenta else C.Line).padding(3.dp), contentAlignment = if (on) Alignment.CenterStart else Alignment.CenterEnd) {
            Box(Modifier.size(20.dp).clip(CircleShape).background(Color.White))
        }
    }
}

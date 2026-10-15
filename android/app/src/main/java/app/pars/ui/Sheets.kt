package app.pars.ui

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pars.engine.Browser
import app.pars.engine.Security
import app.pars.engine.Str
import kotlinx.coroutines.delay

@Composable
fun Sheets(b: Browser, panel: Panel, onPanel: (Panel) -> Unit) {
    AnimatedVisibility(panel != Panel.None, enter = fadeIn(tween(180)), exit = fadeOut(tween(160))) {
        Box(Modifier.fillMaxSize().background(Color(0xAA000000)).clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { onPanel(Panel.None) })
    }
    AnimatedVisibility(
        panel != Panel.None, Modifier.fillMaxSize(),
        enter = slideInVertically(spring(.8f, 320f)) { it } + fadeIn(), exit = slideOutVertically(tween(180)) { it } + fadeOut(),
    ) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
            Column(
                Modifier.fillMaxWidth().heightIn(max = 620.dp).clip(RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)).background(C.Surface)
                    .border(1.dp, C.Line, RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp))
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}.navigationBarsPadding().padding(bottom = 12.dp),
            ) {
                Box(Modifier.align(Alignment.CenterHorizontally).padding(top = 10.dp).size(40.dp, 4.dp).clip(CircleShape).background(C.Line))
                when (panel) {
                    Panel.Menu -> MenuPanel(b, onPanel)
                    Panel.Bookmarks -> BookmarksPanel(b, onPanel)
                    Panel.History -> HistoryPanel(b, onPanel)
                    Panel.Extensions -> ExtensionsPanel(b, onPanel)
                    Panel.Settings -> SettingsPanel(b, onPanel)
                    Panel.None -> {}
                }
            }
        }
    }
}

@Composable
private fun Header(title: String, onBack: (() -> Unit)?) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (onBack != null) Box(Modifier.size(36.dp).clip(CircleShape).clickable(onClick = onBack), contentAlignment = Alignment.Center) { Glyph(G.Back, C.Muted, 22.dp) }
        Text(title, color = C.Text, fontSize = 17.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun MenuPanel(b: Browser, go: (Panel) -> Unit) {
    val items = listOf(
        Triple(G.Mask, Str.privateTab, C.Cyan) to { b.newTab(priv = true); go(Panel.None) },
        Triple(G.Star, Str.bookmarks, C.Amber) to { go(Panel.Bookmarks) },
        Triple(G.Clock, Str.history, C.Magenta) to { go(Panel.History) },
        Triple(G.Puzzle, Str.extensions, C.Violet) to { go(Panel.Extensions) },
        Triple(G.Gear, Str.settings, C.Mint) to { go(Panel.Settings) },
        Triple(G.Plus, Str.newTab, C.Magenta) to { b.newTab(); go(Panel.None) },
    )
    Header("PARS", null)
    Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items.chunked(3).forEachIndexed { r, row ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEachIndexed { c, (meta, act) ->
                    val (icon, label, color) = meta
                    var on by remember { mutableStateOf(false) }
                    LaunchedEffect(Unit) { delay((r * 3 + c) * 55L); on = true }
                    val p by animateFloatAsState(if (on) 1f else 0f, spring(.55f, 380f), label = "m")
                    Column(
                        Modifier.weight(1f).graphicsLayer { scaleX = p; scaleY = p; alpha = p }.clip(RoundedCornerShape(20.dp)).background(color.copy(alpha = .10f)).border(1.dp, color.copy(alpha = .30f), RoundedCornerShape(20.dp))
                            .clickable { act() }.padding(vertical = 18.dp),
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Glyph(icon, color, 28.dp)
                        Text(label, color = C.Text, fontSize = 12.sp, maxLines = 1)
                    }
                }
            }
        }
    }
    Spacer(Modifier.height(8.dp))
}

@Composable
private fun Empty(text: String) = Text(text, color = C.Muted, fontSize = 13.sp, modifier = Modifier.fillMaxWidth().padding(32.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)

@Composable
private fun UrlRow(title: String, url: String, icon: String, trailing: (@Composable () -> Unit)? = null, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 20.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Glyph(icon, C.Magenta, 20.dp)
        Column(Modifier.weight(1f)) {
            Text(title, color = C.Text, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(url, color = C.Muted, fontSize = 11.sp, fontFamily = F.Mono, maxLines = 1, overflow = TextOverflow.Ellipsis, style = TextStyle(textDirection = TextDirection.Ltr))
        }
        trailing?.invoke()
    }
}

@Composable
private fun BookmarksPanel(b: Browser, go: (Panel) -> Unit) {
    Header(Str.bookmarks) { go(Panel.Menu) }
    val l = remember(b.version) { b.store.bookmarks() }
    if (l.isEmpty()) Empty(Str.noBookmarks)
    LazyColumn { items(l) { m -> UrlRow(m.title, m.url, G.Star, { Box(Modifier.size(32.dp).clip(CircleShape).clickable { b.store.toggleBookmark(m.url, m.title); b.version++ }, contentAlignment = Alignment.Center) { Glyph(G.Trash, C.Muted, 18.dp) } }) { b.go(m.url); go(Panel.None) } } }
}

@Composable
private fun HistoryPanel(b: Browser, go: (Panel) -> Unit) {
    Header(Str.history) { go(Panel.Menu) }
    val l = remember(b.version) { b.store.history().take(100) }
    TextButton(Str.clearHistory, C.Red) { b.store.clearHistory(); b.version++ }
    if (l.isEmpty()) Empty(Str.noHistory)
    LazyColumn { items(l) { m -> UrlRow(m.title, m.url, G.Clock) { b.go(m.url); go(Panel.None) } } }
}

@Composable
private fun TextButton(label: String, color: Color, onClick: () -> Unit) {
    Text(label, color = color, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp).clip(RoundedCornerShape(10.dp)).clickable(onClick = onClick).padding(8.dp))
}

@Composable
private fun ExtensionsPanel(b: Browser, go: (Panel) -> Unit) {
    var input by remember { mutableStateOf("") }
    Header(Str.extensions) { go(Panel.Menu) }
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp).height(48.dp).clip(RoundedCornerShape(24.dp)).background(C.Surface2).border(1.dp, C.Line, RoundedCornerShape(24.dp)).padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(Modifier.weight(1f)) {
            if (input.isEmpty()) Text(Str.installHint, color = C.Muted, fontSize = 12.sp)
            BasicTextField(input, { input = it }, Modifier.fillMaxWidth(), singleLine = true, textStyle = TextStyle(color = C.Text, fontSize = 14.sp, fontFamily = F.Mono, textDirection = TextDirection.Ltr),
                cursorBrush = SolidColor(C.Magenta), keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go, keyboardType = KeyboardType.Uri), keyboardActions = KeyboardActions(onGo = { b.installExtension(input) }))
        }
        Text(Str.install, color = C.Bg, fontSize = 13.sp, modifier = Modifier.clip(CircleShape).background(C.Neon).clickable { b.installExtension(input) }.padding(horizontal = 14.dp, vertical = 6.dp))
    }
    if (b.extStatus.isNotEmpty()) Text(b.extStatus, color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 24.dp, vertical = 6.dp))
    if (b.extensions.isEmpty()) Empty(Str.noExt)
    LazyColumn(Modifier.heightIn(max = 340.dp)) {
        items(b.extensions) { e ->
            Row(Modifier.fillMaxWidth().clickable { b.clickExtension(e) }.padding(horizontal = 20.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Glyph(G.Puzzle, C.Violet, 24.dp)
                Column(Modifier.weight(1f)) {
                    Text(e.name, color = C.Text, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("v${e.version} · ${e.description}", color = C.Muted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Box(Modifier.size(36.dp).clip(CircleShape).clickable { b.removeExtension(e) }, contentAlignment = Alignment.Center) { Glyph(G.Trash, C.Muted, 20.dp) }
            }
        }
    }
    Text(Str.extWarn, color = C.Muted, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp))
}

@Composable
private fun Toggle(title: String, desc: String, on: Boolean, onChange: (Boolean) -> Unit) {
    val x by animateFloatAsState(if (on) 1f else 0f, spring(.6f, 500f), label = "tg")
    Row(Modifier.fillMaxWidth().clickable { onChange(!on) }.padding(horizontal = 20.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f)) { Text(title, color = C.Text, fontSize = 14.sp); Text(desc, color = C.Muted, fontSize = 11.sp) }
        Box(Modifier.size(46.dp, 26.dp).clip(CircleShape).background(if (on) C.Neon else androidx.compose.ui.graphics.SolidColor(C.Line)).padding(3.dp)) {
            Box(Modifier.size(20.dp).graphicsLayer { translationX = -x * 20.dp.toPx() }.clip(CircleShape).background(Color.White))
        }
    }
}

@Composable
private fun SettingsPanel(b: Browser, go: (Panel) -> Unit) {
    Header(Str.settings) { go(Panel.Menu) }
    LazyColumn(Modifier.heightIn(max = 480.dp)) {
        item {
            val v = b.version
            Toggle(Str.httpsOnly, Str.httpsOnlyDesc, b.store.httpsOnly) { b.setHttpsOnly(it) }
            Toggle(Str.strictTracking, Str.strictTrackingDesc, b.store.strictTracking) { b.setStrict(it) }
            Toggle(Str.clearOnExit, Str.clearOnExitDesc, b.store.clearOnExit) { b.store.clearOnExit = it; b.version++ }
            Text(Str.searchEngine, color = C.Muted, fontSize = 12.sp, modifier = Modifier.padding(start = 20.dp, top = 12.dp, bottom = 6.dp))
            Row(Modifier.padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Security.searchEngines.keys.forEach { k ->
                    val sel = b.store.searchEngine == k
                    Text(k.replaceFirstChar { it.uppercase() }, color = if (sel) C.Bg else C.Text, fontSize = 12.sp, maxLines = 1,
                        modifier = Modifier.clip(CircleShape).background(if (sel) C.Magenta else C.Surface2).clickable { b.store.searchEngine = k; b.version++ }.padding(horizontal = 12.dp, vertical = 8.dp))
                }
            }
            Spacer(Modifier.height(8.dp))
            TextButton(Str.clearData, C.Red) { b.clearAll() }
            Text(Str.alwaysOn, color = C.Muted, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 24.dp, vertical = 8.dp), lineHeight = 18.sp)
            if (v < 0) Spacer(Modifier)
        }
    }
}

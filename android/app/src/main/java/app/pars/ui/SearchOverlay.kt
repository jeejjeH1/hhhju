package app.pars.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pars.engine.Browser
import app.pars.engine.Str
import kotlinx.coroutines.delay

/** جستجوی تمام‌صفحه: از نوار پایین باز می‌شود، پیشنهادها (نشان‌ها + تاریخچه) با تأخیر پله‌ای می‌آیند. */
@Composable
fun SearchOverlay(b: Browser, onClose: () -> Unit) {
    val cur = b.active
    var tf by remember { mutableStateOf(TextFieldValue(if (cur?.isBlank == false) cur.url else "", TextRange(0, if (cur?.isBlank == false) cur.url.length else 0))) }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { delay(80); focus.requestFocus() }
    val q = tf.text.trim().lowercase()
    val items = remember(q, b.version) {
        if (q.isEmpty()) b.store.bookmarks().map { it.title to it.url }.take(6)
        else (b.store.bookmarks().map { it.title to it.url } + b.store.history().map { it.title to it.url })
            .filter { (t, u) -> t.lowercase().contains(q) || u.lowercase().contains(q) }.distinctBy { it.second }.take(8)
    }
    fun submit(s: String) { b.go(s); onClose() }

    Box(
        Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(C.Bg.copy(alpha = .98f), C.Surface.copy(alpha = .98f))))
            .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onClose),
    ) {
        Column(Modifier.fillMaxSize().statusBarsPadding().imePadding().navigationBarsPadding().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            LazyColumn(Modifier.weight(1f), reverseLayout = true, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                items(items.size) { i ->
                    val (title, url) = items[i]
                    var on by remember { mutableStateOf(false) }
                    LaunchedEffect(Unit) { delay(i * 40L); on = true }
                    val p by animateFloatAsState(if (on) 1f else 0f, spring(.7f, 260f), label = "s$i")
                    Row(
                        Modifier.fillMaxWidth().graphicsLayer { alpha = p; translationY = (1 - p) * 40f }.clip(RoundedCornerShape(14.dp)).clickable { submit(url) }.padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Glyph(G.Clock, C.Magenta, 20.dp)
                        Column(Modifier.weight(1f)) {
                            Text(title, color = C.Text, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(url, color = C.Muted, fontSize = 11.sp, fontFamily = F.Mono, maxLines = 1, overflow = TextOverflow.Ellipsis, style = TextStyle(textDirection = TextDirection.Ltr))
                        }
                    }
                }
            }
            Row(
                Modifier.fillMaxWidth().height(56.dp).clip(RoundedCornerShape(28.dp)).background(C.Surface2).border(1.5.dp, Brush.linearGradient(listOf(C.Cyan, C.Magenta, C.Violet)), RoundedCornerShape(28.dp))
                    .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}.padding(horizontal = 18.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Glyph(G.Search, C.Magenta, 22.dp)
                Box(Modifier.weight(1f)) {
                    if (tf.text.isEmpty()) Text(Str.searchHint, color = C.Muted, fontSize = 16.sp)
                    BasicTextField(
                        tf, { tf = it }, Modifier.fillMaxWidth().focusRequester(focus), singleLine = true,
                        textStyle = TextStyle(color = C.Text, fontSize = 16.sp, fontFamily = F.Mono, textDirection = TextDirection.Content),
                        cursorBrush = SolidColor(C.Magenta),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go, keyboardType = KeyboardType.Uri),
                        keyboardActions = KeyboardActions(onGo = { submit(tf.text) }),
                    )
                }
                if (tf.text.isNotEmpty()) Box(Modifier.size(32.dp).clip(androidx.compose.foundation.shape.CircleShape).clickable { tf = TextFieldValue("") }, contentAlignment = Alignment.Center) { Glyph(G.Close, C.Muted, 18.dp) }
            }
        }
    }
}

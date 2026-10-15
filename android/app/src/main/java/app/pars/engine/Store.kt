package app.pars.engine

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class Bookmark(val url: String, val title: String)
data class HistoryItem(val url: String, val title: String, val time: Long)

/** تنظیمات/نشان‌ها/تاریخچه روی SharedPreferences (به‌صورت JSON). تب‌های خصوصی هرگز اینجا نوشته نمی‌شوند. */
class Store(ctx: Context) {
    private val p = ctx.getSharedPreferences("pars", Context.MODE_PRIVATE)

    var searchEngine: String
        get() = p.getString("engine", "duckduckgo") ?: "duckduckgo"
        set(v) = p.edit().putString("engine", v).apply()
    var httpsOnly: Boolean
        get() = p.getBoolean("https", true)
        set(v) = p.edit().putBoolean("https", v).apply()
    var strictTracking: Boolean
        get() = p.getBoolean("strict", true)
        set(v) = p.edit().putBoolean("strict", v).apply()
    var clearOnExit: Boolean
        get() = p.getBoolean("clearExit", false)
        set(v) = p.edit().putBoolean("clearExit", v).apply()
    var blockedTotal: Int
        get() = p.getInt("blocked", 0)
        set(v) = p.edit().putInt("blocked", v).apply()

    fun bookmarks(): List<Bookmark> = readArr("bookmarks") { Bookmark(it.getString("u"), it.getString("t")) }
    fun toggleBookmark(url: String, title: String): Boolean {
        val l = bookmarks().toMutableList()
        val i = l.indexOfFirst { it.url == url }
        val added = i < 0
        if (added) l.add(Bookmark(url, title.ifBlank { url })) else l.removeAt(i)
        writeArr("bookmarks", l) { JSONObject().put("u", it.url).put("t", it.title) }
        return added
    }
    fun isBookmarked(url: String) = bookmarks().any { it.url == url }

    fun history(): List<HistoryItem> = readArr("history") { HistoryItem(it.getString("u"), it.getString("t"), it.getLong("m")) }
    fun addHistory(url: String, title: String) {
        val l = history().toMutableList()
        if (l.firstOrNull()?.url == url) return
        l.add(0, HistoryItem(url, title.ifBlank { url }, System.currentTimeMillis()))
        writeArr("history", l.take(500)) { JSONObject().put("u", it.url).put("t", it.title).put("m", it.time) }
    }
    fun updateHistoryTitle(url: String, title: String) {
        val l = history().toMutableList()
        if (l.firstOrNull()?.url != url) return
        l[0] = l[0].copy(title = title)
        writeArr("history", l) { JSONObject().put("u", it.url).put("t", it.title).put("m", it.time) }
    }
    fun clearHistory() = p.edit().remove("history").apply()

    fun savedTabs(): List<String> = readArr("tabs") { it.getString("u") }
    fun saveTabs(urls: List<String>) = writeArr("tabs", urls) { JSONObject().put("u", it) }

    private fun <T> readArr(key: String, f: (JSONObject) -> T): List<T> = runCatching {
        val a = JSONArray(p.getString(key, "[]")); (0 until a.length()).map { f(a.getJSONObject(it)) }
    }.getOrDefault(emptyList())

    private fun <T> writeArr(key: String, l: List<T>, f: (T) -> JSONObject) {
        val a = JSONArray(); l.forEach { a.put(f(it)) }; p.edit().putString(key, a.toString()).apply()
    }
}

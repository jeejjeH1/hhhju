package app.pars

import app.pars.engine.ChromeStore
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

class ChromeStoreTest {
    private val id = "cjpalhdlnbpafiamejdnhcphjbkeiagm"
    private fun zip(vararg f: Pair<String, String>): ByteArray {
        val o = ByteArrayOutputStream()
        ZipOutputStream(o).use { z -> f.forEach { (n, c) -> z.putNextEntry(ZipEntry(n)); z.write(c.toByteArray()); z.closeEntry() } }
        return o.toByteArray()
    }

    @Test fun parsesIds() {
        assertEquals(id, ChromeStore.parseId("https://chromewebstore.google.com/detail/ublock-origin/$id"))
        assertEquals(id, ChromeStore.parseId(id))
        assertNull(ChromeStore.parseId("https://evil.example/$id"))
        assertNull(ChromeStore.parseId("ublock-origin"))
    }

    @Test fun stripsCrx3Header() {
        val z = zip("manifest.json" to "{}")
        val hdr = ByteArray(12); "Cr24".toByteArray().copyInto(hdr); hdr[4] = 3; hdr[8] = 5
        assertArrayEquals(z, ChromeStore.crxToZip(hdr + ByteArray(5) + z))
        assertThrows(IllegalArgumentException::class.java) { ChromeStore.crxToZip("not a crx file at all......".toByteArray()) }
    }

    @Test fun manifestMadeFirefoxCompatible() {
        val m = JSONObject(ChromeStore.fixManifest("""{"name":"x","version":"1","manifest_version":3,"key":"abc","update_url":"https://x","incognito":"split","background":{"service_worker":"sw.js"}}""", id))
        assertEquals("$id@chromestore.pars", m.getJSONObject("browser_specific_settings").getJSONObject("gecko").getString("id"))
        assertEquals("sw.js", m.getJSONObject("background").getJSONArray("scripts").getString(0))
        assertFalse(m.has("key")); assertFalse(m.has("update_url")); assertFalse(m.has("incognito"))
    }

    @Test fun convertDropsZipSlipEntries() {
        val conv = ChromeStore.convert(zip("manifest.json" to """{"name":"x","version":"1","action":{"default_popup":"p.html"}}""", "../evil.txt" to "x", "a/b.js" to "1"), id)
        val out = conv.xpi
        assertEquals("p.html", conv.popup); assertEquals("$id@chromestore.pars", conv.geckoId)
        val names = mutableListOf<String>()
        ZipInputStream(out.inputStream()).use { z -> while (true) { names.add((z.nextEntry ?: break).name) } }
        assertEquals(listOf("manifest.json", "a/b.js"), names)
    }
}

package app.pars

import app.pars.engine.Security
import org.junit.Assert.*
import org.junit.Test

class SecurityTest {
    @Test fun domainsGetHttps() = assertEquals("https://example.com", Security.resolveInput("example.com", "duckduckgo"))
    @Test fun localhostGetsHttp() = assertEquals("http://localhost:3000/x", Security.resolveInput("localhost:3000/x", "duckduckgo"))
    @Test fun ipGetsHttp() = assertEquals("http://192.168.1.1", Security.resolveInput("192.168.1.1", "brave"))
    @Test fun textBecomesSearch() = assertTrue(Security.resolveInput("سلام دنیا", "brave").startsWith("https://search.brave.com/search?q=%D8%B3"))
    @Test fun javascriptIsSearchedNotRun() = assertTrue(Security.resolveInput("javascript:alert(1)", "google").startsWith("https://www.google.com/search?q="))
    @Test fun fileSchemeRejected() = assertEquals("", Security.resolveInput("file:///etc/passwd", "google"))
    @Test fun blankRejected() = assertEquals("", Security.resolveInput("   ", "google"))
    @Test fun dangerousFiles() { assertTrue(Security.isDangerousFile("a.APK")); assertFalse(Security.isDangerousFile("a.jpg")) }
    @Test fun safeUrls() { assertTrue(Security.isSafeNavigationUrl("https://a.b")); assertFalse(Security.isSafeNavigationUrl("intent://x")); assertFalse(Security.isSafeNavigationUrl("javascript:1")) }
    @Test fun amoLinks() {
        assertEquals("https://addons.mozilla.org/firefox/downloads/latest/ublock-origin/latest.xpi", Security.amoXpiUrl("https://addons.mozilla.org/en-US/firefox/addon/ublock-origin/"))
        assertEquals("https://addons.mozilla.org/firefox/downloads/latest/darkreader/latest.xpi", Security.amoXpiUrl("darkreader"))
        assertNull(Security.amoXpiUrl("https://evil.example/x.xpi"))
        assertNull(Security.amoXpiUrl("http://addons.mozilla.org/en/firefox/addon/x/"))
    }
}

package app.pars

import app.pars.engine.Pin
import app.pars.engine.PinLogic
import org.junit.Assert.*
import org.junit.Test

class PinLogicTest {
    private val base = Pin("1", "دلار", "https://x.com/rate", "#price")

    @Test fun firstReadIsNotAChange() {
        val r = PinLogic.apply(base, " 58,400 ", true, 100)
        assertFalse(r.changed); assertEquals("58,400", r.pin.value); assertEquals("58,400", r.pin.first)
    }

    @Test fun detectsChange() {
        val p = PinLogic.apply(base, "58,400", true, 100).pin
        assertFalse(PinLogic.apply(p, "58,400", true, 200).changed)
        val r = PinLogic.apply(p, "58,900", true, 300)
        assertTrue(r.changed); assertEquals("58,400", r.pin.prev); assertEquals("58,900", r.pin.value); assertEquals(300, r.pin.changed)
    }

    @Test fun missingElementKeepsValueButFlags() {
        val p = PinLogic.apply(base, "10", true, 1).pin
        val r = PinLogic.apply(p, "", false, 2)
        assertFalse(r.pin.ok); assertEquals("10", r.pin.value); assertFalse(r.changed)
    }

    @Test fun jsonRoundTrip() {
        val l = listOf(PinLogic.apply(base, "5", true, 1).pin)
        assertEquals(l, PinLogic.fromJson(PinLogic.toJson(l)))
        assertTrue(PinLogic.fromJson("not json").isEmpty())
    }

    @Test fun pickValidation() {
        assertTrue(PinLogic.validPick("https://a.b/x", "div > span", "12"))
        assertFalse(PinLogic.validPick("javascript:1", "div", "12"))
        assertFalse(PinLogic.validPick("https://a.b", "", "12"))
        assertFalse(PinLogic.validPick("https://a.b", "x".repeat(401), "12"))
        assertEquals("https://a.b/x", PinLogic.normalizeUrl("https://a.b/x/#top"))
    }
}

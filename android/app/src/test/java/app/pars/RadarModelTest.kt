package app.pars

import app.pars.engine.RadarModel
import app.pars.engine.RawBlock
import org.junit.Assert.*
import org.junit.Test

class RadarModelTest {
    @Test fun kindPriority() {
        assertEquals(RadarModel.CRYPTO, RadarModel.kindOf(RadarModel.AD or RadarModel.CRYPTO))
        assertEquals(RadarModel.AD, RadarModel.kindOf(RadarModel.AD or RadarModel.ANALYTIC))
        assertEquals(0, RadarModel.kindOf(0))
    }

    @Test fun buildsThirdPartyOnly() {
        val raw = listOf(
            RawBlock("https://www.example.com", RadarModel.AD, true, 1),            // شخص‌اول → حذف
            RawBlock("https://stats.example.com", RadarModel.ANALYTIC, true, 1),    // زیردامنه‌ی شخص‌اول → حذف
            RawBlock("https://ads.tracker.net/p", RadarModel.AD, true, 3),
            RawBlock("https://ads.tracker.net/q", RadarModel.AD, false, 1),
            RawBlock("https://cdn.safe.org", 0, false, 5),                         // دسته‌ی صفر → حذف
        )
        val n = RadarModel.build(raw, "www.example.com")
        assertEquals(1, n.size)
        assertEquals("ads.tracker.net", n[0].host); assertEquals(3, n[0].blocked); assertEquals(1, n[0].allowed)
    }

    @Test fun scoring() {
        assertEquals(100, RadarModel.score(emptyList(), true))
        assertEquals(75, RadarModel.score(emptyList(), false))
        val leaky = (1..12).map { app.pars.engine.RadarNode("t$it.net", RadarModel.AD, 0, 1) }
        assertTrue(RadarModel.score(leaky, true) < 35)
        assertEquals("A+", RadarModel.grade(100)); assertEquals("F", RadarModel.grade(10))
    }
}

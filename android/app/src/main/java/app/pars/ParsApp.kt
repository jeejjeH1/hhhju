package app.pars

import android.app.Application
import app.pars.engine.Browser

class ParsApp : Application() {
    /**
     * GeckoView پردازه‌های فرزند (محتوا/GPU/…) را با همین کلاس Application اجرا می‌کند؛
     * ساختن GeckoRuntime در آن‌ها کرش می‌دهد. پس فقط وقتی UI اصلی بخواهد ساخته می‌شود (lazy).
     */
    val browser: Browser by lazy { Browser(this) }
}

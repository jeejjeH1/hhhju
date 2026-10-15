package app.pars

import android.app.Application
import app.pars.engine.Browser

class ParsApp : Application() {
    lateinit var browser: Browser
        private set

    override fun onCreate() {
        super.onCreate()
        browser = Browser(this)
    }
}

package app.pars.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.view.View
import android.widget.RemoteViews
import app.pars.MainActivity
import app.pars.R
import app.pars.engine.PinLogic
import app.pars.engine.Store
import app.pars.ui.Palettes

/** ویجت صفحه‌ی اصلی: چند پین آخر با مقدار فعلی‌شان. رنگ‌ها از تم انتخابی کاربر می‌آید. */
class PinsWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, mgr: AppWidgetManager, ids: IntArray) {
        ids.forEach { mgr.updateAppWidget(it, build(context)) }
    }

    companion object {
        private val titleIds = intArrayOf(R.id.w_t1, R.id.w_t2, R.id.w_t3, R.id.w_t4)
        private val valueIds = intArrayOf(R.id.w_v1, R.id.w_v2, R.id.w_v3, R.id.w_v4)
        private val rowIds = intArrayOf(R.id.w_r1, R.id.w_r2, R.id.w_r3, R.id.w_r4)

        fun refreshAll(ctx: Context) {
            val mgr = AppWidgetManager.getInstance(ctx)
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, PinsWidget::class.java))
            if (ids.isNotEmpty()) ids.forEach { mgr.updateAppWidget(it, build(ctx)) }
        }

        private fun build(ctx: Context): RemoteViews {
            val store = Store(ctx)
            val pal = Palettes.byId(store.str("theme", "neon"))
            val accent = store.str("accent", "").toLongOrNull() ?: pal.a1
            val pins = PinLogic.fromJson(store.str("pins", "[]")).sortedByDescending { it.changed }.take(4)
            val v = RemoteViews(ctx.packageName, R.layout.widget_pins)
            v.setInt(R.id.w_bg, "setColorFilter", pal.bg.toInt())
            v.setTextColor(R.id.w_head, accent.toInt())
            for (i in 0 until 4) {
                val p = pins.getOrNull(i)
                v.setViewVisibility(rowIds[i], if (p != null) View.VISIBLE else View.GONE)
                if (p != null) {
                    v.setTextViewText(titleIds[i], p.title)
                    v.setTextViewText(valueIds[i], if (p.ok) p.value else "⚠ ${p.value}")
                    v.setTextColor(titleIds[i], pal.muted.toInt())
                    v.setTextColor(valueIds[i], if (p.ok) pal.text.toInt() else pal.amber.toInt())
                }
            }
            val last = pins.maxOfOrNull { it.checked } ?: 0L
            v.setTextViewText(R.id.w_foot, if (pins.isEmpty()) "پینی نیست؛ در پارس: منو ← پین‌ها" else "به‌روز شد: ${PinLogic.ago(last, System.currentTimeMillis())}")
            v.setTextColor(R.id.w_foot, pal.muted.toInt())
            val open = PendingIntent.getActivity(ctx, 1, Intent(ctx, MainActivity::class.java).putExtra("refresh", true).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            v.setOnClickPendingIntent(R.id.w_root, open)
            return v
        }
    }
}

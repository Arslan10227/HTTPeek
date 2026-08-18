package com.httpeek.app.core.process

import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.util.Base64
import android.util.LruCache
import java.io.ByteArrayOutputStream

/**
 * Extracts and caches real Android App Icons as Base64 PNGs,
 * allowing instant rendering in mobile and desktop inspection timelines.
 */
object AppIconExtractor {

    private val iconCache = LruCache<String, String>(64) // PackageName -> Base64 PNG

    fun getAppIconBase64(context: Context, packageName: String?): String? {
        if (packageName.isNullOrBlank() || packageName == "unknown") return null

        val cached = iconCache.get(packageName)
        if (cached != null) return cached

        return try {
            val pm = context.packageManager
            val appInfo = pm.getApplicationInfo(packageName, 0)
            val drawable = pm.getApplicationIcon(appInfo)
            val bitmap = drawableToBitmap(drawable)
            val b64 = bitmapToBase64(bitmap)
            if (b64.isNotEmpty()) {
                iconCache.put(packageName, b64)
            }
            b64
        } catch (e: Exception) {
            null
        }
    }

    fun getAppLabel(context: Context, packageName: String?): String {
        if (packageName.isNullOrBlank() || packageName == "unknown") return "Android App"
        return try {
            val pm = context.packageManager
            val appInfo = pm.getApplicationInfo(packageName, 0)
            pm.getApplicationLabel(appInfo).toString()
        } catch (e: Exception) {
            packageName
        }
    }

    private fun drawableToBitmap(drawable: Drawable): Bitmap {
        if (drawable is BitmapDrawable && drawable.bitmap != null) {
            return drawable.bitmap
        }

        val width = if (drawable.intrinsicWidth > 0) drawable.intrinsicWidth.coerceAtMost(96) else 64
        val height = if (drawable.intrinsicHeight > 0) drawable.intrinsicHeight.coerceAtMost(96) else 64

        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        drawable.setBounds(0, 0, canvas.width, canvas.height)
        drawable.draw(canvas)
        return bitmap
    }

    private fun bitmapToBase64(bitmap: Bitmap): String {
        val stream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 90, stream)
        val bytes = stream.toByteArray()
        return Base64.encodeToString(bytes, Base64.NO_WRAP)
    }
}

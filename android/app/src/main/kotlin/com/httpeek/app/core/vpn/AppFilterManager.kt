package com.httpeek.app.core.vpn

import android.content.Context
import android.content.SharedPreferences
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.drawable.Drawable
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

data class InstalledAppItem(
    val name: String,
    val packageName: String,
    val icon: Drawable?,
    val isSystemApp: Boolean,
    var isSelected: Boolean = false
)

enum class AppFilterMode {
    ALL_APPS,
    ONLY_SELECTED,
    EXCLUDE_SELECTED
}

/**
 * Manages Per-App network capture filtering for HTTPeek VpnService.
 */
class AppFilterManager(private val context: Context) {

    companion object {
        private const val PREFS_NAME = "httpeek_app_filter"
        private const val KEY_FILTER_MODE = "filter_mode"
        private const val KEY_SELECTED_PACKAGES = "selected_packages"
    }

    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun getFilterMode(): AppFilterMode {
        val name = prefs.getString(KEY_FILTER_MODE, AppFilterMode.ALL_APPS.name)
        return try {
            AppFilterMode.valueOf(name ?: AppFilterMode.ALL_APPS.name)
        } catch (e: Exception) {
            AppFilterMode.ALL_APPS
        }
    }

    fun setFilterMode(mode: AppFilterMode) {
        prefs.edit().putString(KEY_FILTER_MODE, mode.name).apply()
    }

    fun getSelectedPackages(): Set<String> {
        return prefs.getStringSet(KEY_SELECTED_PACKAGES, emptySet()) ?: emptySet()
    }

    fun setSelectedPackages(packages: Set<String>) {
        prefs.edit().putStringSet(KEY_SELECTED_PACKAGES, packages).apply()
    }

    fun toggleApp(packageName: String, isSelected: Boolean) {
        val current = getSelectedPackages().toMutableSet()
        if (isSelected) {
            current.add(packageName)
        } else {
            current.remove(packageName)
        }
        setSelectedPackages(current)
    }

    /**
     * Loads list of all installed applications asynchronously.
     */
    suspend fun loadInstalledApps(): List<InstalledAppItem> = withContext(Dispatchers.IO) {
        val pm = context.packageManager
        val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
        val selected = getSelectedPackages()

        val list = mutableListOf<InstalledAppItem>()
        for (app in apps) {
            // Exclude self package to prevent proxy recursion
            if (app.packageName == context.packageName) continue

            val name = pm.getApplicationLabel(app).toString()
            val isSystem = (app.flags and ApplicationInfo.FLAG_SYSTEM) != 0
            val icon = try {
                pm.getApplicationIcon(app)
            } catch (e: Exception) {
                null
            }

            list.add(
                InstalledAppItem(
                    name = name,
                    packageName = app.packageName,
                    icon = icon,
                    isSystemApp = isSystem,
                    isSelected = selected.contains(app.packageName)
                )
            )
        }

        list.sortedWith(compareBy<InstalledAppItem> { !it.isSelected }.thenBy { it.name.lowercase() })
    }
}

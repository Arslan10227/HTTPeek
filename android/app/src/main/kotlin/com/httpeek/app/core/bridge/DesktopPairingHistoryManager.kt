package com.httpeek.app.core.bridge

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * Persists connected desktop server links in Android SharedPreferences,
 * enabling instant 1-tap reconnection to past desktop sessions.
 */
object DesktopPairingHistoryManager {

    private const val PREFS_NAME = "httpeek_desktop_pairing"
    private const val KEY_LAST_HOST = "last_desktop_host"
    private const val KEY_LAST_PORT = "last_desktop_port"
    private const val KEY_LAST_TOKEN = "last_desktop_token"
    private const val KEY_HISTORY = "desktop_pairing_history"
    private const val MAX_HISTORY = 8

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    /**
     * Saves a successful connection to history and marks it as the last connected desktop.
     */
    fun saveConnection(context: Context, info: DesktopPairingInfo) {
        if (info.host.isBlank()) return
        val prefs = getPrefs(context)
        val gson = Gson()

        // 1. Save as last connected
        prefs.edit()
            .putString(KEY_LAST_HOST, info.host)
            .putInt(KEY_LAST_PORT, info.port)
            .remove(KEY_LAST_TOKEN)
            .apply()

        // 2. Add to history list (deduplicated)
        val history = getRecentConnections(context).toMutableList()
        history.removeAll { it.host.equals(info.host, ignoreCase = true) && it.port == info.port }
        history.add(0, info.copy(token = null))

        val trimmed = history.take(MAX_HISTORY)
        val json = gson.toJson(trimmed)
        prefs.edit().putString(KEY_HISTORY, json).apply()
    }

    /**
     * Retrieves the last connected desktop info, if any.
     */
    fun getLastConnected(context: Context): DesktopPairingInfo? {
        val prefs = getPrefs(context)
        val host = prefs.getString(KEY_LAST_HOST, null) ?: return null
        val port = prefs.getInt(KEY_LAST_PORT, 9099)
        return DesktopPairingInfo(host, port)
    }

    /**
     * Clears the active desktop pairing (reverts to standalone).
     */
    fun clearActiveConnection(context: Context) {
        getPrefs(context).edit()
            .remove(KEY_LAST_HOST)
            .remove(KEY_LAST_PORT)
            .remove(KEY_LAST_TOKEN)
            .apply()
    }

    /**
     * Returns list of recently connected desktop links.
     */
    fun getRecentConnections(context: Context): List<DesktopPairingInfo> {
        val prefs = getPrefs(context)
        val json = prefs.getString(KEY_HISTORY, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<DesktopPairingInfo>>() {}.type
            Gson().fromJson<List<DesktopPairingInfo>>(json, type) ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    /**
     * Removes a specific host:port from history.
     */
    fun removeConnection(context: Context, host: String, port: Int) {
        val prefs = getPrefs(context)
        val history = getRecentConnections(context).filterNot {
            it.host.equals(host, ignoreCase = true) && it.port == port
        }
        val json = Gson().toJson(history)
        prefs.edit().putString(KEY_HISTORY, json).apply()

        val last = getLastConnected(context)
        if (last?.host.equals(host, ignoreCase = true) && last?.port == port) {
            clearActiveConnection(context)
        }
    }

    /**
     * Clears all pairing history.
     */
    fun clearAllHistory(context: Context) {
        getPrefs(context).edit().clear().apply()
    }
}

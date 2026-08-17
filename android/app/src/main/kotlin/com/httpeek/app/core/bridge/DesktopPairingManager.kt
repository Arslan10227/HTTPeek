package com.httpeek.app.core.bridge

import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

data class DesktopPairingInfo(
    val host: String,
    val port: Int = 9099,
    val token: String? = null
)

/**
 * Parses and verifies pairing information for HTTPeek Desktop.
 */
object DesktopPairingManager {

    private val client = OkHttpClient.Builder()
        .connectTimeout(3, TimeUnit.SECONDS)
        .readTimeout(3, TimeUnit.SECONDS)
        .build()

    fun parsePairingString(raw: String): DesktopPairingInfo? {
        val str = raw.trim()

        // Scheme 1: URI format httpeek://connect?host=192.168.1.10&port=9099
        if (str.startsWith("httpeek://", ignoreCase = true) || str.startsWith("proxypin://", ignoreCase = true)) {
            return try {
                val uri = Uri.parse(str)
                val host = uri.getQueryParameter("host") ?: uri.host ?: return null
                val port = uri.getQueryParameter("port")?.toIntOrNull() ?: uri.port.takeIf { it > 0 } ?: 9099
                val token = uri.getQueryParameter("token")
                DesktopPairingInfo(host, port, token)
            } catch (e: Exception) {
                null
            }
        }

        // Scheme 2: Direct IP:Port 192.168.1.10:9099
        if (str.contains(":")) {
            val parts = str.split(":")
            val host = parts[0].trim()
            val port = parts[1].toIntOrNull() ?: 9099
            if (host.isNotEmpty()) {
                return DesktopPairingInfo(host, port)
            }
        }

        // Scheme 3: Host only
        if (str.isNotEmpty() && !str.contains("/")) {
            return DesktopPairingInfo(str, 9099)
        }

        return null
    }

    suspend fun testConnection(host: String, port: Int): Pair<Boolean, Long> = withContext(Dispatchers.IO) {
        val start = System.currentTimeMillis()
        try {
            val req = Request.Builder().url("http://$host:$port/api/status").build()
            val resp = client.newCall(req).execute()
            val latency = System.currentTimeMillis() - start
            Pair(resp.isSuccessful, latency)
        } catch (e: Exception) {
            Pair(false, -1L)
        }
    }
}

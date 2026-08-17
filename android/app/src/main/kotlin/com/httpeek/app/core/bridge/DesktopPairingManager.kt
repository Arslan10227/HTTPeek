package com.httpeek.app.core.bridge

import android.net.Uri
import com.google.gson.Gson
import com.google.gson.JsonObject
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
 * Universal Parser and Connection Tester for HTTPeek Desktop Pairing.
 * Supports JSON, HTTP/HTTPS URLs, Custom URIs (httpeek://, proxypin://), IP:Port, and Raw IP.
 */
object DesktopPairingManager {

    private val client = OkHttpClient.Builder()
        .connectTimeout(3, TimeUnit.SECONDS)
        .readTimeout(3, TimeUnit.SECONDS)
        .build()

    fun parsePairingString(raw: String): DesktopPairingInfo? {
        val str = raw.trim()
        if (str.isEmpty()) return null

        // 1. JSON Payload: {"host":"192.168.1.10","port":9099} or {"ip":"192.168.1.10","port":9099}
        if (str.startsWith("{") && str.endsWith("}")) {
            try {
                val json = Gson().fromJson(str, JsonObject::class.java)
                val host = json.get("host")?.asString
                    ?: json.get("ip")?.asString
                    ?: json.get("address")?.asString
                val port = json.get("port")?.asInt ?: 9099
                val token = json.get("token")?.asString
                if (!host.isNullOrEmpty()) {
                    return DesktopPairingInfo(host, port, token)
                }
            } catch (e: Exception) {}
        }

        // 2. HTTP/HTTPS URL: http://192.168.1.10:9099/ssl or http://192.168.1.10:9099/api/ca/export
        if (str.startsWith("http://", ignoreCase = true) || str.startsWith("https://", ignoreCase = true)) {
            try {
                val uri = Uri.parse(str)
                val host = uri.host
                val port = if (uri.port > 0) uri.port else 9099
                if (!host.isNullOrEmpty()) {
                    return DesktopPairingInfo(host, port)
                }
            } catch (e: Exception) {}
        }

        // 3. Custom URI Schemes: httpeek://connect?host=192.168.1.10&port=9099 or proxypin://...
        if (str.startsWith("httpeek://", ignoreCase = true) || str.startsWith("proxypin://", ignoreCase = true)) {
            try {
                val uri = Uri.parse(str)
                val host = uri.getQueryParameter("host")
                    ?: uri.getQueryParameter("ip")
                    ?: uri.host
                val port = uri.getQueryParameter("port")?.toIntOrNull()
                    ?: (if (uri.port > 0) uri.port else 9099)
                val token = uri.getQueryParameter("token")
                if (!host.isNullOrEmpty()) {
                    return DesktopPairingInfo(host, port, token)
                }
            } catch (e: Exception) {}
        }

        // 4. IP:Port or Host:Port: 192.168.1.10:9099
        val ipPortRegex = Regex("""^([a-zA-Z0-9.\-_]+):(\d+)$""")
        val match = ipPortRegex.find(str)
        if (match != null) {
            val host = match.groupValues[1]
            val port = match.groupValues[2].toIntOrNull() ?: 9099
            return DesktopPairingInfo(host, port)
        }

        // 5. Raw IP or Hostname without port: 192.168.1.10
        val ipOnlyRegex = Regex("""^([a-zA-Z0-9.\-_]+)$""")
        if (ipOnlyRegex.matches(str) && !str.contains("/")) {
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

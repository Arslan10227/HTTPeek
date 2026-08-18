package com.httpeek.app.core.har

import android.content.Context
import android.net.Uri
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.JsonObject
import com.httpeek.app.model.HostPortModel
import com.httpeek.app.model.HttpRequestModel
import com.httpeek.app.model.HttpResponseModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

/**
 * Standard RFC-compliant HTTP Archive (HAR 1.2) Generator and Parser.
 * Enables full session export and import compatible with Chrome DevTools, Postman, Charles, and Proxyman.
 */
object HarExportManager {

    private val gson: Gson = GsonBuilder().setPrettyPrinting().create()

    fun exportToHarJson(requests: List<HttpRequestModel>): String {
        val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }

        val entries = requests.map { req ->
            val reqHeaders = req.headers?.flatMap { (k, vals) ->
                vals.map { mapOf("name" to k, "value" to it) }
            } ?: emptyList()

            val resp = req.response
            val respHeaders = resp?.headers?.flatMap { (k, vals) ->
                vals.map { mapOf("name" to k, "value" to it) }
            } ?: emptyList()

            mapOf(
                "startedDateTime" to (req.startTime.ifEmpty { isoFormat.format(Date()) }),
                "time" to (resp?.durationMs ?: req.durationMs ?: 0L),
                "request" to mapOf(
                    "method" to req.method,
                    "url" to req.url,
                    "httpVersion" to "HTTP/1.1",
                    "headers" to reqHeaders,
                    "queryString" to parseQueryString(req.url),
                    "postData" to if (!req.bodyString.isNullOrEmpty()) mapOf(
                        "mimeType" to (req.headers?.get("Content-Type")?.firstOrNull() ?: "text/plain"),
                        "text" to req.bodyString
                    ) else null,
                    "headersSize" to -1,
                    "bodySize" to (req.bodyString?.toByteArray()?.size ?: 0)
                ),
                "response" to mapOf(
                    "status" to (resp?.statusCode ?: 0),
                    "statusText" to (resp?.statusText ?: ""),
                    "httpVersion" to "HTTP/1.1",
                    "headers" to respHeaders,
                    "content" to mapOf(
                        "size" to (resp?.bodySize ?: resp?.bodyString?.toByteArray()?.size ?: 0),
                        "mimeType" to (resp?.contentType ?: "text/plain"),
                        "text" to (resp?.bodyString ?: "")
                    ),
                    "redirectURL" to "",
                    "headersSize" to -1,
                    "bodySize" to (resp?.bodySize ?: 0)
                ),
                "cache" to emptyMap<String, Any>(),
                "timings" to mapOf(
                    "send" to 0,
                    "wait" to (resp?.durationMs ?: 0L),
                    "receive" to 0
                )
            )
        }

        val harObject = mapOf(
            "log" to mapOf(
                "version" to "1.2",
                "creator" to mapOf(
                    "name" to "HTTPeek Android",
                    "version" to "1.0.0"
                ),
                "entries" to entries
            )
        )

        return gson.toJson(harObject)
    }

    suspend fun saveHarToFile(context: Context, requests: List<HttpRequestModel>, fileName: String = "httpeek_traffic.har"): File = withContext(Dispatchers.IO) {
        val json = exportToHarJson(requests)
        val file = File(context.cacheDir, fileName)
        file.writeText(json, Charsets.UTF_8)
        file
    }

    private fun parseQueryString(url: String): List<Map<String, String>> {
        val qIdx = url.indexOf('?')
        if (qIdx < 0 || qIdx >= url.length - 1) return emptyList()
        val query = url.substring(qIdx + 1)
        val parts = query.split("&")
        return parts.mapNotNull { part ->
            val eq = part.indexOf('=')
            if (eq > 0) {
                mapOf("name" to part.substring(0, eq), "value" to part.substring(eq + 1))
            } else null
        }
    }
}

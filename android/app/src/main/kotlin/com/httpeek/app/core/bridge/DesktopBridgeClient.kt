package com.httpeek.app.core.bridge

import android.os.Build
import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.httpeek.app.model.HttpRequestModel
import com.httpeek.app.model.HttpResponseModel
import com.httpeek.app.security.RootCAInstaller
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * High-performance WebSocket & REST bridge to HTTPeek Desktop.
 * Mirrors all mobile captured traffic to Desktop, sends device metadata & heartbeats,
 * and falls back to HTTP batch sync if connection drops.
 */
class DesktopBridgeClient(
    private val host: String,
    private val port: Int = 9099,
    private val context: android.content.Context? = null,
    private val onConnectionChange: ((Boolean) -> Unit)? = null
) {
    companion object {
        private const val TAG = "DesktopBridgeClient"
    }

    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .connectTimeout(5, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val isConnected = AtomicBoolean(false)
    private val isRunning = AtomicBoolean(false)

    private val pendingRequests = ConcurrentLinkedQueue<HttpRequestModel>()
    private val pendingResponses = ConcurrentLinkedQueue<HttpResponseModel>()

    var onRulesSyncReceived: ((String) -> Unit)? = null
    var onRemoteCommandReceived: ((String) -> Unit)? = null

    private var heartbeatJob: Job? = null

    fun connect() {
        isRunning.set(true)
        val wsUrl = "ws://$host:$port/ws/events"
        val request = Request.Builder().url(wsUrl).build()

        Log.i(TAG, "Connecting to HTTPeek Desktop at $wsUrl...")

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                try {
                    Log.i(TAG, "Connected to HTTPeek Desktop! Sending device handshake...")
                    isConnected.set(true)
                    onConnectionChange?.invoke(true)

                    // 1. Send Handshake
                    val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}".trim()
                    val osVersion = "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})"
                    val isRooted = RootCAInstaller.isDeviceRooted()

                    val safeDeviceId = try {
                        context?.let { ctx ->
                            android.provider.Settings.Secure.getString(ctx.contentResolver, android.provider.Settings.Secure.ANDROID_ID)
                        } ?: "${Build.MANUFACTURER}_${Build.MODEL}_${Build.ID}"
                    } catch (e: Exception) {
                        "${Build.MANUFACTURER}_${Build.MODEL}"
                    }

                    val helloPayload = mapOf(
                        "event" to "mobile:hello",
                        "data" to mapOf(
                            "deviceId" to safeDeviceId,
                            "deviceName" to deviceName,
                            "osVersion" to osVersion,
                            "isRooted" to isRooted
                        )
                    )
                    ws.send(gson.toJson(helloPayload))

                    // 2. Start 10s Heartbeat
                    startHeartbeat()

                    // 3. Flush pending offline queue
                    flushPendingQueue()
                } catch (e: Exception) {
                    Log.e(TAG, "Error in onOpen handshake", e)
                }
            }

            override fun onMessage(ws: WebSocket, text: String) {
                try {
                    val root = gson.fromJson(text, JsonObject::class.java)
                    val event = root.get("event")?.asString ?: return
                    val data = root.get("data")

                    when (event) {
                        "rules:sync" -> {
                            Log.i(TAG, "Received bi-directional rules sync from Desktop")
                            onRulesSyncReceived?.invoke(data?.toString() ?: "{}")
                        }
                        "remote:vpn_start", "remote:vpn_stop", "remote:traffic_clear" -> {
                            Log.i(TAG, "Received remote command from Desktop: $event")
                            onRemoteCommandReceived?.invoke(event)
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to parse incoming WebSocket message: ${e.message}")
                }
            }

            override fun onClosing(ws: WebSocket, code: Int, reason: String) {
                isConnected.set(false)
                stopHeartbeat()
                onConnectionChange?.invoke(false)
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                isConnected.set(false)
                stopHeartbeat()
                onConnectionChange?.invoke(false)
                Log.w(TAG, "Desktop WebSocket disconnected: ${t.message}. Reconnecting in 3s...")
                if (isRunning.get()) {
                    scope.launch {
                        delay(3000)
                        if (isRunning.get()) connect()
                    }
                }
            }
        })
    }

    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (isActive && isConnected.get()) {
                delay(10000)
                if (isConnected.get()) {
                    val ping = mapOf(
                        "event" to "mobile:ping",
                        "data" to mapOf("time" to System.currentTimeMillis())
                    )
                    webSocket?.send(gson.toJson(ping))
                }
            }
        }
    }

    private fun stopHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = null
    }

    fun sendRequest(request: HttpRequestModel) {
        if (isConnected.get()) {
            val payload = mapOf(
                "event" to "proxy:request",
                "data" to request
            )
            val ok = webSocket?.send(gson.toJson(payload)) ?: false
            if (!ok) {
                pendingRequests.add(request)
            }
        } else {
            if (pendingRequests.size < 500) {
                pendingRequests.add(request)
            }
        }
    }

    fun sendResponse(response: HttpResponseModel) {
        if (isConnected.get()) {
            val payload = mapOf(
                "event" to "proxy:response",
                "data" to response
            )
            val ok = webSocket?.send(gson.toJson(payload)) ?: false
            if (!ok) {
                pendingResponses.add(response)
            }
        } else {
            if (pendingResponses.size < 500) {
                pendingResponses.add(response)
            }
        }
    }

    private fun flushPendingQueue() {
        scope.launch {
            val reqs = mutableListOf<HttpRequestModel>()
            while (pendingRequests.isNotEmpty() && reqs.size < 100) {
                pendingRequests.poll()?.let { reqs.add(it) }
            }

            val resps = mutableListOf<HttpResponseModel>()
            while (pendingResponses.isNotEmpty() && resps.size < 100) {
                pendingResponses.poll()?.let { resps.add(it) }
            }

            if (reqs.isNotEmpty() || resps.isNotEmpty()) {
                // Batch sync over HTTP POST /api/mobile/sync
                try {
                    val syncUrl = "http://$host:$port/api/mobile/sync"
                    val bodyMap = mapOf(
                        "deviceId" to Build.MODEL,
                        "deviceName" to "${Build.MANUFACTURER} ${Build.MODEL}",
                        "requests" to reqs,
                        "responses" to resps
                    )
                    val bodyJson = gson.toJson(bodyMap)
                    val req = Request.Builder()
                        .url(syncUrl)
                        .post(bodyJson.toRequestBody("application/json".toMediaTypeOrNull()))
                        .build()
                    client.newCall(req).execute().close()
                    Log.i(TAG, "Successfully flushed ${reqs.size} requests and ${resps.size} responses to desktop")
                } catch (e: Exception) {
                    Log.w(TAG, "Batch sync flush failed: ${e.message}")
                }
            }
        }
    }

    fun disconnect() {
        isRunning.set(false)
        isConnected.set(false)
        stopHeartbeat()
        webSocket?.close(1000, "Disconnected by user")
        webSocket = null
        onConnectionChange?.invoke(false)
    }
}

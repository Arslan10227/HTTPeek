package com.httpeek.app.core.bridge

import android.util.Log
import com.google.gson.Gson
import com.httpeek.app.model.HttpRequestModel
import com.httpeek.app.model.HttpResponseModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.*
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * High-performance WebSocket & REST bridge to HTTPeek Desktop.
 * Mirrors all mobile captured traffic to Desktop and syncs active rules.
 */
class DesktopBridgeClient(
    private val host: String,
    private val port: Int = 9099,
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
    private val scope = CoroutineScope(Dispatchers.IO)
    private val isConnected = AtomicBoolean(false)
    private val isRunning = AtomicBoolean(false)

    fun connect() {
        isRunning.set(true)
        val wsUrl = "ws://$host:$port/ws/events"
        val request = Request.Builder().url(wsUrl).build()

        Log.i(TAG, "Connecting to HTTPeek Desktop at $wsUrl...")

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                Log.i(TAG, "Connected to HTTPeek Desktop!")
                isConnected.set(true)
                onConnectionChange?.invoke(true)
            }

            override fun onMessage(ws: WebSocket, text: String) {
                // Desktop rule / breakpoint updates can be parsed here
            }

            override fun onClosing(ws: WebSocket, code: Int, reason: String) {
                isConnected.set(false)
                onConnectionChange?.invoke(false)
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                isConnected.set(false)
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

    fun sendRequest(request: HttpRequestModel) {
        if (!isConnected.get()) return
        val payload = mapOf(
            "event" to "proxy:request",
            "data" to request
        )
        webSocket?.send(gson.toJson(payload))
    }

    fun sendResponse(response: HttpResponseModel) {
        if (!isConnected.get()) return
        val payload = mapOf(
            "event" to "proxy:response",
            "data" to response
        )
        webSocket?.send(gson.toJson(payload))
    }

    fun disconnect() {
        isRunning.set(false)
        isConnected.set(false)
        webSocket?.close(1000, "Disconnected by user")
        webSocket = null
        onConnectionChange?.invoke(false)
    }
}

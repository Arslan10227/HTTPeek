package com.httpeek.app.net

import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.httpeek.app.model.HttpRequestModel
import com.httpeek.app.model.HttpResponseModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit

class HttpProxyClient(
    private val host: String = "127.0.0.1",
    private val port: Int = 9099,
    private val onRequest: (HttpRequestModel) -> Unit,
    private val onResponse: (HttpResponseModel) -> Unit,
    private val onConnectionChange: ((Boolean) -> Unit)? = null
) {
    private val client = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.Main)
    private var isConnected = false

    fun connect() {
        val wsUrl = "ws://$host:$port/ws/events"
        val request = Request.Builder().url(wsUrl).build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.i("HttpProxyClient", "WebSocket connection opened to $wsUrl")
                if (!isConnected) {
                    isConnected = true
                    scope.launch { onConnectionChange?.invoke(true) }
                }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val jsonObj = gson.fromJson(text, JsonObject::class.java)
                    val event = jsonObj.get("event")?.asString ?: return
                    val dataObj = jsonObj.get("data") ?: return

                    when (event) {
                        "proxy:request" -> {
                            val req = gson.fromJson(dataObj, HttpRequestModel::class.java)
                            scope.launch { onRequest(req) }
                        }
                        "proxy:response" -> {
                            val resp = gson.fromJson(dataObj, HttpResponseModel::class.java)
                            scope.launch { onResponse(resp) }
                        }
                    }
                } catch (e: Exception) {
                    Log.e("HttpProxyClient", "Error parsing WS message: ${e.message}")
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                if (isConnected) {
                    isConnected = false
                    scope.launch { onConnectionChange?.invoke(false) }
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.w("HttpProxyClient", "WebSocket disconnected, reconnecting in 3s: ${t.message}")
                if (isConnected) {
                    isConnected = false
                    scope.launch { onConnectionChange?.invoke(false) }
                }
                scope.launch {
                    kotlinx.coroutines.delay(3000)
                    connect()
                }
            }
        })
    }

    fun disconnect() {
        webSocket?.close(1000, "App closed")
        webSocket = null
        if (isConnected) {
            isConnected = false
            scope.launch { onConnectionChange?.invoke(false) }
        }
    }
}

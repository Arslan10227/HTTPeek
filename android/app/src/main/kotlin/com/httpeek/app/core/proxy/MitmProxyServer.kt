package com.httpeek.app.core.proxy

import android.content.Context
import android.util.Log
import com.httpeek.app.core.rules.RulesEngine
import com.httpeek.app.model.HostPortModel
import com.httpeek.app.model.HttpRequestModel
import com.httpeek.app.model.HttpResponseModel
import com.httpeek.app.security.DynamicCertAuthority
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.*
import java.net.ServerSocket
import java.net.Socket
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import javax.net.ssl.SSLSocket
import javax.net.ssl.SSLSocketFactory

/**
 * Embedded High-Throughput MITM Proxy Engine for HTTPeek Android.
 * Handles HTTP/1.1 & HTTPS SSL/TLS decryption on-device.
 */
class MitmProxyServer(
    private val context: Context,
    private val port: Int = 9099,
    private val ca: DynamicCertAuthority,
    private val rulesEngine: RulesEngine,
    private val onRequest: (HttpRequestModel) -> Unit,
    private val onResponse: (HttpResponseModel) -> Unit
) {
    companion object {
        private const val TAG = "MitmProxyServer"
    }

    private var serverSocket: ServerSocket? = null
    private val isRunning = AtomicBoolean(false)
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .followRedirects(false)
        .followSslRedirects(false)
        .build()

    fun start() {
        if (isRunning.get()) return
        try {
            serverSocket = ServerSocket(port)
            isRunning.set(true)
            Log.i(TAG, "HTTPeek MITM Proxy Server started on port $port")

            scope.launch {
                while (isRunning.get() && !serverSocket!!.isClosed) {
                    try {
                        val clientSocket = serverSocket!!.accept()
                        scope.launch { handleClientConnection(clientSocket) }
                    } catch (e: Exception) {
                        if (!isRunning.get()) break
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start MITM Proxy Server", e)
        }
    }

    fun stop() {
        isRunning.set(false)
        try {
            serverSocket?.close()
        } catch (e: Exception) {}
        scope.cancel()
        Log.i(TAG, "HTTPeek MITM Proxy Server stopped")
    }

    private suspend fun handleClientConnection(clientSocket: Socket) = withContext(Dispatchers.IO) {
        try {
            val input = clientSocket.getInputStream()
            val output = clientSocket.getOutputStream()
            val reader = BufferedReader(InputStreamReader(input))

            val initialLine = reader.readLine() ?: return@withContext
            if (initialLine.isEmpty()) return@withContext

            val parts = initialLine.split(" ")
            if (parts.size < 3) return@withContext

            val method = parts[0].uppercase()
            val uri = parts[1]
            val protocol = parts[2]

            if (method == "CONNECT") {
                // HTTPS Tunneling
                handleHttpsConnect(clientSocket, uri, input, output, reader)
            } else {
                // Plain HTTP
                handlePlainHttp(clientSocket, method, uri, protocol, input, output, reader)
            }
        } catch (e: Exception) {
            // Socket error or client disconnect
        } finally {
            try { clientSocket.close() } catch (e: Exception) {}
        }
    }

    private suspend fun handleHttpsConnect(
        rawSocket: Socket,
        targetHostPort: String,
        rawIn: InputStream,
        rawOut: OutputStream,
        reader: BufferedReader
    ) {
        val hostParts = targetHostPort.split(":")
        val host = hostParts[0]
        val port = if (hostParts.size > 1) hostParts[1].toIntOrNull() ?: 443 else 443

        // Consume remaining CONNECT headers
        var line: String?
        while (reader.readLine().also { line = it } != null) {
            if (line.isNullOrEmpty()) break
        }

        // Send 200 Connection Established to client
        rawOut.write("HTTP/1.1 200 Connection Established\r\n\r\n".toByteArray())
        rawOut.flush()

        // Check Whitelist / Blacklist: if host is bypassed, do transparent raw forwarding
        if (!rulesEngine.shouldInterceptHost(host)) {
            forwardRawTunnel(rawSocket, host, port)
            return
        }

        // Perform dynamic TLS Handshake with client
        try {
            val sslContext = ca.getOrCreateSSLContext(host)
            val sslFactory: SSLSocketFactory = sslContext.socketFactory
            val sslSocket = sslFactory.createSocket(
                rawSocket,
                rawSocket.inetAddress.hostAddress,
                rawSocket.port,
                true
            ) as SSLSocket

            sslSocket.useClientMode = false
            sslSocket.startHandshake()

            val tlsIn = sslSocket.getInputStream()
            val tlsOut = sslSocket.getOutputStream()
            val tlsReader = BufferedReader(InputStreamReader(tlsIn))

            // Read decrypted HTTP request from TLS socket
            val reqLine = tlsReader.readLine() ?: return
            val reqParts = reqLine.split(" ")
            if (reqParts.size < 2) return

            val tlsMethod = reqParts[0].uppercase()
            val tlsPath = reqParts[1]
            val fullUrl = "https://$targetHostPort$tlsPath"

            processAndForwardRequest(
                clientSocket = sslSocket,
                method = tlsMethod,
                url = fullUrl,
                path = tlsPath,
                host = host,
                port = port,
                isSsl = true,
                input = tlsIn,
                output = tlsOut,
                reader = tlsReader
            )
        } catch (e: Exception) {
            Log.w(TAG, "SSL MITM Handshake failed for $host: ${e.message}")
        }
    }

    private suspend fun handlePlainHttp(
        socket: Socket,
        method: String,
        url: String,
        protocol: String,
        input: InputStream,
        output: OutputStream,
        reader: BufferedReader
    ) {
        val fullUrl = if (url.startsWith("http://")) url else "http://$url"
        val host = try {
            java.net.URI(fullUrl).host ?: "unknown"
        } catch (e: Exception) {
            "unknown"
        }

        processAndForwardRequest(
            clientSocket = socket,
            method = method,
            url = fullUrl,
            path = try { java.net.URI(fullUrl).rawPath ?: "/" } catch (e: Exception) { "/" },
            host = host,
            port = 80,
            isSsl = false,
            input = input,
            output = output,
            reader = reader
        )
    }

    private suspend fun processAndForwardRequest(
        clientSocket: Socket,
        method: String,
        url: String,
        path: String,
        host: String,
        port: Int,
        isSsl: Boolean,
        input: InputStream,
        output: OutputStream,
        reader: BufferedReader
    ) = withContext(Dispatchers.IO) {
        val requestId = "req_${System.currentTimeMillis()}_${(1000..9999).random()}"
        val startTimeIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())

        val headers = mutableMapOf<String, MutableList<String>>()
        var contentLength = 0
        var line: String?

        while (reader.readLine().also { line = it } != null) {
            if (line.isNullOrEmpty()) break
            val colonIdx = line!!.indexOf(":")
            if (colonIdx != -1) {
                val k = line!!.substring(0, colonIdx).trim()
                val v = line!!.substring(colonIdx + 1).trim()
                headers.getOrPut(k) { mutableListOf() }.add(v)
                if (k.equals("Content-Length", ignoreCase = true)) {
                    contentLength = v.toIntOrNull() ?: 0
                }
            }
        }

        // Read request body if present
        var bodyString: String? = null
        if (contentLength > 0) {
            val bodyChars = CharArray(contentLength)
            var read = 0
            while (read < contentLength) {
                val r = reader.read(bodyChars, read, contentLength - read)
                if (r == -1) break
                read += r
            }
            bodyString = String(bodyChars, 0, read)
        }

        var reqModel = HttpRequestModel(
            id = requestId,
            method = method,
            url = url,
            path = path,
            hostPort = HostPortModel(host = host, port = port, ssl = isSsl),
            headers = headers,
            bodyString = bodyString,
            startTime = startTimeIso
        )

        // 1. Evaluate Mock Rules
        val mockResp = rulesEngine.evaluateMockRule(reqModel)
        if (mockResp != null) {
            onRequest(reqModel)
            writeResponseToClient(output, mockResp)
            onResponse(mockResp.copy(id = "resp_$requestId"))
            return@withContext
        }

        // 2. Evaluate Rewrite Rules
        reqModel = rulesEngine.evaluateRewriteRequest(reqModel)
        onRequest(reqModel)

        // 3. Forward to Upstream Server via OkHttp
        val startTimeMs = System.currentTimeMillis()
        try {
            val okReqBuilder = Request.Builder().url(reqModel.url)

            // Copy headers
            reqModel.headers?.forEach { (k, vals) ->
                if (!k.equals("Host", ignoreCase = true) && !k.equals("Content-Length", ignoreCase = true)) {
                    vals.forEach { okReqBuilder.addHeader(k, it) }
                }
            }

            // Body
            if (bodyString != null && method != "GET" && method != "HEAD") {
                val cType = reqModel.headers?.get("Content-Type")?.firstOrNull()?.toMediaTypeOrNull()
                okReqBuilder.method(method, bodyString.toRequestBody(cType))
            } else {
                okReqBuilder.method(method, null)
            }

            val resp = okHttpClient.newCall(okReqBuilder.build()).execute()
            val durationMs = System.currentTimeMillis() - startTimeMs

            val respHeaders = mutableMapOf<String, List<String>>()
            resp.headers.names().forEach { name ->
                respHeaders[name] = resp.headers.values(name)
            }

            val respBytes = resp.body?.bytes() ?: ByteArray(0)
            val respBodyStr = if (respBytes.size < 1024 * 1024) String(respBytes) else "[Binary ${respBytes.size} bytes]"

            val respModel = HttpResponseModel(
                id = "resp_$requestId",
                statusCode = resp.code,
                statusText = resp.message.ifEmpty { "OK" },
                headers = respHeaders,
                bodyString = respBodyStr,
                bodySize = respBytes.size.toLong(),
                contentType = resp.header("Content-Type") ?: "text/plain",
                durationMs = durationMs
            )

            // Write back to client
            val statusLine = "HTTP/1.1 ${resp.code} ${resp.message.ifEmpty { "OK" }}\r\n"
            output.write(statusLine.toByteArray())
            respHeaders.forEach { (k, vals) ->
                vals.forEach { v ->
                    output.write("$k: $v\r\n".toByteArray())
                }
            }
            output.write("\r\n".toByteArray())
            if (respBytes.isNotEmpty()) {
                output.write(respBytes)
            }
            output.flush()

            onResponse(respModel)
        } catch (e: Exception) {
            val durationMs = System.currentTimeMillis() - startTimeMs
            val errModel = HttpResponseModel(
                id = "resp_$requestId",
                statusCode = 502,
                statusText = "Bad Gateway: ${e.message}",
                durationMs = durationMs
            )
            output.write("HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n".toByteArray())
            output.flush()
            onResponse(errModel)
        }
    }

    private fun writeResponseToClient(out: OutputStream, resp: HttpResponseModel) {
        val statusLine = "HTTP/1.1 ${resp.statusCode} ${resp.statusText}\r\n"
        out.write(statusLine.toByteArray())
        resp.headers?.forEach { (k, vals) ->
            vals.forEach { out.write("$k: $it\r\n".toByteArray()) }
        }
        val bodyBytes = resp.bodyString?.toByteArray() ?: ByteArray(0)
        out.write("Content-Length: ${bodyBytes.size}\r\n\r\n".toByteArray())
        if (bodyBytes.isNotEmpty()) {
            out.write(bodyBytes)
        }
        out.flush()
    }

    private fun forwardRawTunnel(clientSocket: Socket, host: String, port: Int) {
        try {
            val serverSocket = Socket(host, port)
            val clientIn = clientSocket.getInputStream()
            val clientOut = clientSocket.getOutputStream()
            val serverIn = serverSocket.getInputStream()
            val serverOut = serverSocket.getOutputStream()

            scope.launch {
                try {
                    clientIn.copyTo(serverOut)
                } catch (e: Exception) {}
            }
            scope.launch {
                try {
                    serverIn.copyTo(clientOut)
                } catch (e: Exception) {}
            }
        } catch (e: Exception) {}
    }
}

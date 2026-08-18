package com.httpeek.app.core.proxy

import android.content.Context
import android.util.Log
import com.httpeek.app.HttpeekVpnService
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
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import javax.net.SocketFactory
import javax.net.ssl.SSLSocket
import javax.net.ssl.SSLSocketFactory

/**
 * SocketFactory that ensures all outgoing sockets are protected by Android VpnService,
 * bypassing VPN capture and routing directly to the real physical internet.
 */
class VpnProtectSocketFactory(
    private val defaultFactory: SocketFactory = SocketFactory.getDefault()
) : SocketFactory() {
    override fun createSocket(): Socket {
        val s = defaultFactory.createSocket()
        HttpeekVpnService.protectSocket(s)
        return s
    }

    override fun createSocket(host: String, port: Int): Socket {
        val s = defaultFactory.createSocket(host, port)
        HttpeekVpnService.protectSocket(s)
        return s
    }

    override fun createSocket(host: String, port: Int, localHost: InetAddress, localPort: Int): Socket {
        val s = defaultFactory.createSocket(host, port, localHost, localPort)
        HttpeekVpnService.protectSocket(s)
        return s
    }

    override fun createSocket(host: InetAddress, port: Int): Socket {
        val s = defaultFactory.createSocket(host, port)
        HttpeekVpnService.protectSocket(s)
        return s
    }

    override fun createSocket(address: InetAddress, port: Int, localAddress: InetAddress, localPort: Int): Socket {
        val s = defaultFactory.createSocket(address, port, localAddress, localPort)
        HttpeekVpnService.protectSocket(s)
        return s
    }
}

/**
 * Embedded High-Throughput MITM Proxy Engine for HTTPeek Android.
 * Handles HTTP/1.1 & HTTPS SSL/TLS decryption on-device with protected upstream routing.
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

    var throttleProfile: com.httpeek.app.model.NetworkThrottleProfile = com.httpeek.app.model.NetworkThrottleProfile.UNLIMITED

    private var serverSocket: ServerSocket? = null
    private val isRunning = AtomicBoolean(false)
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private val okHttpClient = OkHttpClient.Builder()
        .socketFactory(VpnProtectSocketFactory())
        .addInterceptor(okhttp3.brotli.BrotliInterceptor)
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
                while (isRunning.get() && serverSocket?.isClosed == false) {
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
                rawSocket.inetAddress?.hostAddress ?: host,
                rawSocket.port,
                true
            ) as SSLSocket

            sslSocket.useClientMode = false
            sslSocket.soTimeout = 7000 // 7s handshake timeout — fail fast if client rejects cert
            sslSocket.startHandshake()
            sslSocket.soTimeout = 0 // Reset to infinite for data transfer

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
            // TLS handshake failed — client rejected our self-signed CA (cert pinning).
            // Pass through transparently to real server.
            Log.w(TAG, "TLS intercept failed for $host:$port (${e.message}) — falling back to raw tunnel")
            forwardRawTunnel(rawSocket, host, port)
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
    ) {
        val requestId = UUID.randomUUID().toString()
        val headers = mutableMapOf<String, MutableList<String>>()
        var contentLength = 0L
        var contentType: String? = null

        // Parse HTTP Headers
        var headerLine: String?
        while (reader.readLine().also { headerLine = it } != null) {
            if (headerLine.isNullOrEmpty()) break
            val colonIdx = headerLine!!.indexOf(':')
            if (colonIdx > 0) {
                val k = headerLine!!.substring(0, colonIdx).trim()
                val v = headerLine!!.substring(colonIdx + 1).trim()
                headers.getOrPut(k) { mutableListOf() }.add(v)

                if (k.equals("content-length", ignoreCase = true)) {
                    contentLength = v.toLongOrNull() ?: 0L
                } else if (k.equals("content-type", ignoreCase = true)) {
                    contentType = v
                }
            }
        }

        // Read Request Body
        var bodyBytes: ByteArray? = null
        if (contentLength > 0 && contentLength < 10 * 1024 * 1024) {
            val buf = ByteArray(contentLength.toInt())
            var read = 0
            while (read < contentLength) {
                val r = input.read(buf, read, (contentLength - read).toInt())
                if (r < 0) break
                read += r
            }
            bodyBytes = buf
        }

        val reqContentEncoding = headers.entries.find { it.key.equals("content-encoding", ignoreCase = true) }?.value?.firstOrNull()
        val decompressedReqBody = DecompressUtils.decompress(bodyBytes, reqContentEncoding)
        val bodyString = DecompressUtils.decodeToString(decompressedReqBody ?: bodyBytes, contentType)

        // Throttling simulation
        if (throttleProfile.dropRate > 0f && Math.random() < throttleProfile.dropRate) {
            output.write("HTTP/1.1 504 Gateway Timeout (Throttled)\r\nContent-Length: 0\r\n\r\n".toByteArray())
            output.flush()
            return
        }
        if (throttleProfile.latencyMs > 0) {
            try { Thread.sleep(throttleProfile.latencyMs) } catch (e: Exception) {}
        }

        val now = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())

        var reqModel = HttpRequestModel(
            id = requestId,
            method = method,
            url = url,
            path = path,
            headers = headers,
            bodyString = bodyString,
            bodyBase64 = if (bodyBytes != null && bodyBytes.isNotEmpty() && (bodyString == null || bodyBytes.size > 1024)) {
                android.util.Base64.encodeToString(bodyBytes, android.util.Base64.NO_WRAP)
            } else null,
            startTime = now,
            hostPort = HostPortModel(host = host, port = port, ssl = isSsl)
        )

        // 1. Evaluate Mock Rules
        val mockResp = rulesEngine.evaluateMockRule(reqModel)
        if (mockResp != null) {
            val finalMockResp = mockResp.copy(id = requestId)
            reqModel.response = finalMockResp
            onRequest(reqModel)
            onResponse(finalMockResp)
            writeResponseToClient(output, finalMockResp, finalMockResp.bodyString?.toByteArray() ?: ByteArray(0))
            return
        }

        // 2. Evaluate URL Rewrite Rules
        reqModel = rulesEngine.evaluateRewriteRequest(reqModel)
        onRequest(reqModel)

        // 3. Forward to Upstream Server via Protected OkHttp Client (with transparent Brotli/Gzip decompression)
        val startTimeMs = System.currentTimeMillis()
        try {
            val forwardUrl = reqModel.url
            val reqBuilder = Request.Builder().url(forwardUrl)

            reqModel.headers?.forEach { (k, vals) ->
                if (!k.equals("host", ignoreCase = true) &&
                    !k.equals("content-length", ignoreCase = true) &&
                    !k.equals("accept-encoding", ignoreCase = true)) {
                    vals.forEach { v -> reqBuilder.addHeader(k, v) }
                }
            }

            val requestBody = if (reqModel.method in listOf("POST", "PUT", "PATCH") && bodyBytes != null) {
                bodyBytes.toRequestBody(contentType?.toMediaTypeOrNull())
            } else if (reqModel.method in listOf("POST", "PUT", "PATCH")) {
                ByteArray(0).toRequestBody(null)
            } else null

            reqBuilder.method(reqModel.method, requestBody)

            val upstreamResp = okHttpClient.newCall(reqBuilder.build()).execute()
            val durationMs = System.currentTimeMillis() - startTimeMs
            val rawBodyBytes = upstreamResp.body?.bytes()
            val contentEncoding = upstreamResp.header("content-encoding")
            val contentTypeHeader = upstreamResp.header("content-type") ?: ""

            // Decompress compressed response bodies (GZIP / Deflate / Brotli)
            val decompressedBytes = DecompressUtils.decompress(rawBodyBytes, contentEncoding)
            val finalBodyBytes = decompressedBytes ?: rawBodyBytes ?: ByteArray(0)
            val respBodyStr = DecompressUtils.decodeToString(finalBodyBytes, contentTypeHeader)

            val isBinary = contentTypeHeader.contains("image/") ||
                           contentTypeHeader.contains("video/") ||
                           contentTypeHeader.contains("audio/") ||
                           contentTypeHeader.contains("application/pdf") ||
                           contentTypeHeader.contains("application/octet-stream") ||
                           contentTypeHeader.contains("application/x-protobuf")

            val respB64 = if (isBinary && finalBodyBytes.isNotEmpty() && finalBodyBytes.size < 5 * 1024 * 1024) {
                android.util.Base64.encodeToString(finalBodyBytes, android.util.Base64.NO_WRAP)
            } else null

            val respHeaders = mutableMapOf<String, List<String>>()
            upstreamResp.headers.names().forEach { name ->
                // Strip Content-Encoding and Content-Length since body is sent as clean decompressed data to client
                if (!name.equals("content-encoding", ignoreCase = true) &&
                    !name.equals("content-length", ignoreCase = true) &&
                    !name.equals("transfer-encoding", ignoreCase = true)) {
                    respHeaders[name] = upstreamResp.headers.values(name)
                }
            }

            val respModel = HttpResponseModel(
                id = requestId,
                statusCode = upstreamResp.code,
                statusText = upstreamResp.message.ifEmpty { "OK" },
                headers = respHeaders,
                bodyString = respBodyStr,
                bodyBase64 = respB64,
                bodySize = finalBodyBytes.size.toLong(),
                contentType = contentTypeHeader,
                durationMs = durationMs
            )

            writeResponseToClient(output, respModel, finalBodyBytes)
            onResponse(respModel)
        } catch (e: Exception) {
            val durationMs = System.currentTimeMillis() - startTimeMs
            val errModel = HttpResponseModel(
                id = requestId,
                statusCode = 502,
                statusText = "Bad Gateway: ${e.message}",
                durationMs = durationMs
            )
            output.write("HTTP/1.1 502 Bad Gateway\r\nContent-Length: 0\r\n\r\n".toByteArray())
            output.flush()
            onResponse(errModel)
        }
    }

    private fun writeResponseToClient(out: OutputStream, resp: HttpResponseModel, bodyBytes: ByteArray) {
        val statusLine = "HTTP/1.1 ${resp.statusCode} ${resp.statusText}\r\n"
        out.write(statusLine.toByteArray())
        resp.headers?.forEach { (k, vals) ->
            vals.forEach { out.write("$k: $it\r\n".toByteArray()) }
        }
        out.write("Content-Length: ${bodyBytes.size}\r\n\r\n".toByteArray())
        if (bodyBytes.isNotEmpty()) {
            out.write(bodyBytes)
        }
        out.flush()
    }

    private fun forwardRawTunnel(clientSocket: Socket, host: String, port: Int) {
        try {
            val serverSocket = Socket()
            HttpeekVpnService.protectSocket(serverSocket)
            serverSocket.connect(InetSocketAddress(host, port), 10000)

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

    /**
     * Like [forwardRawTunnel] but first replays [replayBytes] to the server before relaying live data.
     * Used when TLS intercept fails: the client already sent a TLS ClientHello that we captured via
     * RecordingInputStream. We open a FRESH protected socket to the real server, send the captured
     * bytes (ClientHello + any subsequent TLS records), then continue relaying bidirectionally.
     *
     * This correctly restores internet for apps with certificate pinning (Chrome, Instagram, etc.)
     * without touching the already-dead client SSL socket.
     */
    private fun forwardRawTunnelWithReplay(
        clientSocket: Socket,
        clientOut: OutputStream,
        replayBytes: ByteArray,
        host: String,
        port: Int
    ) {
        try {
            val serverSocket = Socket()
            HttpeekVpnService.protectSocket(serverSocket)
            serverSocket.connect(InetSocketAddress(host, port), 10000)

            val clientIn = clientSocket.getInputStream()
            val serverIn = serverSocket.getInputStream()
            val serverOut = serverSocket.getOutputStream()

            // Replay the captured TLS bytes (ClientHello + any subsequent records)
            if (replayBytes.isNotEmpty()) {
                serverOut.write(replayBytes)
                serverOut.flush()
            }

            // Bidirectional relay: client ↔ server
            scope.launch {
                try {
                    clientIn.copyTo(serverOut)
                } catch (e: Exception) {}
                try { serverSocket.close() } catch (e: Exception) {}
            }
            scope.launch {
                try {
                    serverIn.copyTo(clientOut)
                } catch (e: Exception) {}
                try { clientSocket.close() } catch (e: Exception) {}
            }
        } catch (e: Exception) {
            Log.e(TAG, "forwardRawTunnelWithReplay failed for $host:$port — ${e.message}")
        }
    }
}

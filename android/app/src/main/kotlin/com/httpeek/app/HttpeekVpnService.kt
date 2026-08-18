package com.httpeek.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.ProxyInfo
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.core.app.NotificationCompat
import com.httpeek.app.core.bridge.DesktopBridgeClient
import com.httpeek.app.core.proxy.MitmProxyServer
import com.httpeek.app.core.rules.RulesEngine
import com.httpeek.app.core.vpn.AppFilterManager
import com.httpeek.app.core.vpn.AppFilterMode
import com.httpeek.app.model.HttpRequestModel
import com.httpeek.app.model.HttpResponseModel
import com.httpeek.app.security.DynamicCertAuthority
import java.net.Socket
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Android VpnService for HTTPeek.
 * Sets direct local HTTP proxy routing, protects upstream outgoing sockets,
 * intercepts and decrypts HTTPS traffic, and streams to UI and Desktop Companion Bridge.
 */
class HttpeekVpnService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null
    private val isRunning = AtomicBoolean(false)
    private val capturedCount = AtomicInteger(0)

    private var mitmServer: MitmProxyServer? = null
    private var desktopBridge: DesktopBridgeClient? = null

    companion object {
        const val TAG = "HttpeekVpnService"
        const val NOTIFICATION_CHANNEL_ID = "httpeek_vpn_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "com.httpeek.app.START_VPN"
        const val ACTION_STOP = "com.httpeek.app.STOP_VPN"

        const val EXTRA_DESKTOP_HOST = "extra_desktop_host"
        const val EXTRA_DESKTOP_PORT = "extra_desktop_port"

        var isVpnActive = false
        private var currentInstance: HttpeekVpnService? = null

        // Protects outgoing socket from VPN recursion
        fun protectSocket(socket: Socket): Boolean {
            return currentInstance?.protect(socket) ?: false
        }

        // Listeners for UI updates
        var onRequestCaptured: ((HttpRequestModel) -> Unit)? = null
        var onResponseCaptured: ((HttpResponseModel) -> Unit)? = null
        var onVpnStateChanged: ((Boolean) -> Unit)? = null

        fun startIntent(context: Context, desktopHost: String? = null, desktopPort: Int = 9099): Intent {
            return Intent(context, HttpeekVpnService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_DESKTOP_HOST, desktopHost)
                putExtra(EXTRA_DESKTOP_PORT, desktopPort)
            }
        }

        fun stopIntent(context: Context): Intent {
            return Intent(context, HttpeekVpnService::class.java).apply {
                action = ACTION_STOP
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) return START_NOT_STICKY

        when (intent.action) {
            ACTION_START -> {
                val desktopHost = intent.getStringExtra(EXTRA_DESKTOP_HOST)
                val desktopPort = intent.getIntExtra(EXTRA_DESKTOP_PORT, 9099)
                startVpnCapture(desktopHost, desktopPort)
            }
            ACTION_STOP -> {
                stopVpnCapture()
            }
        }
        return START_STICKY
    }

    private fun startVpnCapture(desktopHost: String?, desktopPort: Int) {
        if (isRunning.get()) return

        currentInstance = this
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("🚀 (•̀ᴗ•́)و HTTPeek Active • 0 requests"))

        try {
            val ca = DynamicCertAuthority(applicationContext)
            val rulesEngine = RulesEngine(applicationContext)
            val appFilterManager = AppFilterManager(applicationContext)

            // Setup Desktop Companion Bridge if host provided
            if (!desktopHost.isNullOrEmpty()) {
                desktopBridge = DesktopBridgeClient(desktopHost, desktopPort)
                desktopBridge?.connect()
            }

            // Setup Embedded Local MITM Engine
            mitmServer = MitmProxyServer(
                context = applicationContext,
                port = 9099,
                ca = ca,
                rulesEngine = rulesEngine,
                onRequest = { req ->
                    val count = capturedCount.incrementAndGet()
                    onRequestCaptured?.invoke(req)
                    desktopBridge?.sendRequest(req)
                    if (count % 5 == 0) {
                        updateNotification("🚀 (•̀ᴗ•́)و HTTPeek Active • $count requests captured")
                    }
                },
                onResponse = { resp ->
                    onResponseCaptured?.invoke(resp)
                    desktopBridge?.sendResponse(resp)
                }
            )
            mitmServer?.start()

            // Build VPN Tunnel
            val builder = Builder()
                .setSession("HTTPeek Interceptor")
                .setMtu(1500)
                .addAddress("10.0.0.2", 32)
                .addDisallowedApplication(packageName) // Prevent proxy recursion

            // Apply Per-App Filter
            val mode = appFilterManager.getFilterMode()
            val selectedApps = appFilterManager.getSelectedPackages()

            if (mode == AppFilterMode.ONLY_SELECTED && selectedApps.isNotEmpty()) {
                for (pkg in selectedApps) {
                    try {
                        builder.addAllowedApplication(pkg)
                    } catch (e: Exception) {}
                }
                Log.i(TAG, "Applied per-app whitelist: ${selectedApps.size} apps")
            } else if (mode == AppFilterMode.EXCLUDE_SELECTED && selectedApps.isNotEmpty()) {
                for (pkg in selectedApps) {
                    try {
                        builder.addDisallowedApplication(pkg)
                    } catch (e: Exception) {}
                }
                Log.i(TAG, "Applied per-app blacklist: ${selectedApps.size} apps")
            }

            // Direct local HTTP/HTTPS proxy routing (Android 10+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                builder.setHttpProxy(ProxyInfo.buildDirectProxy("127.0.0.1", 9099))
            }

            vpnInterface = builder.establish()
            if (vpnInterface == null) {
                Log.e(TAG, "Failed to establish VPN interface")
                stopSelf()
                return
            }

            isRunning.set(true)
            isVpnActive = true
            onVpnStateChanged?.invoke(true)

            Log.i(TAG, "HTTPeek VPN capture started successfully on 127.0.0.1:9099")
        } catch (e: Exception) {
            Log.e(TAG, "Error starting VPN service", e)
            stopSelf()
        }
    }

    private fun stopVpnCapture() {
        isRunning.set(false)
        isVpnActive = false
        currentInstance = null
        onVpnStateChanged?.invoke(false)

        mitmServer?.stop()
        mitmServer = null

        desktopBridge?.disconnect()
        desktopBridge = null

        try {
            vpnInterface?.close()
        } catch (e: Exception) {}
        vpnInterface = null

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        Log.i(TAG, "HTTPeek VPN capture stopped")
    }

    override fun onDestroy() {
        super.onDestroy()
        stopVpnCapture()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "HTTPeek Proxy Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Active network capture and TLS inspection"
                setShowBadge(false)
            }
            val nm = getSystemService(NotificationManager::class.java)
            nm?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(statusText: String): Notification {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pOpen = PendingIntent.getActivity(this, 0, openIntent, PendingIntent.FLAG_IMMUTABLE)

        val stopIntent = Intent(this, HttpeekVpnService::class.java).apply {
            action = ACTION_STOP
        }
        val pStop = PendingIntent.getService(this, 1, stopIntent, PendingIntent.FLAG_IMMUTABLE)

        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("HTTPeek Traffic Interceptor")
            .setContentText(statusText)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setOngoing(true)
            .setContentIntent(pOpen)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop Capture", pStop)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotification(statusText: String) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
        nm?.notify(NOTIFICATION_ID, buildNotification(statusText))
    }
}

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
import java.util.concurrent.atomic.AtomicBoolean

class HttpeekVpnService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null
    private var vpnThread: Thread? = null
    private val isRunning = AtomicBoolean(false)

    companion object {
        const val TAG = "HttpeekVpnService"
        const val NOTIFICATION_CHANNEL_ID = "httpeek_vpn_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "com.httpeek.app.START_VPN"
        const val ACTION_STOP = "com.httpeek.app.STOP_VPN"

        const val EXTRA_PROXY_HOST = "extra_proxy_host"
        const val EXTRA_PROXY_PORT = "extra_proxy_port"
        const val EXTRA_ENABLE_SSL = "extra_enable_ssl"

        var isVpnActive = false

        fun startIntent(context: Context, host: String = "127.0.0.1", port: Int = 9099, enableSSL: Boolean = true): Intent {
            return Intent(context, HttpeekVpnService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_PROXY_HOST, host)
                putExtra(EXTRA_PROXY_PORT, port)
                putExtra(EXTRA_ENABLE_SSL, enableSSL)
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
                val host = intent.getStringExtra(EXTRA_PROXY_HOST) ?: "127.0.0.1"
                val port = intent.getIntExtra(EXTRA_PROXY_PORT, 9099)
                startVpn(host, port)
            }
            ACTION_STOP -> {
                stopVpn()
            }
        }
        return START_STICKY
    }

    private fun startVpn(proxyHost: String, proxyPort: Int) {
        if (isRunning.get()) return

        createNotificationChannel()
        val notification = buildNotification("Proxy Active at $proxyHost:$proxyPort")
        startForeground(NOTIFICATION_ID, notification)

        try {
            val builder = Builder()
                .setSession("HTTPeek")
                .setMtu(1500)
                .addAddress("10.0.0.2", 24)
                .addRoute("0.0.0.0", 0)
                .addDnsServer("8.8.8.8")
                .addDnsServer("1.1.1.1")
                .addDisallowedApplication(packageName)

            // Route device HTTP traffic through the local/remote proxy (API 29+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                builder.setHttpProxy(ProxyInfo.buildDirectProxy(proxyHost, proxyPort))
                Log.i(TAG, "HTTP proxy configured via VPN: $proxyHost:$proxyPort")
            } else {
                Log.w(TAG, "System HTTP proxy via VPN requires Android 10 (API 29)+. Configure proxy manually.")
            }

            vpnInterface = builder.establish()
            if (vpnInterface == null) {
                Log.e(TAG, "Failed to establish VPN interface")
                stopSelf()
                return
            }

            isRunning.set(true)
            isVpnActive = true

            Log.i(TAG, "HTTPeek VPN tunnel established successfully")
        } catch (e: Exception) {
            Log.e(TAG, "Error starting VPN service: ${e.message}", e)
            stopSelf()
        }
    }

    private fun stopVpn() {
        isRunning.set(false)
        isVpnActive = false

        vpnThread?.interrupt()
        vpnThread = null

        try {
            vpnInterface?.close()
        } catch (e: Exception) {
            Log.w(TAG, "Error closing VPN interface", e)
        }
        vpnInterface = null

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        Log.i(TAG, "HTTPeek VPN tunnel stopped")
    }

    override fun onDestroy() {
        super.onDestroy()
        stopVpn()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "HTTPeek Go Proxy Capture",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows real-time HTTPeek proxy capture status"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("HTTPeek Go")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }
}

package com.httpeek.app.core.discovery

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import com.httpeek.app.model.DiscoveredDesktopBeacon
import kotlinx.coroutines.*
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetSocketAddress
import java.util.concurrent.ConcurrentHashMap

/**
 * High-performance LAN ZeroConf / UDP Broadcaster Discovery Listener for HTTPeek.
 * Automatically discovers nearby Desktop instances on local Wi-Fi without typing IPs or scanning QR codes.
 */
class NsdDiscoveryManager(
    private val context: Context,
    private val onDesktopsDiscovered: (List<DiscoveredDesktopBeacon>) -> Unit
) {
    companion object {
        private const val TAG = "NsdDiscoveryManager"
        private const val DISCOVERY_PORT = 9098
    }

    private val discoveredMap = ConcurrentHashMap<String, DiscoveredDesktopBeacon>()
    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var socket: DatagramSocket? = null
    private var isRunning = false

    fun startDiscovery() {
        if (isRunning) return
        isRunning = true

        scope.launch {
            try {
                socket = DatagramSocket(null).apply {
                    reuseAddress = true
                    bind(InetSocketAddress("0.0.0.0", DISCOVERY_PORT))
                    soTimeout = 4000
                }

                val buffer = ByteArray(2048)
                val packet = DatagramPacket(buffer, buffer.size)

                Log.i(TAG, "LAN Discovery Listener active on UDP port $DISCOVERY_PORT")

                while (isActive && isRunning) {
                    try {
                        socket?.receive(packet)
                        val text = String(packet.data, packet.offset, packet.length, Charsets.UTF_8)
                        val senderIp = packet.address?.hostAddress ?: ""

                        if (text.contains("httpeek_companion") || text.contains("service")) {
                            val beacon = gson.fromJson(text, DiscoveredDesktopBeacon::class.java)
                            if (beacon != null && senderIp.isNotEmpty()) {
                                val completeBeacon = beacon.copy(remoteIp = senderIp)
                                val key = "${senderIp}:${beacon.port}"
                                discoveredMap[key] = completeBeacon
                                notifyListeners()
                            }
                        }
                    } catch (e: Exception) {
                        // Socket timeout or transient read error — prune stale beacons older than 15s
                        pruneStaleBeacons()
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Could not bind UDP discovery socket: ${e.message}")
            } finally {
                try { socket?.close() } catch (e: Exception) {}
            }
        }
    }

    fun stopDiscovery() {
        isRunning = false
        try {
            socket?.close()
        } catch (e: Exception) {}
        scope.cancel()
    }

    private fun pruneStaleBeacons() {
        val now = System.currentTimeMillis()
        var changed = false
        val it = discoveredMap.entries.iterator()
        while (it.hasNext()) {
            val entry = it.next()
            if (now - entry.value.timestamp > 15000) {
                it.remove()
                changed = true
            }
        }
        if (changed) {
            notifyListeners()
        }
    }

    private fun notifyListeners() {
        val list = discoveredMap.values.toList().sortedByDescending { it.timestamp }
        withContextNonSuspending {
            onDesktopsDiscovered(list)
        }
    }

    private fun withContextNonSuspending(block: () -> Unit) {
        scope.launch(Dispatchers.Main) {
            block()
        }
    }
}

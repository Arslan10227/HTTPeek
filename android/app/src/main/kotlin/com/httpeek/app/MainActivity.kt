package com.httpeek.app

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.httpeek.app.databinding.ActivityMainBinding
import com.httpeek.app.model.HttpRequestModel
import com.httpeek.app.model.HttpResponseModel
import com.httpeek.app.net.HttpProxyClient
import com.httpeek.app.security.RootCAInstaller
import com.httpeek.app.ui.adapter.RequestAdapter
import com.httpeek.app.ui.inspector.InspectorBottomSheet
import com.httpeek.app.ui.scanner.QrScanActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var adapter: RequestAdapter
    private var proxyClient: HttpProxyClient? = null

    private val allRequests = mutableListOf<HttpRequestModel>()
    private val requestMap = mutableMapOf<String, HttpRequestModel>()
    private val favorites = mutableListOf<HttpRequestModel>()

    private var isVpnRunning = false
    private var isDesktopConnected = false
    private var currentTab = R.id.nav_capture
    private var filterQuery = ""

    private var proxyHost = "127.0.0.1"
    private var proxyPort = 9099

    private val vpnLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            startService(HttpeekVpnService.startIntent(this, proxyHost, proxyPort, true))
            isVpnRunning = true
            updateUIState()
            Toast.makeText(this, "Proxy VPN Active ($proxyHost:$proxyPort)", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "VPN permission denied", Toast.LENGTH_SHORT).show()
        }
    }

    private val qrScanLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val qrResult = result.data?.getStringExtra(QrScanActivity.EXTRA_QR_RESULT)
            if (!qrResult.isNullOrEmpty()) {
                handleQrScanResult(qrResult)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupRecyclerView()
        setupListeners()
        setupWebSocketClient()
        updateUIState()
    }

    private fun setupRecyclerView() {
        adapter = RequestAdapter(
            onItemClick = { request ->
                val sheet = InspectorBottomSheet(request)
                sheet.show(supportFragmentManager, "InspectorBottomSheet")
            },
            onToggleFavorite = { request ->
                request.isFavorite = !request.isFavorite
                if (request.isFavorite) {
                    favorites.add(request)
                } else {
                    favorites.removeAll { it.id == request.id }
                }
                applyFilter()
            }
        )

        binding.recyclerViewRequests.apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = this@MainActivity.adapter
        }
    }

    private fun setupListeners() {
        // Start / Stop VPN Button
        binding.btnToggleProxy.setOnClickListener {
            if (isVpnRunning) {
                stopVpn()
            } else {
                startVpn()
            }
        }

        // Scan QR Button
        binding.btnScanQr.setOnClickListener {
            startQrScanner()
        }

        // Clear Traffic Button
        binding.btnClear.setOnClickListener {
            allRequests.clear()
            requestMap.clear()
            applyFilter()
            Toast.makeText(this, "Traffic cleared", Toast.LENGTH_SHORT).show()
        }

        // Search Filter
        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                filterQuery = s?.toString() ?: ""
                applyFilter()
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        // Bottom Navigation
        binding.bottomNavigation.setOnItemSelectedListener { item ->
            currentTab = item.itemId
            when (item.itemId) {
                R.id.nav_capture -> {
                    applyFilter()
                    true
                }
                R.id.nav_favorites -> {
                    applyFilter()
                    true
                }
                R.id.nav_scan -> {
                    startQrScanner()
                    false
                }
                R.id.nav_ca -> {
                    installRootCA("http://$proxyHost:$proxyPort/api/ca/export")
                    false
                }
                else -> false
            }
        }
    }

    private fun startQrScanner() {
        val intent = Intent(this, QrScanActivity::class.java)
        qrScanLauncher.launch(intent)
    }

    private fun setupWebSocketClient() {
        proxyClient?.disconnect()
        binding.tvConnectionTarget.text = "$proxyHost:$proxyPort"
        proxyClient = HttpProxyClient(
            host = proxyHost,
            port = proxyPort,
            onRequest = { req ->
                runOnUiThread {
                    requestMap[req.id] = req
                    allRequests.add(0, req)
                    applyFilter()
                }
            },
            onResponse = { resp ->
                runOnUiThread {
                    val existing = requestMap[resp.id ?: ""]
                    if (existing != null) {
                        existing.response = resp
                        applyFilter()
                    }
                }
            },
            onConnectionChange = { connected ->
                runOnUiThread {
                    isDesktopConnected = connected
                    updateConnectionStatus()
                }
            }
        )
        proxyClient?.connect()
    }

    private fun updateConnectionStatus() {
        binding.chipDesktopStatus.text = if (isDesktopConnected) {
            "Desktop: Connected"
        } else {
            "Desktop: Disconnected"
        }
        binding.chipDesktopStatus.setTextColor(
            ContextCompat.getColor(
                this,
                if (isDesktopConnected) R.color.status_connected else R.color.status_disconnected
            )
        )

        binding.chipVpnStatus.text = if (isVpnRunning) "VPN: Active" else "VPN: Off"
        binding.chipVpnStatus.setTextColor(
            ContextCompat.getColor(
                this,
                if (isVpnRunning) R.color.status_vpn_active else R.color.text_secondary
            )
        )

        updateEmptyStateCopy()
    }

    private fun updateEmptyStateCopy() {
        binding.tvEmptyTitle.text = when {
            !isDesktopConnected -> "Connect to HTTPeek Desktop"
            !isVpnRunning -> "Ready to Capture"
            else -> "Listening for Traffic"
        }
        binding.tvEmptySubtitle.text = when {
            !isDesktopConnected -> "Scan the QR code from the desktop app to pair this device with $proxyHost:$proxyPort."
            !isVpnRunning -> "Desktop is connected. Tap Start VPN to route device traffic through the proxy."
            else -> "Captured requests will appear here in real time. Tap any row to inspect."
        }
    }

    private fun applyFilter() {
        val baseList = if (currentTab == R.id.nav_favorites) favorites else allRequests
        val filtered = if (filterQuery.isEmpty()) {
            baseList.toList()
        } else {
            val q = filterQuery.lowercase()
            baseList.filter {
                it.url.lowercase().contains(q) ||
                it.path.lowercase().contains(q) ||
                it.method.lowercase().contains(q) ||
                it.hostPort.host.lowercase().contains(q) ||
                it.response?.statusCode?.toString()?.contains(q) == true
            }
        }

        adapter.submitList(filtered)
        binding.layoutEmptyState.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun startVpn() {
        val prepareIntent = VpnService.prepare(this)
        if (prepareIntent != null) {
            vpnLauncher.launch(prepareIntent)
        } else {
            startService(HttpeekVpnService.startIntent(this, proxyHost, proxyPort, true))
            isVpnRunning = true
            updateUIState()
            Toast.makeText(this, "Proxy VPN Active ($proxyHost:$proxyPort)", Toast.LENGTH_SHORT).show()
        }
    }

    private fun stopVpn() {
        startService(HttpeekVpnService.stopIntent(this))
        isVpnRunning = false
        updateUIState()
        Toast.makeText(this, "VPN Capture Stopped", Toast.LENGTH_SHORT).show()
    }

    private fun installRootCA(downloadUrl: String) {
        CoroutineScope(Dispatchers.Main).launch {
            val steps = mutableListOf<com.httpeek.app.security.CertInstallStep>()
            val ok = RootCAInstaller.installWithFallbacks(this@MainActivity, downloadUrl) { step ->
                steps.add(step)
            }
            RootCAInstaller.showStepsToast(this@MainActivity, steps)
            if (!ok) {
                Toast.makeText(
                    this@MainActivity,
                    "Could not install automatically. Try Settings > Security > Install certificate > CA.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    private fun handleQrScanResult(qrPayload: String) {
        try {
            val gson = Gson()
            val json = gson.fromJson(qrPayload, JsonObject::class.java)
            val host = json.get("host")?.asString ?: "127.0.0.1"
            val port = json.get("port")?.asInt ?: 9099
            val caUrl = json.get("caUrl")?.asString ?: "http://$host:$port/api/ca/export"

            proxyHost = host
            proxyPort = port

            // Reconnect WebSocket to desktop instance
            setupWebSocketClient()

            // Show confirmation dialog with automatic CA installation
            AlertDialog.Builder(this)
                .setTitle("Desktop Paired Successfully!")
                .setMessage("Connected to HTTPeek Desktop at $host:$port.\n\nWould you like to install the Root CA certificate for HTTPS inspection?")
                .setPositiveButton("Install CA & Start VPN") { _, _ ->
                    installRootCA(caUrl)
                    startVpn()
                }
                .setNegativeButton("Start VPN Only") { _, _ ->
                    startVpn()
                }
                .setNeutralButton("Cancel", null)
                .show()

        } catch (e: Exception) {
            Toast.makeText(this, "Invalid QR Code: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun updateUIState() {
        if (isVpnRunning) {
            binding.btnToggleProxy.text = "Stop VPN"
            binding.btnToggleProxy.backgroundTintList =
                ContextCompat.getColorStateList(this, R.color.status_5xx)
        } else {
            binding.btnToggleProxy.text = "Start VPN"
            binding.btnToggleProxy.backgroundTintList =
                ContextCompat.getColorStateList(this, R.color.primary)
        }
        updateConnectionStatus()
    }

    override fun onDestroy() {
        super.onDestroy()
        proxyClient?.disconnect()
    }
}

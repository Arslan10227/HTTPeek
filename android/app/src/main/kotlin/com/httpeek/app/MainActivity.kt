package com.httpeek.app

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.EditText
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import com.httpeek.app.core.bridge.DesktopPairingManager
import com.httpeek.app.databinding.ActivityMainBinding
import com.httpeek.app.model.HttpRequestModel
import com.httpeek.app.model.HttpResponseModel
import com.httpeek.app.ui.adapter.RequestAdapter
import com.httpeek.app.ui.apps.AppsFilterDialog
import com.httpeek.app.ui.cert.CertInstallerDialog
import com.httpeek.app.ui.inspector.InspectorBottomSheet
import com.httpeek.app.ui.rules.RulesDialog
import com.httpeek.app.ui.scanner.QrScanActivity
import com.httpeek.app.ui.toolbox.ToolboxDialog

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var adapter: RequestAdapter

    private val allRequests = mutableListOf<HttpRequestModel>()
    private val requestMap = mutableMapOf<String, HttpRequestModel>()
    private val favorites = mutableListOf<HttpRequestModel>()

    private var isVpnRunning = false
    private var isDesktopConnected = false
    private var filterQuery = ""

    private var desktopHost: String? = null
    private var desktopPort: Int = 9099

    private val vpnLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            startService(HttpeekVpnService.startIntent(this, desktopHost, desktopPort))
            isVpnRunning = true
            updateUIState()
            Toast.makeText(this, "HTTPeek VPN Interception Active", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "VPN permission required for traffic capture", Toast.LENGTH_SHORT).show()
        }
    }

    private val qrScanLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val qrResult = result.data?.getStringExtra(QrScanActivity.EXTRA_QR_RESULT)
            if (!qrResult.isNullOrEmpty()) {
                handlePairingInput(qrResult)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupRecyclerView()
        setupListeners()
        setupVpnServiceCallbacks()
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

    private fun setupVpnServiceCallbacks() {
        HttpeekVpnService.onRequestCaptured = { req ->
            runOnUiThread {
                requestMap[req.id] = req
                allRequests.add(0, req)
                applyFilter()
            }
        }

        HttpeekVpnService.onResponseCaptured = { resp ->
            runOnUiThread {
                val reqId = resp.id?.removePrefix("resp_") ?: ""
                val existing = requestMap[reqId] ?: requestMap[resp.id ?: ""]
                if (existing != null) {
                    existing.response = resp
                    applyFilter()
                }
            }
        }

        HttpeekVpnService.onVpnStateChanged = { active ->
            runOnUiThread {
                isVpnRunning = active
                updateUIState()
            }
        }
    }

    private fun setupListeners() {
        // Toggle VPN
        binding.btnToggleProxy.setOnClickListener {
            if (isVpnRunning) {
                stopVpn()
            } else {
                startVpn()
            }
        }

        // Scan QR Button
        binding.btnScanQr.setOnClickListener {
            val intent = Intent(this, QrScanActivity::class.java)
            qrScanLauncher.launch(intent)
        }

        // Click on Connection Target -> Manual IP Pairing Dialog
        binding.tvConnectionTarget.setOnClickListener {
            showManualPairingDialog()
        }

        // Clear traffic
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
            when (item.itemId) {
                R.id.nav_capture -> {
                    applyFilter()
                    true
                }
                R.id.nav_apps -> {
                    AppsFilterDialog().show(supportFragmentManager, "AppsFilterDialog")
                    false
                }
                R.id.nav_rules -> {
                    RulesDialog().show(supportFragmentManager, "RulesDialog")
                    false
                }
                R.id.nav_ca -> {
                    CertInstallerDialog().show(supportFragmentManager, "CertInstallerDialog")
                    false
                }
                R.id.nav_toolbox -> {
                    ToolboxDialog().show(supportFragmentManager, "ToolboxDialog")
                    false
                }
                else -> false
            }
        }
    }

    private fun showManualPairingDialog() {
        val input = EditText(this).apply {
            hint = "e.g. 192.168.1.100:9099"
            setText(desktopHost?.let { "$it:$desktopPort" } ?: "")
        }

        AlertDialog.Builder(this)
            .setTitle("Connect to HTTPeek Desktop")
            .setMessage("Enter Desktop IP address and Port:")
            .setView(input)
            .setPositiveButton("Connect") { _, _ ->
                val str = input.text.toString().trim()
                if (str.isNotEmpty()) {
                    handlePairingInput(str)
                }
            }
            .setNeutralButton("Standalone Mode") { _, _ ->
                desktopHost = null
                binding.tvConnectionTarget.text = "Standalone Mode (127.0.0.1:9099)"
                binding.chipDesktopStatus.text = "Desktop: Standalone"
                Toast.makeText(this, "Operating in standalone on-device mode", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun handlePairingInput(raw: String) {
        val info = DesktopPairingManager.parsePairingString(raw)
        if (info != null) {
            desktopHost = info.host
            desktopPort = info.port
            binding.tvConnectionTarget.text = "Desktop: ${info.host}:${info.port}"
            binding.chipDesktopStatus.text = "Desktop: Paired (${info.host})"

            Toast.makeText(this, "Paired with ${info.host}:${info.port}", Toast.LENGTH_SHORT).show()

            if (!isVpnRunning) {
                startVpn()
            }
        } else {
            Toast.makeText(this, "Invalid IP or QR format", Toast.LENGTH_SHORT).show()
        }
    }

    private fun applyFilter() {
        val filtered = if (filterQuery.isEmpty()) {
            allRequests.toList()
        } else {
            val q = filterQuery.lowercase()
            allRequests.filter {
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
            startService(HttpeekVpnService.startIntent(this, desktopHost, desktopPort))
            isVpnRunning = true
            updateUIState()
            Toast.makeText(this, "HTTPeek VPN Interception Active", Toast.LENGTH_SHORT).show()
        }
    }

    private fun stopVpn() {
        startService(HttpeekVpnService.stopIntent(this))
        isVpnRunning = false
        updateUIState()
        Toast.makeText(this, "VPN Capture Stopped", Toast.LENGTH_SHORT).show()
    }

    private fun updateUIState() {
        if (isVpnRunning) {
            binding.btnToggleProxy.text = "Stop VPN"
            binding.btnToggleProxy.backgroundTintList =
                ContextCompat.getColorStateList(this, R.color.status_5xx)
            binding.chipVpnStatus.text = "VPN: Active (9099)"
            binding.chipVpnStatus.setTextColor(ContextCompat.getColor(this, R.color.status_vpn_active))
        } else {
            binding.btnToggleProxy.text = "Start VPN"
            binding.btnToggleProxy.backgroundTintList =
                ContextCompat.getColorStateList(this, R.color.primary)
            binding.chipVpnStatus.text = "VPN: Off"
            binding.chipVpnStatus.setTextColor(ContextCompat.getColor(this, R.color.text_secondary))
        }
    }
}

package com.httpeek.app.ui.traffic

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.httpeek.app.HttpeekVpnService
import com.httpeek.app.R
import com.httpeek.app.core.bridge.DesktopPairingManager
import com.httpeek.app.databinding.FragmentTrafficBinding
import com.httpeek.app.model.HttpRequestModel
import com.httpeek.app.ui.adapter.RequestAdapter
import com.httpeek.app.ui.inspector.InspectorBottomSheet
import com.httpeek.app.ui.scanner.QrScanActivity
import kotlinx.coroutines.launch

class TrafficFragment : Fragment() {

    private var _binding: FragmentTrafficBinding? = null
    private val binding get() = _binding!!
    private lateinit var adapter: RequestAdapter

    private val allRequests = mutableListOf<HttpRequestModel>()
    private val requestMap = mutableMapOf<String, HttpRequestModel>()
    private var filterQuery = ""
    private var selectedMethod = "ALL"

    private var desktopHost: String? = null
    private var desktopPort: Int = 9099
    private var isVpnRunning = false

    private val vpnLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            activity?.startService(HttpeekVpnService.startIntent(requireContext(), desktopHost, desktopPort))
            isVpnRunning = true
            updateUIState()
            Toast.makeText(requireContext(), "🚀 (•̀ᴗ•́)و Let's Go! HTTPeek VPN Interception is LIVE!", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(requireContext(), "⚠️ (⊙_☉) VPN permission is required to capture network packets!", Toast.LENGTH_SHORT).show()
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

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentTrafficBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerView()
        setupListeners()
        setupVpnServiceCallbacks()
        updateUIState()
    }

    private fun setupRecyclerView() {
        adapter = RequestAdapter(
            onItemClick = { request ->
                val sheet = InspectorBottomSheet(request)
                sheet.show(parentFragmentManager, "InspectorBottomSheet")
            },
            onToggleFavorite = { request ->
                request.isFavorite = !request.isFavorite
                applyFilter()
            }
        )

        binding.recyclerViewRequests.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = this@TrafficFragment.adapter
        }
    }

    private fun setupVpnServiceCallbacks() {
        HttpeekVpnService.onRequestCaptured = { req ->
            activity?.runOnUiThread {
                requestMap[req.id] = req
                allRequests.add(0, req)
                binding.tvRequestCount.text = "${allRequests.size} reqs"
                applyFilter()
            }
        }

        HttpeekVpnService.onResponseCaptured = { resp ->
            activity?.runOnUiThread {
                val reqId = resp.id?.removePrefix("resp_") ?: ""
                val existing = requestMap[reqId] ?: requestMap[resp.id ?: ""]
                if (existing != null) {
                    existing.response = resp
                    applyFilter()
                }
            }
        }

        HttpeekVpnService.onVpnStateChanged = { active ->
            activity?.runOnUiThread {
                isVpnRunning = active
                updateUIState()
            }
        }
    }

    private fun setupListeners() {
        binding.btnToggleProxy.setOnClickListener {
            if (isVpnRunning) stopVpn() else startVpn()
        }

        binding.btnScanQr.setOnClickListener {
            val intent = Intent(requireContext(), QrScanActivity::class.java)
            qrScanLauncher.launch(intent)
        }

        binding.tvConnectionTarget.setOnClickListener {
            showManualPairingDialog()
        }

        binding.btnClear.setOnClickListener {
            allRequests.clear()
            requestMap.clear()
            binding.tvRequestCount.text = "0 reqs"
            applyFilter()
            Toast.makeText(requireContext(), "Traffic cleared", Toast.LENGTH_SHORT).show()
        }

        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                filterQuery = s?.toString() ?: ""
                applyFilter()
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        binding.chipGroupMethods.setOnCheckedStateChangeListener { _, checkedIds ->
            selectedMethod = when (checkedIds.firstOrNull()) {
                R.id.chipMethodGet -> "GET"
                R.id.chipMethodPost -> "POST"
                R.id.chipMethodPut -> "PUT"
                R.id.chipMethodDelete -> "DELETE"
                else -> "ALL"
            }
            applyFilter()
        }
    }

    private fun showManualPairingDialog() {
        val input = EditText(requireContext()).apply {
            hint = "e.g. 192.168.1.100:9099"
            setText(desktopHost?.let { "$it:$desktopPort" } ?: "")
        }

        AlertDialog.Builder(requireContext())
            .setTitle("Connect to HTTPeek Desktop")
            .setMessage("Enter Desktop IP address and Port:")
            .setView(input)
            .setPositiveButton("Connect") { _, _ ->
                val str = input.text.toString().trim()
                if (str.isNotEmpty()) handlePairingInput(str)
            }
            .setNeutralButton("Standalone Mode") { _, _ ->
                desktopHost = null
                binding.tvConnectionTarget.text = "Standalone Mode (127.0.0.1:9099)"
                binding.chipDesktopStatus.text = "Desktop: Standalone"
                Toast.makeText(requireContext(), "💻 (⌐■_■) Operating in standalone local mode", Toast.LENGTH_SHORT).show()
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
            binding.chipDesktopStatus.text = "Desktop: Testing..."

            lifecycleScope.launch {
                val (ok, latency) = DesktopPairingManager.testConnection(info.host, info.port)
                if (ok) {
                    binding.chipDesktopStatus.text = "Desktop: Connected (${latency}ms)"
                    binding.chipDesktopStatus.setTextColor(ContextCompat.getColor(requireContext(), R.color.status_connected))
                    Toast.makeText(requireContext(), "📱⚡ ٩(◕‿◕｡)۶ Paired & Synced with Desktop HTTPeek! Latency: ${latency}ms", Toast.LENGTH_SHORT).show()
                } else {
                    binding.chipDesktopStatus.text = "Desktop: Paired (${info.host})"
                    binding.chipDesktopStatus.setTextColor(ContextCompat.getColor(requireContext(), R.color.status_vpn_active))
                }
            }

            if (isVpnRunning) stopVpn()
            startVpn()
        } else {
            Toast.makeText(requireContext(), "💥 (⊙_☉) Could not parse IP or QR Code: $raw", Toast.LENGTH_LONG).show()
        }
    }

    private fun applyFilter() {
        val filtered = allRequests.filter { req ->
            val matchesQuery = if (filterQuery.isEmpty()) true else {
                val q = filterQuery.lowercase()
                req.url.lowercase().contains(q) ||
                req.path.lowercase().contains(q) ||
                req.method.lowercase().contains(q) ||
                req.hostPort.host.lowercase().contains(q) ||
                req.response?.statusCode?.toString()?.contains(q) == true
            }

            val matchesMethod = if (selectedMethod == "ALL") true else req.method.equals(selectedMethod, ignoreCase = true)
            matchesQuery && matchesMethod
        }

        adapter.submitList(filtered)
        binding.layoutEmptyState.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun startVpn() {
        val prepareIntent = VpnService.prepare(requireContext())
        if (prepareIntent != null) {
            vpnLauncher.launch(prepareIntent)
        } else {
            activity?.startService(HttpeekVpnService.startIntent(requireContext(), desktopHost, desktopPort))
            isVpnRunning = true
            updateUIState()
            Toast.makeText(requireContext(), "🚀 (•̀ᴗ•́)و Let's Go! HTTPeek VPN Interception is LIVE!", Toast.LENGTH_SHORT).show()
        }
    }

    private fun stopVpn() {
        activity?.startService(HttpeekVpnService.stopIntent(requireContext()))
        isVpnRunning = false
        updateUIState()
        Toast.makeText(requireContext(), "🛑 (︶ω︶) Zzz... VPN Interception Stopped!", Toast.LENGTH_SHORT).show()
    }

    private fun updateUIState() {
        if (_binding == null) return
        if (isVpnRunning) {
            binding.btnToggleProxy.text = "Stop VPN"
            binding.btnToggleProxy.backgroundTintList =
                ContextCompat.getColorStateList(requireContext(), R.color.status_5xx)
            binding.chipVpnStatus.text = "VPN: Active (9099)"
            binding.chipVpnStatus.setTextColor(ContextCompat.getColor(requireContext(), R.color.status_vpn_active))
        } else {
            binding.btnToggleProxy.text = "Start VPN"
            binding.btnToggleProxy.backgroundTintList =
                ContextCompat.getColorStateList(requireContext(), R.color.primary)
            binding.chipVpnStatus.text = "VPN: Off"
            binding.chipVpnStatus.setTextColor(ContextCompat.getColor(requireContext(), R.color.text_secondary))
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

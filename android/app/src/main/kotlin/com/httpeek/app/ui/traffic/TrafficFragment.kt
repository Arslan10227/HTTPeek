package com.httpeek.app.ui.traffic

import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
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
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.EditText
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.httpeek.app.HttpeekVpnService
import com.httpeek.app.R
import com.httpeek.app.core.bridge.DesktopPairingHistoryManager
import com.httpeek.app.core.bridge.DesktopPairingInfo
import com.httpeek.app.core.bridge.DesktopPairingManager
import com.httpeek.app.databinding.FragmentTrafficBinding
import com.httpeek.app.model.HttpRequestModel
import com.httpeek.app.ui.adapter.RequestAdapter
import com.httpeek.app.ui.common.LottieToast
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

    private var desktopHost: String? = null
    private var desktopPort: Int = 9099
    private var isVpnRunning = false

    // Pulse animation for the VPN status dot
    private var pulseAnimator: ObjectAnimator? = null

    private val vpnLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            activity?.startService(HttpeekVpnService.startIntent(requireContext(), desktopHost, desktopPort))
            isVpnRunning = true
            updateUIState()
            LottieToast.showRocket(requireContext(), "VPN interception is now LIVE!")
        } else {
            LottieToast.showError(requireContext(), "VPN permission required for packet capture!")
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

        // Restore last connected desktop if present
        val lastConnected = DesktopPairingHistoryManager.getLastConnected(requireContext())
        if (lastConnected != null) {
            desktopHost = lastConnected.host
            desktopPort = lastConnected.port
            updateDesktopStatus(connected = false, label = "${lastConnected.host}:${lastConnected.port}")
        }

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
        binding.rvRequests.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = this@TrafficFragment.adapter
        }
    }

    private fun setupVpnServiceCallbacks() {
        HttpeekVpnService.onRequestCaptured = { req ->
            activity?.runOnUiThread {
                requestMap[req.id] = req
                allRequests.add(0, req)
                val count = allRequests.size
                binding.tvPacketCount.text = "$count request${if (count == 1) "" else "s"} captured"
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
            qrScanLauncher.launch(Intent(requireContext(), QrScanActivity::class.java))
        }

        // Tap desktop chip to open pairing dialog
        binding.chipDesktopContainer.setOnClickListener {
            showManualPairingDialog()
        }

        binding.btnClear.setOnClickListener {
            allRequests.clear()
            requestMap.clear()
            binding.tvPacketCount.text = "Interceptor ready"
            applyFilter()
            LottieToast.showWink(requireContext(), "Traffic list cleared!")
        }

        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                filterQuery = s?.toString() ?: ""
                applyFilter()
            }
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    private fun showManualPairingDialog() {
        val ctx = requireContext()
        val history = DesktopPairingHistoryManager.getRecentConnections(ctx)

        val builder = AlertDialog.Builder(ctx)
        val view = layoutInflater.inflate(android.R.layout.select_dialog_item, null)

        val input = EditText(ctx).apply {
            hint = "e.g. 192.168.1.100:9099"
            setText(desktopHost?.let { "$it:$desktopPort" } ?: "")
            setPadding(40, 30, 40, 30)
        }

        if (history.isNotEmpty()) {
            val fullOptionsList = mutableListOf<CharSequence>("⌨️ Custom Host / Port…", "📱 Standalone Mode (No Desktop)")
            history.forEach { info ->
                fullOptionsList.add("💻 ${info.host}:${info.port}")
            }
            val fullOptions = fullOptionsList.toTypedArray()

            builder.setTitle("Desktop Companion Pairing")
                .setItems(fullOptions) { _, which ->
                    when (which) {
                        0 -> showCustomHostInputDialog()
                        1 -> {
                            desktopHost = null
                            DesktopPairingHistoryManager.clearActiveConnection(ctx)
                            updateDesktopStatus(connected = false, label = "Standalone")
                            LottieToast.showWink(ctx, "Running in standalone local mode")
                            if (isVpnRunning) {
                                stopVpn()
                                startVpn()
                            }
                        }
                        else -> {
                            val selected = history[which - 2]
                            handlePairingInput("${selected.host}:${selected.port}")
                        }
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        } else {
            showCustomHostInputDialog()
        }
    }

    private fun showCustomHostInputDialog() {
        val ctx = requireContext()
        val input = EditText(ctx).apply {
            hint = "e.g. 192.168.1.100:9099"
            setText(desktopHost?.let { "$it:$desktopPort" } ?: "")
        }

        AlertDialog.Builder(ctx)
            .setTitle("Connect to HTTPeek Desktop")
            .setMessage("Enter Desktop IP address and Port:")
            .setView(input)
            .setPositiveButton("Connect") { _, _ ->
                val str = input.text.toString().trim()
                if (str.isNotEmpty()) handlePairingInput(str)
            }
            .setNeutralButton("Standalone") { _, _ ->
                desktopHost = null
                DesktopPairingHistoryManager.clearActiveConnection(ctx)
                updateDesktopStatus(connected = false, label = "Standalone")
                LottieToast.showWink(ctx, "Running in standalone local mode")
                if (isVpnRunning) {
                    stopVpn()
                    startVpn()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun handlePairingInput(raw: String) {
        val ctx = requireContext()
        val info = DesktopPairingManager.parsePairingString(raw)
        if (info != null) {
            desktopHost = info.host
            desktopPort = info.port
            updateDesktopStatus(connected = false, label = "Testing…")

            DesktopPairingHistoryManager.saveConnection(ctx, info)

            lifecycleScope.launch {
                val (ok, latency) = DesktopPairingManager.testConnection(info.host, info.port)
                if (ok) {
                    updateDesktopStatus(connected = true, label = "${info.host} (${latency}ms)")
                    LottieToast.showSuccess(ctx, "Paired with Desktop! ${latency}ms latency")
                } else {
                    updateDesktopStatus(connected = false, label = "${info.host}:${info.port}")
                    LottieToast.showShield(ctx, "Desktop saved — connect when on same Wi-Fi")
                }
            }

            if (isVpnRunning) stopVpn()
            startVpn()
        } else {
            LottieToast.showError(ctx, "Could not parse pairing info: $raw")
        }
    }

    private fun applyFilter() {
        val filtered = allRequests.filter { req ->
            if (filterQuery.isEmpty()) true else {
                val q = filterQuery.lowercase()
                req.url.lowercase().contains(q) ||
                req.path.lowercase().contains(q) ||
                req.method.lowercase().contains(q) ||
                req.hostPort.host.lowercase().contains(q) ||
                req.response?.statusCode?.toString()?.contains(q) == true
            }
        }

        adapter.submitList(filtered)

        // Toggle empty state vs list
        val empty = filtered.isEmpty()
        binding.emptyState.visibility = if (empty) View.VISIBLE else View.GONE
        binding.rvRequests.visibility = if (empty) View.GONE else View.VISIBLE
    }

    private fun startVpn() {
        val prepareIntent = VpnService.prepare(requireContext())
        if (prepareIntent != null) {
            vpnLauncher.launch(prepareIntent)
        } else {
            activity?.startService(HttpeekVpnService.startIntent(requireContext(), desktopHost, desktopPort))
            isVpnRunning = true
            updateUIState()
            LottieToast.showRocket(requireContext(), "VPN interception is now LIVE!")
        }
    }

    private fun stopVpn() {
        activity?.startService(HttpeekVpnService.stopIntent(requireContext()))
        isVpnRunning = false
        updateUIState()
        LottieToast.showWink(requireContext(), "VPN interception stopped")
    }

    private fun updateUIState() {
        if (_binding == null) return

        if (isVpnRunning) {
            // VPN Active state
            binding.btnToggleProxy.text = "Stop"
            binding.btnToggleProxy.backgroundTintList =
                ContextCompat.getColorStateList(requireContext(), R.color.error)
            binding.tvVpnStatus.text = "VPN Active · :9099"
            binding.tvVpnStatus.setTextColor(ContextCompat.getColor(requireContext(), R.color.status_vpn_active))
            binding.pulseDot.setBackgroundResource(R.drawable.dot_active)
            binding.chipVpnContainer.backgroundTintList =
                ContextCompat.getColorStateList(requireContext(), R.color.status_connected)
            startPulseAnimation()
        } else {
            // VPN Off state
            binding.btnToggleProxy.text = "Start"
            binding.btnToggleProxy.backgroundTintList =
                ContextCompat.getColorStateList(requireContext(), R.color.primary)
            binding.tvVpnStatus.text = "VPN Off"
            binding.tvVpnStatus.setTextColor(ContextCompat.getColor(requireContext(), R.color.text_secondary))
            binding.pulseDot.setBackgroundResource(R.drawable.dot_idle)
            binding.chipVpnContainer.backgroundTintList = null
            stopPulseAnimation()
        }
    }

    private fun updateDesktopStatus(connected: Boolean, label: String) {
        if (_binding == null) return
        binding.tvDesktopStatus.text = label
        if (connected) {
            binding.tvDesktopStatus.setTextColor(ContextCompat.getColor(requireContext(), R.color.status_connected))
            binding.ivDesktopIcon.setColorFilter(ContextCompat.getColor(requireContext(), R.color.status_connected))
        } else {
            binding.tvDesktopStatus.setTextColor(ContextCompat.getColor(requireContext(), R.color.text_secondary))
            binding.ivDesktopIcon.setColorFilter(ContextCompat.getColor(requireContext(), R.color.text_muted))
        }
    }

    private fun startPulseAnimation() {
        pulseAnimator?.cancel()
        val scaleX = PropertyValuesHolder.ofFloat("scaleX", 1f, 1.4f, 1f)
        val scaleY = PropertyValuesHolder.ofFloat("scaleY", 1f, 1.4f, 1f)
        val alpha = PropertyValuesHolder.ofFloat("alpha", 1f, 0.4f, 1f)
        pulseAnimator = ObjectAnimator.ofPropertyValuesHolder(binding.pulseDot, scaleX, scaleY, alpha).apply {
            duration = 1200
            repeatCount = ObjectAnimator.INFINITE
            interpolator = AccelerateDecelerateInterpolator()
            start()
        }
    }

    private fun stopPulseAnimation() {
        pulseAnimator?.cancel()
        pulseAnimator = null
        binding.pulseDot.alpha = 1f
        binding.pulseDot.scaleX = 1f
        binding.pulseDot.scaleY = 1f
    }

    override fun onDestroyView() {
        super.onDestroyView()
        stopPulseAnimation()
        _binding = null
    }
}

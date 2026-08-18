package com.httpeek.app.ui.cert

import android.app.AlertDialog
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import com.httpeek.app.R
import com.httpeek.app.databinding.FragmentSslBinding
import com.httpeek.app.security.DynamicCertAuthority
import com.httpeek.app.security.RootCAInstaller
import com.httpeek.app.ui.common.LottieToast
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class SslFragment : Fragment() {

    private var _binding: FragmentSslBinding? = null
    private val binding get() = _binding!!

    private lateinit var ca: DynamicCertAuthority
    private val bypassDomains = mutableListOf<String>()
    private lateinit var bypassAdapter: BypassDomainAdapter
    private val gson = Gson()
    private var isQrVisible = false

    companion object {
        private const val PREFS_SSL = "httpeek_ssl_prefs"
        private const val KEY_BYPASS_DOMAINS = "bypass_domains"
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentSslBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        ca = DynamicCertAuthority(requireContext())

        loadBypassPreferences()
        updateCaStatusUI()
        setupButtons()
        setupBypassList()
    }

    private fun loadBypassPreferences() {
        val prefs = requireContext().getSharedPreferences(PREFS_SSL, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY_BYPASS_DOMAINS, null)
        if (json != null) {
            try {
                val list: List<String> = gson.fromJson(json, object : TypeToken<List<String>>() {}.type)
                bypassDomains.clear()
                bypassDomains.addAll(list)
            } catch (e: Exception) {}
        } else {
            bypassDomains.addAll(listOf("*.apple.com", "*.icloud.com", "*.google.com", "*.googleapis.com"))
        }
    }

    private fun saveBypassDomains() {
        val prefs = requireContext().getSharedPreferences(PREFS_SSL, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_BYPASS_DOMAINS, gson.toJson(bypassDomains)).apply()
    }

    private fun updateCaStatusUI() {
        val isRooted = RootCAInstaller.isDeviceRooted()
        val hash = ca.getOldSubjectHash()

        if (hash.isNotEmpty() && hash != "00000000") {
            binding.tvCaStatus.text = "Root CA Ready ($hash.0)"
            val subjectText = if (isRooted) {
                "⚡ Root active (Magisk/KernelSU). System store injection supported."
            } else {
                "🛡️ User trust store ready. Install certificate below to decrypt."
            }
            binding.tvCaSubject.text = subjectText
            binding.btnGenerateCa.text = "Regenerate Root CA"
            binding.btnGenerateCa.icon = ContextCompat.getDrawable(requireContext(), android.R.drawable.ic_menu_rotate)
        } else {
            binding.tvCaStatus.text = "CA Not Initialized"
            binding.tvCaSubject.text = "Tap 'Generate Root CA' to create your local Certificate Authority."
            binding.btnGenerateCa.text = "Generate Root CA"
        }
    }

    private fun setupButtons() {
        binding.btnRefreshCa.setOnClickListener {
            generateOrRegenerateCa()
        }

        binding.btnGenerateCa.setOnClickListener {
            generateOrRegenerateCa()
        }

        binding.btnInstallUserCert.setOnClickListener {
            installUserStoreCert()
        }

        binding.btnInstallRootCert.setOnClickListener {
            installRootStoreCert()
        }

        binding.btnShowQr.setOnClickListener {
            toggleQrCode()
        }

        binding.btnAddBypass.setOnClickListener {
            showAddBypassDialog()
        }
    }

    private fun generateOrRegenerateCa() {
        lifecycleScope.launch {
            try {
                ca.regenerateRootCA()
                updateCaStatusUI()
                LottieToast.showRocket(requireContext(), "🎉 New Root CA generated successfully!")
                if (isQrVisible) generateQrCodeBitmap()
            } catch (e: Exception) {
                LottieToast.showError(requireContext(), "Error generating CA: ${e.message}")
            }
        }
    }

    private fun installUserStoreCert() {
        val ctx = requireContext()
        val bytes = ca.getRootCADerBytes()
        if (bytes != null && bytes.isNotEmpty()) {
            lifecycleScope.launch {
                RootCAInstaller.installToUserStore(ctx, bytes) { step ->
                    // Installation progress
                }
                LottieToast.showShield(ctx, "🔑 KeyChain opened! Set certificate name to 'HTTPeek CA'.")
            }
        } else {
            LottieToast.showError(ctx, "Generate Root CA first before installing.")
        }
    }

    private fun installRootStoreCert() {
        val ctx = requireContext()
        if (!RootCAInstaller.isDeviceRooted()) {
            LottieToast.showWink(ctx, "⚠️ Root access not detected. Use User Store method instead.")
            return
        }

        lifecycleScope.launch {
            try {
                binding.btnInstallRootCert.isEnabled = false
                val success = RootCAInstaller.installToSystemStoreWithRoot(ctx, ca) { step ->
                    // step progress
                }
                if (success) {
                    LottieToast.showRocket(ctx, "👑 System CA Module injected! Reboot device to activate.")
                } else {
                    LottieToast.showWink(ctx, "⚠️ Module installed. Reboot to apply changes.")
                }
            } catch (e: Exception) {
                LottieToast.showError(ctx, "Root install failed: ${e.message}")
            } finally {
                binding.btnInstallRootCert.isEnabled = true
            }
        }
    }

    private fun toggleQrCode() {
        isQrVisible = !isQrVisible
        if (isQrVisible) {
            binding.ivQrCode.visibility = View.VISIBLE
            binding.tvCertUrl.visibility = View.VISIBLE
            binding.btnShowQr.text = "Hide QR Code"
            generateQrCodeBitmap()
        } else {
            binding.ivQrCode.visibility = View.GONE
            binding.tvCertUrl.visibility = View.GONE
            binding.btnShowQr.text = "Show QR Code"
        }
    }

    private fun generateQrCodeBitmap() {
        val downloadUrl = "http://httpeek.local:9099/ca.crt"
        binding.tvCertUrl.text = downloadUrl

        lifecycleScope.launch(Dispatchers.Default) {
            try {
                val writer = QRCodeWriter()
                val bitMatrix = writer.encode(downloadUrl, BarcodeFormat.QR_CODE, 400, 400)
                val width = bitMatrix.width
                val height = bitMatrix.height
                val bmp = Bitmap.createBitmap(width, height, Bitmap.Config.RGB_565)
                for (x in 0 until width) {
                    for (y in 0 until height) {
                        bmp.setPixel(x, y, if (bitMatrix.get(x, y)) Color.BLACK else Color.WHITE)
                    }
                }
                withContext(Dispatchers.Main) {
                    binding.ivQrCode.setImageBitmap(bmp)
                }
            } catch (e: Exception) {}
        }
    }

    private fun showAddBypassDialog() {
        val input = EditText(requireContext()).apply {
            hint = "e.g. *.apple.com or example.com"
        }

        AlertDialog.Builder(requireContext())
            .setTitle("Add SSL Bypass Domain")
            .setMessage("Traffic to this domain will bypass HTTPS decryption and pass transparently:")
            .setView(input)
            .setPositiveButton("Add") { _, _ ->
                val domain = input.text.toString().trim().lowercase()
                if (domain.isNotEmpty() && !bypassDomains.contains(domain)) {
                    bypassDomains.add(0, domain)
                    saveBypassDomains()
                    bypassAdapter.notifyItemInserted(0)
                    binding.rvBypassDomains.scrollToPosition(0)
                    LottieToast.showSuccess(requireContext(), "Domain $domain bypassed")
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun setupBypassList() {
        bypassAdapter = BypassDomainAdapter(bypassDomains) { domain ->
            val idx = bypassDomains.indexOf(domain)
            if (idx >= 0) {
                bypassDomains.removeAt(idx)
                saveBypassDomains()
                bypassAdapter.notifyItemRemoved(idx)
                LottieToast.showWink(requireContext(), "Removed $domain from bypass")
            }
        }

        binding.rvBypassDomains.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = bypassAdapter
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    class BypassDomainAdapter(
        private val items: List<String>,
        private val onDelete: (String) -> Unit
    ) : RecyclerView.Adapter<BypassDomainAdapter.ViewHolder>() {

        class ViewHolder(v: View) : RecyclerView.ViewHolder(v) {
            val name: TextView = v.findViewById(R.id.tvDomainName)
            val btnDel: View = v.findViewById(R.id.btnDeleteDomain)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
            val v = LayoutInflater.from(parent.context).inflate(R.layout.item_bypass_domain, parent, false)
            return ViewHolder(v)
        }

        override fun onBindViewHolder(holder: ViewHolder, position: Int) {
            val item = items[position]
            holder.name.text = item
            holder.btnDel.setOnClickListener { onDelete(item) }
        }

        override fun getItemCount(): Int = items.size
    }
}

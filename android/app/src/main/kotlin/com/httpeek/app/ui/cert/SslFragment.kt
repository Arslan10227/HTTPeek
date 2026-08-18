package com.httpeek.app.ui.cert

import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.httpeek.app.R
import com.httpeek.app.databinding.FragmentSslBinding
import com.httpeek.app.security.DynamicCertAuthority
import com.httpeek.app.security.RootCAInstaller
import com.httpeek.app.ui.common.LottieToast
import kotlinx.coroutines.launch

class SslFragment : Fragment() {

    private var _binding: FragmentSslBinding? = null
    private val binding get() = _binding!!

    private lateinit var ca: DynamicCertAuthority
    private val bypassDomains = mutableListOf<String>()
    private lateinit var bypassAdapter: BypassDomainAdapter
    private val gson = Gson()
    private var isDeviceRooted = false

    companion object {
        private const val PREFS_SSL = "httpeek_ssl_prefs"
        private const val KEY_SSL_ENABLED = "ssl_enabled"
        private const val KEY_BYPASS_DOMAINS = "bypass_domains"
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentSslBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val ctx = requireContext()
        ca = DynamicCertAuthority(ctx)

        loadSslPreferences()
        setupCertInfo()
        setupSmartHeroInstaller()
        setupFallbackButtons()
        setupBypassList()
    }

    private fun loadSslPreferences() {
        val prefs = requireContext().getSharedPreferences(PREFS_SSL, Context.MODE_PRIVATE)
        binding.switchSslDecryption.isChecked = prefs.getBoolean(KEY_SSL_ENABLED, true)

        binding.switchSslDecryption.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(KEY_SSL_ENABLED, isChecked).apply()
            if (isChecked) {
                LottieToast.showSuccess(requireContext(), "🔓 HTTPS MITM Decryption Enabled!")
            } else {
                LottieToast.showShield(requireContext(), "🔒 Passthrough Active (Decryption disabled)")
            }
        }

        val json = prefs.getString(KEY_BYPASS_DOMAINS, null)
        if (json != null) {
            try {
                val list: List<String> = gson.fromJson(json, object : TypeToken<List<String>>() {}.type)
                bypassDomains.clear()
                bypassDomains.addAll(list)
            } catch (e: Exception) {}
        } else {
            bypassDomains.addAll(listOf("*.apple.com", "*.icloud.com", "*.google.com"))
        }
    }

    private fun saveBypassDomains() {
        val prefs = requireContext().getSharedPreferences(PREFS_SSL, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_BYPASS_DOMAINS, gson.toJson(bypassDomains)).apply()
    }

    private fun setupCertInfo() {
        val hash = ca.getOldSubjectHash()
        binding.tvCertHash.text = "$hash.0"

        isDeviceRooted = RootCAInstaller.isDeviceRooted()
        if (isDeviceRooted) {
            binding.tvRootStatus.text = "⚡ Root Detected! (Magisk / KernelSU active)"
            binding.btnHeroInstall.text = "👑 1-Tap Install System Root CA (Magisk Module)"
            binding.tvHeroSubtitle.text = "Directly overlays into system trust store for 100% full app capture."
            binding.btnHeroInstall.backgroundTintList = ContextCompat.getColorStateList(requireContext(), R.color.primary)
        } else {
            binding.tvRootStatus.text = "🛡️ Non-Root Mode (Android KeyChain User Store)"
            binding.btnHeroInstall.text = "🔑 1-Tap Install to User Store (KeyChain)"
            binding.tvHeroSubtitle.text = "Installs to Android KeyChain credentials for user-cert supporting apps."
            binding.btnHeroInstall.backgroundTintList = ContextCompat.getColorStateList(requireContext(), R.color.status_connected)
        }
    }

    private fun setupSmartHeroInstaller() {
        binding.btnHeroInstall.setOnClickListener {
            if (isDeviceRooted) {
                installRootModule()
            } else {
                installUserKeyChain()
            }
        }
    }

    private fun installRootModule() {
        val ctx = requireContext()
        binding.btnHeroInstall.isEnabled = false
        binding.btnInstallMagiskRoot.isEnabled = false
        binding.tvCertStatus.text = "⏳ Injecting CA module via Superuser shell..."

        lifecycleScope.launch {
            try {
                val success = RootCAInstaller.installToSystemStoreWithRoot(ctx, ca) { step ->
                    binding.tvCertStatus.text = "• ${step.message}"
                }
                if (success) {
                    LottieToast.showRocket(ctx, "👑 System CA Module Installed! Reboot device to activate.")
                } else {
                    LottieToast.showWink(ctx, "⚠️ Root module created. Check steps above.")
                }
            } catch (e: Exception) {
                binding.tvCertStatus.text = "💥 Error: ${e.localizedMessage}"
                LottieToast.showError(ctx, "Root installation error: ${e.message}")
            } finally {
                binding.btnHeroInstall.isEnabled = true
                binding.btnInstallMagiskRoot.isEnabled = true
            }
        }
    }

    private fun installUserKeyChain() {
        val ctx = requireContext()
        val bytes = ca.getRootCADerBytes()
        if (bytes != null) {
            lifecycleScope.launch {
                RootCAInstaller.installToUserStore(ctx, bytes) { step ->
                    binding.tvCertStatus.text = "• ${step.message}"
                }
                LottieToast.showShield(ctx, "🔑 KeyChain opened! Set cert name to 'HTTPeek CA'.")
            }
        } else {
            LottieToast.showError(ctx, "💥 CA Certificate not initialized yet!")
        }
    }

    private fun setupFallbackButtons() {
        val ctx = requireContext()

        binding.btnInstallKeyChain.setOnClickListener {
            installUserKeyChain()
        }

        binding.btnInstallMagiskRoot.setOnClickListener {
            installRootModule()
        }

        binding.btnSaveDownloads.setOnClickListener {
            lifecycleScope.launch {
                val bytes = ca.getRootCADerBytes()
                if (bytes != null) {
                    val uri = RootCAInstaller.saveToDownloadsFolder(ctx, bytes) { step ->
                        binding.tvCertStatus.text = "• ${step.message}"
                    }
                    if (uri != null) {
                        LottieToast.showSuccess(ctx, "💾 Saved to Downloads/httpeek-root-ca.crt!")
                    }
                }
            }
        }

        binding.btnOpenSecuritySettings.setOnClickListener {
            lifecycleScope.launch {
                RootCAInstaller.openSecuritySettings(ctx) { step ->
                    binding.tvCertStatus.text = "• ${step.message}"
                }
                LottieToast.showWink(ctx, "⚙️ Opening Android Security Settings...")
            }
        }

        binding.btnCopyAdbScript.setOnClickListener {
            val cmd = RootCAInstaller.copyAdbCommandToClipboard(ctx, ca)
            binding.tvCertStatus.text = "• Copied ADB command:\n$cmd"
            LottieToast.showSuccess(ctx, "📋 ADB Command Copied to Clipboard!")
        }
    }

    private fun setupBypassList() {
        bypassAdapter = BypassDomainAdapter(bypassDomains) { domain ->
            bypassDomains.remove(domain)
            saveBypassDomains()
            bypassAdapter.notifyDataSetChanged()
            LottieToast.showWink(requireContext(), "🗑️ Removed $domain from bypass list")
        }

        binding.recyclerBypassDomains.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = bypassAdapter
        }

        binding.btnAddBypassDomain.setOnClickListener {
            val domain = binding.etBypassDomain.text.toString().trim().lowercase()
            if (domain.isNotEmpty() && !bypassDomains.contains(domain)) {
                bypassDomains.add(0, domain)
                saveBypassDomains()
                bypassAdapter.notifyDataSetChanged()
                binding.etBypassDomain.setText("")
                LottieToast.showRocket(requireContext(), "💨 Bypassed $domain from TLS decryption!")
            }
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

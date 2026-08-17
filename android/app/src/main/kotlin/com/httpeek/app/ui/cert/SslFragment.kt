package com.httpeek.app.ui.cert

import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
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
import kotlinx.coroutines.launch

class SslFragment : Fragment() {

    private var _binding: FragmentSslBinding? = null
    private val binding get() = _binding!!

    private lateinit var ca: DynamicCertAuthority
    private val bypassDomains = mutableListOf<String>()
    private lateinit var bypassAdapter: BypassDomainAdapter
    private val gson = Gson()

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
        setupFallbackButtons()
        setupBypassList()
    }

    private fun loadSslPreferences() {
        val prefs = requireContext().getSharedPreferences(PREFS_SSL, Context.MODE_PRIVATE)
        binding.switchSslDecryption.isChecked = prefs.getBoolean(KEY_SSL_ENABLED, true)

        binding.switchSslDecryption.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(KEY_SSL_ENABLED, isChecked).apply()
            Toast.makeText(requireContext(), if (isChecked) "HTTPS Decryption Enabled" else "HTTPS Decryption Disabled (Passthrough)", Toast.LENGTH_SHORT).show()
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

        val isRooted = RootCAInstaller.isDeviceRooted()
        if (isRooted) {
            binding.tvRootStatus.text = "⚡ Root Access: Active (Magisk / KernelSU detected)"
            binding.btnInstallMagiskRoot.isEnabled = true
        } else {
            binding.tvRootStatus.text = "ℹ️ Root Access: Not detected (Use Tier 1 or Tier 3)"
            binding.btnInstallMagiskRoot.text = "2. Install via Root (Requires Root)"
        }
    }

    private fun setupFallbackButtons() {
        val ctx = requireContext()

        binding.btnInstallKeyChain.setOnClickListener {
            val bytes = ca.getRootCADerBytes()
            if (bytes != null) {
                lifecycleScope.launch {
                    RootCAInstaller.installToUserStore(ctx, bytes) { step ->
                        binding.tvCertStatus.text = "• ${step.message}"
                    }
                }
            } else {
                Toast.makeText(ctx, "CA Certificate not initialized", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnInstallMagiskRoot.setOnClickListener {
            binding.btnInstallMagiskRoot.isEnabled = false
            binding.tvCertStatus.text = "Executing superuser installation..."
            lifecycleScope.launch {
                try {
                    val success = RootCAInstaller.installToSystemStoreWithRoot(ctx, ca) { step ->
                        binding.tvCertStatus.text = "• ${step.message}"
                    }
                    if (success) {
                        Toast.makeText(ctx, "System CA Module Installed! Reboot device for full effect.", Toast.LENGTH_LONG).show()
                    }
                } catch (e: Exception) {
                    binding.tvCertStatus.text = "• Error: ${e.localizedMessage}"
                } finally {
                    binding.btnInstallMagiskRoot.isEnabled = true
                }
            }
        }

        binding.btnSaveDownloads.setOnClickListener {
            lifecycleScope.launch {
                val bytes = ca.getRootCADerBytes()
                if (bytes != null) {
                    val uri = RootCAInstaller.saveToDownloadsFolder(ctx, bytes) { step ->
                        binding.tvCertStatus.text = "• ${step.message}"
                    }
                    if (uri != null) {
                        Toast.makeText(ctx, "Saved to Downloads/httpeek-root-ca.crt", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }

        binding.btnOpenSecuritySettings.setOnClickListener {
            lifecycleScope.launch {
                RootCAInstaller.openSecuritySettings(ctx) { step ->
                    binding.tvCertStatus.text = "• ${step.message}"
                }
            }
        }

        binding.btnCopyAdbScript.setOnClickListener {
            val cmd = RootCAInstaller.copyAdbCommandToClipboard(ctx, ca)
            binding.tvCertStatus.text = "• Copied ADB command:\n$cmd"
            Toast.makeText(ctx, "ADB Command Copied", Toast.LENGTH_SHORT).show()
        }
    }

    private fun setupBypassList() {
        bypassAdapter = BypassDomainAdapter(bypassDomains) { domain ->
            bypassDomains.remove(domain)
            saveBypassDomains()
            bypassAdapter.notifyDataSetChanged()
            Toast.makeText(requireContext(), "Removed $domain from bypass list", Toast.LENGTH_SHORT).show()
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
                Toast.makeText(requireContext(), "Added $domain to bypass list", Toast.LENGTH_SHORT).show()
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

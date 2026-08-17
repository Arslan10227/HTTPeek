package com.httpeek.app.ui.cert

import android.app.Dialog
import android.os.Bundle
import android.view.LayoutInflater
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.lifecycleScope
import com.httpeek.app.R
import com.httpeek.app.security.DynamicCertAuthority
import com.httpeek.app.security.RootCAInstaller
import kotlinx.coroutines.launch

class CertInstallerDialog : DialogFragment() {

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val ctx = requireContext()
        val ca = DynamicCertAuthority(ctx)
        val view = LayoutInflater.from(ctx).inflate(R.layout.dialog_cert_installer, null)

        val tvHash = view.findViewById<TextView>(R.id.tvCertHash)
        val tvRootStatus = view.findViewById<TextView>(R.id.tvRootStatus)
        val tvStatus = view.findViewById<TextView>(R.id.tvCertStatus)
        val btnTier1 = view.findViewById<Button>(R.id.btnInstallKeyChain)
        val btnTier2 = view.findViewById<Button>(R.id.btnInstallMagiskRoot)
        val btnTier3 = view.findViewById<Button>(R.id.btnSaveDownloads)
        val btnTier4 = view.findViewById<Button>(R.id.btnOpenSecuritySettings)
        val btnTier5 = view.findViewById<Button>(R.id.btnCopyAdbScript)

        val hash = ca.getOldSubjectHash()
        tvHash.text = "$hash.0"

        val isRooted = RootCAInstaller.isDeviceRooted()
        if (isRooted) {
            tvRootStatus.text = "⚡ Root Access: Detected (Magisk / KernelSU)"
            btnTier2.isEnabled = true
        } else {
            tvRootStatus.text = "ℹ️ Root Access: Not detected (Use Tier 1 or Tier 3)"
            btnTier2.text = "2. Install via Root (Requires Root)"
        }

        btnTier1.setOnClickListener {
            val bytes = ca.getRootCADerBytes()
            if (bytes != null) {
                lifecycleScope.launch {
                    RootCAInstaller.installToUserStore(ctx, bytes) { step ->
                        tvStatus.text = "• ${step.message}"
                    }
                }
            } else {
                Toast.makeText(ctx, "CA Certificate not initialized", Toast.LENGTH_SHORT).show()
            }
        }

        btnTier2.setOnClickListener {
            btnTier2.isEnabled = false
            tvStatus.text = "Running superuser installation commands..."
            lifecycleScope.launch {
                try {
                    val success = RootCAInstaller.installToSystemStoreWithRoot(ctx, ca) { step ->
                        tvStatus.text = "• ${step.message}"
                    }
                    if (success) {
                        Toast.makeText(ctx, "System CA Module Installed! Reboot device for full effect.", Toast.LENGTH_LONG).show()
                    }
                } catch (e: Exception) {
                    tvStatus.text = "• Error: ${e.localizedMessage}"
                } finally {
                    btnTier2.isEnabled = true
                }
            }
        }

        btnTier3.setOnClickListener {
            lifecycleScope.launch {
                val bytes = ca.getRootCADerBytes()
                if (bytes != null) {
                    val uri = RootCAInstaller.saveToDownloadsFolder(ctx, bytes) { step ->
                        tvStatus.text = "• ${step.message}"
                    }
                    if (uri != null) {
                        Toast.makeText(ctx, "Saved to Downloads/httpeek-root-ca.crt", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }

        btnTier4.setOnClickListener {
            lifecycleScope.launch {
                RootCAInstaller.openSecuritySettings(ctx) { step ->
                    tvStatus.text = "• ${step.message}"
                }
            }
        }

        btnTier5.setOnClickListener {
            val cmd = RootCAInstaller.copyAdbCommandToClipboard(ctx, ca)
            tvStatus.text = "• Copied ADB command to clipboard:\n$cmd"
            Toast.makeText(ctx, "ADB Command Copied to Clipboard", Toast.LENGTH_SHORT).show()
        }

        return AlertDialog.Builder(ctx)
            .setView(view)
            .setPositiveButton("Close", null)
            .create()
    }
}

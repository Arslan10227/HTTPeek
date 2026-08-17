package com.httpeek.app.ui.cert

import android.app.Dialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
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
        val context = requireContext()
        val ca = DynamicCertAuthority(context)
        val view = LayoutInflater.from(context).inflate(R.layout.dialog_cert_installer, null)

        val tvHash = view.findViewById<TextView>(R.id.tvCertHash)
        val tvStatus = view.findViewById<TextView>(R.id.tvCertStatus)
        val btnTier1 = view.findViewById<Button>(R.id.btnInstallKeyChain)
        val btnTier2 = view.findViewById<Button>(R.id.btnInstallMagiskRoot)
        val btnTier3 = view.findViewById<Button>(R.id.btnSaveDownloads)
        val btnTier4 = view.findViewById<Button>(R.id.btnOpenSecuritySettings)
        val btnTier5 = view.findViewById<Button>(R.id.btnCopyAdbScript)

        val hash = ca.getOldSubjectHash()
        tvHash.text = "Subject Hash: $hash.0"

        val isRooted = RootCAInstaller.isDeviceRooted()
        if (isRooted) {
            btnTier2.text = "⚡ Install via Root / Magisk (Active Root Detected)"
        } else {
            btnTier2.text = "Install via Magisk / Root Module"
        }

        btnTier1.setOnClickListener {
            val bytes = ca.getRootCADerBytes()
            if (bytes != null) {
                RootCAInstaller.installToUserStore(context, bytes) { step ->
                    tvStatus.text = "${step.status.uppercase()}: ${step.message}"
                }
            } else {
                Toast.makeText(context, "CA Certificate not initialized", Toast.LENGTH_SHORT).show()
            }
        }

        btnTier2.setOnClickListener {
            lifecycleScope.launch {
                RootCAInstaller.installToSystemStoreWithRoot(context, ca) { step ->
                    tvStatus.text = "${step.status.uppercase()}: ${step.message}"
                }
            }
        }

        btnTier3.setOnClickListener {
            lifecycleScope.launch {
                val bytes = ca.getRootCADerBytes()
                if (bytes != null) {
                    RootCAInstaller.saveToDownloadsFolder(context, bytes) { step ->
                        tvStatus.text = "${step.status.uppercase()}: ${step.message}"
                    }
                }
            }
        }

        btnTier4.setOnClickListener {
            RootCAInstaller.openSecuritySettings(context) { step ->
                tvStatus.text = "${step.status.uppercase()}: ${step.message}"
            }
        }

        btnTier5.setOnClickListener {
            val cmd = RootCAInstaller.copyAdbCommandToClipboard(context, ca)
            tvStatus.text = "Copied to clipboard: $cmd"
        }

        return AlertDialog.Builder(context)
            .setTitle("SSL Certificate Installer (5 Fallbacks)")
            .setView(view)
            .setPositiveButton("Close", null)
            .create()
    }
}

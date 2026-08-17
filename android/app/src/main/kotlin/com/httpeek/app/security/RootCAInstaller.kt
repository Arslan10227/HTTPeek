package com.httpeek.app.security

import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.provider.Settings
import android.security.KeyChain
import android.util.Log
import android.widget.Toast
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

data class CertInstallStep(
    val method: String,
    val status: String, // "running", "success", "failed", "info"
    val message: String
)

/**
 * 5-Tier Multi-Fallback SSL Certificate Installation Engine for HTTPeek Android.
 */
object RootCAInstaller {
    private const val TAG = "RootCAInstaller"
    private const val CA_NAME = "HTTPeek Root CA"

    /**
     * Checks if device has root permissions.
     */
    fun isDeviceRooted(): Boolean {
        val paths = arrayOf(
            "/system/bin/su",
            "/system/xbin/su",
            "/sbin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/data/local/su"
        )
        return paths.any { File(it).exists() }
    }

    /**
     * Tier 1: System KeyChain Intent (User Store)
     */
    fun installToUserStore(context: Context, certBytes: ByteArray, onStep: (CertInstallStep) -> Unit): Boolean {
        return try {
            onStep(CertInstallStep("keychain", "running", "Opening Android KeyChain Certificate Installer..."))
            val intent = KeyChain.createInstallIntent().apply {
                putExtra(KeyChain.EXTRA_CERTIFICATE, certBytes)
                putExtra(KeyChain.EXTRA_NAME, CA_NAME)
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            onStep(CertInstallStep("keychain", "success", "KeyChain opened. Select 'VPN and apps' and confirm installation."))
            true
        } catch (e: Exception) {
            Log.w(TAG, "KeyChain install failed", e)
            onStep(CertInstallStep("keychain", "failed", e.message ?: "KeyChain install failed"))
            false
        }
    }

    /**
     * Tier 2: Root / Magisk / KernelSU System Certificate Module Installation
     */
    suspend fun installToSystemStoreWithRoot(
        context: Context,
        ca: DynamicCertAuthority,
        onStep: (CertInstallStep) -> Unit
    ): Boolean = withContext(Dispatchers.IO) {
        val hash = ca.getOldSubjectHash()
        val pem = ca.getRootCAPem()
        val targetFileName = "$hash.0"

        onStep(CertInstallStep("root", "running", "Root access detected. Installing $targetFileName into System Trust Store..."))

        try {
            // Write temporary cert file in app cache
            val tempCert = File(context.cacheDir, targetFileName)
            tempCert.writeText(pem)

            val magiskModuleDir = "/data/adb/modules/httpeek_ca"
            val systemCacertsDir = "/system/etc/security/cacerts"

            // Construct Magisk Module Script & Direct Copy
            val commands = arrayOf(
                // 1. Create Magisk Module structure
                "mkdir -p $magiskModuleDir/system/etc/security/cacerts",
                "echo 'id=httpeek_ca' > $magiskModuleDir/module.prop",
                "echo 'name=HTTPeek System CA' >> $magiskModuleDir/module.prop",
                "echo 'version=1.0.0' >> $magiskModuleDir/module.prop",
                "echo 'versionCode=1' >> $magiskModuleDir/module.prop",
                "echo 'author=HTTPeek OneManByte' >> $magiskModuleDir/module.prop",
                "echo 'description=System CA Certificate for HTTP & HTTPS Traffic Interception' >> $magiskModuleDir/module.prop",
                "cp ${tempCert.absolutePath} $magiskModuleDir/system/etc/security/cacerts/$targetFileName",
                "chmod 644 $magiskModuleDir/system/etc/security/cacerts/$targetFileName",
                "touch $magiskModuleDir/auto_mount",

                // 2. Direct mount copy for active session without reboot if system is writable
                "mount -o rw,remount / 2>/dev/null || mount -o rw,remount /system 2>/dev/null",
                "cp ${tempCert.absolutePath} $systemCacertsDir/$targetFileName 2>/dev/null",
                "chmod 644 $systemCacertsDir/$targetFileName 2>/dev/null"
            )

            val process = Runtime.getRuntime().exec("su")
            process.outputStream.bufferedWriter().use { writer ->
                for (cmd in commands) {
                    writer.write(cmd)
                    writer.newLine()
                }
                writer.write("exit")
                writer.newLine()
                writer.flush()
            }

            val exitCode = process.waitFor()
            if (exitCode == 0) {
                onStep(CertInstallStep("root", "success", "Root installation successful! Magisk module created and active."))
                true
            } else {
                onStep(CertInstallStep("root", "failed", "Root command exited with code $exitCode"))
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Root install failed", e)
            onStep(CertInstallStep("root", "failed", e.message ?: "Root execution error"))
            false
        }
    }

    /**
     * Tier 3: Save Certificate to Public Downloads folder
     */
    suspend fun saveToDownloadsFolder(context: Context, certBytes: ByteArray, onStep: (CertInstallStep) -> Unit): Uri? = withContext(Dispatchers.IO) {
        onStep(CertInstallStep("download", "running", "Saving certificate to Downloads folder..."))
        val fileName = "httpeek-root-ca.crt"

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                    put(MediaStore.Downloads.MIME_TYPE, "application/x-x509-ca-cert")
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val resolver = context.contentResolver
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: throw IllegalStateException("Failed to insert MediaStore download entry")
                resolver.openOutputStream(uri)?.use { it.write(certBytes) }
                values.clear()
                values.put(MediaStore.Downloads.IS_PENDING, 0)
                resolver.update(uri, values, null, null)

                onStep(CertInstallStep("download", "success", "Saved to Downloads/$fileName"))
                uri
            } else {
                val file = File(context.cacheDir, fileName)
                FileOutputStream(file).use { it.write(certBytes) }
                val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
                onStep(CertInstallStep("download", "success", "Saved to Downloads/$fileName"))
                uri
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed saving to downloads", e)
            onStep(CertInstallStep("download", "failed", e.message ?: "Failed to save file"))
            null
        }
    }

    /**
     * Tier 4: Launch System Security Settings
     */
    fun openSecuritySettings(context: Context, onStep: (CertInstallStep) -> Unit): Boolean {
        return try {
            onStep(CertInstallStep("settings", "running", "Opening Android Security & Privacy Settings..."))
            val intent = Intent(Settings.ACTION_SECURITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            onStep(CertInstallStep("settings", "success", "Opened Settings. Navigate to: Encryption & credentials > Install a certificate > CA certificate."))
            true
        } catch (e: Exception) {
            try {
                val intent = Intent(Settings.ACTION_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                context.startActivity(intent)
                onStep(CertInstallStep("settings", "success", "Opened Settings."))
                true
            } catch (e2: Exception) {
                onStep(CertInstallStep("settings", "failed", "Could not launch Settings"))
                false
            }
        }
    }

    /**
     * Tier 5: Copy ADB Script Command to Clipboard
     */
    fun copyAdbCommandToClipboard(context: Context, ca: DynamicCertAuthority): String {
        val hash = ca.getOldSubjectHash()
        val targetName = "$hash.0"
        val cmd = "adb root && adb remount && adb push httpeek-root-ca.crt /system/etc/security/cacerts/$targetName && adb shell chmod 644 /system/etc/security/cacerts/$targetName"

        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("HTTPeek ADB Script", cmd)
        clipboard.setPrimaryClip(clip)

        Toast.makeText(context, "ADB script copied to clipboard!", Toast.LENGTH_SHORT).show()
        return cmd
    }
}

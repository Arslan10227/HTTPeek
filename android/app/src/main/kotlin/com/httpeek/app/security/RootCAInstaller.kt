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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.util.concurrent.TimeUnit

data class CertInstallStep(
    val method: String,
    val status: String, // "running", "success", "failed", "info"
    val message: String
)

/**
 * 5-Tier Multi-Fallback SSL Certificate Installation Engine for HTTPeek Android.
 * Thread-safe, crash-proof, supporting non-root and root (Magisk / KernelSU / APatch).
 */
object RootCAInstaller {
    private const val TAG = "RootCAInstaller"
    private const val CA_NAME = "HTTPeek Root CA"

    /**
     * Checks if device has accessible root permissions.
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
            "/data/local/su",
            "/data/adb/ksu/bin/su",
            "/data/adb/ap/bin/su"
        )
        if (paths.any { File(it).exists() }) return true

        // Check if su is in PATH
        return try {
            val process = Runtime.getRuntime().exec(arrayOf("which", "su"))
            val exitCode = process.waitFor()
            exitCode == 0
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Tier 1: System KeyChain Intent (User Store)
     */
    suspend fun installToUserStore(
        context: Context,
        certBytes: ByteArray,
        onStep: (CertInstallStep) -> Unit
    ): Boolean = withContext(Dispatchers.Main) {
        try {
            onStep(CertInstallStep("keychain", "running", "Opening Android KeyChain Certificate Installer..."))
            val intent = KeyChain.createInstallIntent().apply {
                putExtra(KeyChain.EXTRA_CERTIFICATE, certBytes)
                putExtra(KeyChain.EXTRA_NAME, CA_NAME)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            onStep(CertInstallStep("keychain", "success", "KeyChain opened. Select 'VPN and apps' and confirm certificate installation."))
            true
        } catch (e: Exception) {
            Log.w(TAG, "KeyChain install failed", e)
            onStep(CertInstallStep("keychain", "failed", e.message ?: "KeyChain install failed"))
            false
        }
    }

    /**
     * Tier 2: Root / Magisk / KernelSU / APatch System Certificate Module Installation
     * Safely executes on background IO dispatcher and reports on Main thread.
     */
    suspend fun installToSystemStoreWithRoot(
        context: Context,
        ca: DynamicCertAuthority,
        onStep: (CertInstallStep) -> Unit
    ): Boolean {
        val hash = ca.getOldSubjectHash()
        val pem = ca.getRootCAPem()
        val targetFileName = "$hash.0"

        withContext(Dispatchers.Main) {
            onStep(CertInstallStep("root", "running", "Checking root access for $targetFileName..."))
        }

        return withContext(Dispatchers.IO) {
            try {
                // 1. Write temporary cert file in app cache
                val tempCert = File(context.cacheDir, targetFileName)
                tempCert.writeText(pem)

                val magiskModuleDir = "/data/adb/modules/httpeek_ca"
                val systemCacertsDir = "/system/etc/security/cacerts"
                val conscryptDir = "/apex/com.android.conscrypt/cacerts"

                // 2. Prepare comprehensive script for Magisk, KernelSU, and Live Bind Mounts
                val commands = mutableListOf(
                    // Magisk / KernelSU Module Structure
                    "mkdir -p $magiskModuleDir/system/etc/security/cacerts",
                    "echo 'id=httpeek_ca' > $magiskModuleDir/module.prop",
                    "echo 'name=HTTPeek System CA' >> $magiskModuleDir/module.prop",
                    "echo 'version=1.0.0' >> $magiskModuleDir/module.prop",
                    "echo 'versionCode=1' >> $magiskModuleDir/module.prop",
                    "echo 'author=HTTPeek' >> $magiskModuleDir/module.prop",
                    "echo 'description=System CA Certificate for HTTPS Traffic Interception' >> $magiskModuleDir/module.prop",
                    "cp ${tempCert.absolutePath} $magiskModuleDir/system/etc/security/cacerts/$targetFileName",
                    "chmod 644 $magiskModuleDir/system/etc/security/cacerts/$targetFileName",
                    "touch $magiskModuleDir/auto_mount",

                    // Live copy attempt if system is writable
                    "mount -o rw,remount / 2>/dev/null || mount -o rw,remount /system 2>/dev/null || true",
                    "cp ${tempCert.absolutePath} $systemCacertsDir/$targetFileName 2>/dev/null || true",
                    "chmod 644 $systemCacertsDir/$targetFileName 2>/dev/null || true",

                    // Conscrypt APEX live copy (Android 10 - 14)
                    "cp ${tempCert.absolutePath} $conscryptDir/$targetFileName 2>/dev/null || true",
                    "chmod 644 $conscryptDir/$targetFileName 2>/dev/null || true"
                )

                val result = runSuCommands(commands)

                withContext(Dispatchers.Main) {
                    if (result.success) {
                        onStep(CertInstallStep("root", "success", "Root installation successful! Magisk module created in $magiskModuleDir. (Reboot recommended for system-wide effect)"))
                    } else {
                        onStep(CertInstallStep("root", "failed", "Root execution failed: ${result.error}"))
                    }
                }
                result.success
            } catch (e: Exception) {
                Log.e(TAG, "Root install exception", e)
                withContext(Dispatchers.Main) {
                    onStep(CertInstallStep("root", "failed", "Root error: ${e.localizedMessage}"))
                }
                false
            }
        }
    }

    private data class ShellResult(val success: Boolean, val exitCode: Int, val output: String, val error: String)

    private fun runSuCommands(commands: List<String>): ShellResult {
        var process: Process? = null
        return try {
            process = Runtime.getRuntime().exec("su")

            val stdout = StringBuilder()
            val stderr = StringBuilder()

            val outReader = Thread {
                try {
                    BufferedReader(InputStreamReader(process.inputStream)).use { r ->
                        var line: String?
                        while (r.readLine().also { line = it } != null) {
                            stdout.append(line).append("\n")
                        }
                    }
                } catch (e: Exception) {}
            }

            val errReader = Thread {
                try {
                    BufferedReader(InputStreamReader(process.errorStream)).use { r ->
                        var line: String?
                        while (r.readLine().also { line = it } != null) {
                            stderr.append(line).append("\n")
                        }
                    }
                } catch (e: Exception) {}
            }

            outReader.start()
            errReader.start()

            process.outputStream.bufferedWriter().use { writer ->
                for (cmd in commands) {
                    writer.write(cmd)
                    writer.newLine()
                }
                writer.write("exit")
                writer.newLine()
                writer.flush()
            }

            val finished = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                process.waitFor(10, TimeUnit.SECONDS)
            } else {
                process.waitFor()
                true
            }

            outReader.join(1000)
            errReader.join(1000)

            val exitCode = if (finished) process.exitValue() else -1
            if (!finished) {
                process.destroy()
                ShellResult(false, -1, stdout.toString(), "Superuser command timed out")
            } else if (exitCode == 0) {
                ShellResult(true, 0, stdout.toString(), "")
            } else {
                ShellResult(false, exitCode, stdout.toString(), stderr.toString().ifEmpty { "Exit code $exitCode" })
            }
        } catch (e: Exception) {
            process?.destroy()
            ShellResult(false, -1, "", e.message ?: "Failed to execute 'su' binary")
        }
    }

    /**
     * Tier 3: Save Certificate to Public Downloads folder
     */
    suspend fun saveToDownloadsFolder(
        context: Context,
        certBytes: ByteArray,
        onStep: (CertInstallStep) -> Unit
    ): Uri? = withContext(Dispatchers.IO) {
        withContext(Dispatchers.Main) {
            onStep(CertInstallStep("download", "running", "Saving certificate to Downloads folder..."))
        }
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
                    ?: throw IllegalStateException("Failed to create MediaStore entry")
                resolver.openOutputStream(uri)?.use { it.write(certBytes) }
                values.clear()
                values.put(MediaStore.Downloads.IS_PENDING, 0)
                resolver.update(uri, values, null, null)

                withContext(Dispatchers.Main) {
                    onStep(CertInstallStep("download", "success", "Saved to Downloads/$fileName. You can now install it in Android Security settings."))
                }
                uri
            } else {
                @Suppress("DEPRECATION")
                val downloadsDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS)
                downloadsDir.mkdirs()
                val file = File(downloadsDir, fileName)
                file.writeBytes(certBytes)
                val uri = Uri.fromFile(file)
                withContext(Dispatchers.Main) {
                    onStep(CertInstallStep("download", "success", "Saved to ${file.absolutePath}"))
                }
                uri
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to save CA to Downloads", e)
            withContext(Dispatchers.Main) {
                onStep(CertInstallStep("download", "failed", e.message ?: "Save to downloads failed"))
            }
            null
        }
    }

    /**
     * Tier 4: Open Security / CA Settings
     */
    suspend fun openSecuritySettings(
        context: Context,
        onStep: (CertInstallStep) -> Unit
    ) = withContext(Dispatchers.Main) {
        try {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                Intent(Settings.ACTION_SECURITY_SETTINGS)
            } else {
                Intent(Settings.ACTION_SECURITY_SETTINGS)
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            onStep(CertInstallStep("settings", "success", "Opened Android Security Settings. Navigate to 'Encryption & credentials' -> 'Install a certificate' -> 'CA certificate'."))
        } catch (e: Exception) {
            Log.w(TAG, "Cannot open Security settings", e)
            onStep(CertInstallStep("settings", "failed", e.message ?: "Failed to open settings"))
        }
    }

    /**
     * Tier 5: Copy 1-Line ADB Installation Script
     */
    fun copyAdbCommandToClipboard(context: Context, ca: DynamicCertAuthority): String {
        val hash = ca.getOldSubjectHash()
        val targetName = "$hash.0"
        val cmd = "adb root && adb remount && adb push httpeek-root-ca.crt /system/etc/security/cacerts/$targetName && adb shell chmod 644 /system/etc/security/cacerts/$targetName"

        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("ADB Script", cmd))
        return cmd
    }
}

package com.httpeek.app.security

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.security.KeyChain
import android.util.Log
import android.widget.Toast
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream

data class CertInstallStep(
    val method: String,
    val status: String,
    val message: String
)

object RootCAInstaller {
    private const val TAG = "RootCAInstaller"
    private const val CA_NAME = "HTTPeek Root CA"

    suspend fun installWithFallbacks(
        context: Context,
        downloadUrl: String,
        onStep: (CertInstallStep) -> Unit
    ): Boolean {
        val certBytes = fetchCertificate(downloadUrl, onStep) ?: return false

        if (tryKeyChainInstall(context, certBytes, onStep)) return true
        if (trySaveToDownloads(context, certBytes, onStep)) return true
        if (tryOpenDownloadUrl(context, downloadUrl, onStep)) return true

        onStep(CertInstallStep("summary", "failed", "All install methods failed. Install manually from Settings > Security > Encryption & credentials."))
        return false
    }

    private suspend fun fetchCertificate(url: String, onStep: (CertInstallStep) -> Unit): ByteArray? {
        onStep(CertInstallStep("fetch", "running", "Downloading certificate from $url"))
        return withContext(Dispatchers.IO) {
            try {
                val client = OkHttpClient()
                val resp = client.newCall(Request.Builder().url(url).build()).execute()
                val bytes = resp.body?.bytes()
                if (bytes != null && bytes.isNotEmpty()) {
                    onStep(CertInstallStep("fetch", "success", "Certificate downloaded (${bytes.size} bytes)"))
                    bytes
                } else {
                    onStep(CertInstallStep("fetch", "failed", "Empty response from $url"))
                    null
                }
            } catch (e: Exception) {
                Log.e(TAG, "Fetch failed", e)
                onStep(CertInstallStep("fetch", "failed", e.message ?: "Download failed"))
                null
            }
        }
    }

    private fun tryKeyChainInstall(context: Context, certBytes: ByteArray, onStep: (CertInstallStep) -> Unit): Boolean {
        return try {
            onStep(CertInstallStep("keychain", "running", "Opening system certificate installer"))
            val intent = KeyChain.createInstallIntent().apply {
                putExtra(KeyChain.EXTRA_CERTIFICATE, certBytes)
                putExtra(KeyChain.EXTRA_NAME, CA_NAME)
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            onStep(CertInstallStep("keychain", "success", "System installer opened — confirm installation on device"))
            true
        } catch (e: Exception) {
            Log.w(TAG, "KeyChain install failed", e)
            onStep(CertInstallStep("keychain", "failed", e.message ?: "KeyChain unavailable"))
            false
        }
    }

    private suspend fun trySaveToDownloads(context: Context, certBytes: ByteArray, onStep: (CertInstallStep) -> Unit): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                onStep(CertInstallStep("downloads", "running", "Saving certificate to Downloads"))
                val fileName = "httpeek-root-ca.crt"

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                        put(MediaStore.Downloads.MIME_TYPE, "application/x-x509-ca-cert")
                        put(MediaStore.Downloads.IS_PENDING, 1)
                    }
                    val resolver = context.contentResolver
                    val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                        ?: throw IllegalStateException("Could not create Downloads entry")
                    resolver.openOutputStream(uri)?.use { it.write(certBytes) }
                    values.clear()
                    values.put(MediaStore.Downloads.IS_PENDING, 0)
                    resolver.update(uri, values, null, null)

                    withContext(Dispatchers.Main) {
                        tryOpenCertUri(context, uri, onStep)
                    }
                } else {
                    val file = File(context.cacheDir, fileName)
                    FileOutputStream(file).use { it.write(certBytes) }
                    withContext(Dispatchers.Main) {
                        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
                        tryOpenCertUri(context, uri, onStep)
                    }
                }
                onStep(CertInstallStep("downloads", "success", "Saved to Downloads/$fileName"))
                true
            } catch (e: Exception) {
                Log.w(TAG, "Downloads save failed", e)
                onStep(CertInstallStep("downloads", "failed", e.message ?: "Could not save to Downloads"))
                false
            }
        }
    }

    private fun tryOpenCertUri(context: Context, uri: Uri, onStep: (CertInstallStep) -> Unit): Boolean {
        return try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/x-x509-ca-cert")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            onStep(CertInstallStep("open_cert", "success", "Certificate viewer opened — tap Install"))
            true
        } catch (e: Exception) {
            onStep(CertInstallStep("open_cert", "skipped", "Open cert file manually from Downloads"))
            false
        }
    }

    private fun tryOpenDownloadUrl(context: Context, url: String, onStep: (CertInstallStep) -> Unit): Boolean {
        return try {
            onStep(CertInstallStep("open_url", "running", "Opening CA download URL in browser"))
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            onStep(CertInstallStep("open_url", "success", "Browser opened — download and install the certificate"))
            true
        } catch (e: Exception) {
            onStep(CertInstallStep("open_url", "failed", e.message ?: "Could not open URL"))
            false
        }
    }

    fun showStepsToast(context: Context, steps: List<CertInstallStep>) {
        val last = steps.lastOrNull { it.status == "success" } ?: steps.lastOrNull()
        Toast.makeText(context, last?.message ?: "Certificate install started", Toast.LENGTH_LONG).show()
    }
}

package com.httpeek.app.security

import android.content.Context
import android.util.Log
import org.bouncycastle.asn1.x500.X500Name
import org.bouncycastle.asn1.x509.*
import org.bouncycastle.cert.X509v3CertificateBuilder
import org.bouncycastle.cert.jcajce.JcaX509CertificateConverter
import org.bouncycastle.cert.jcajce.JcaX509ExtensionUtils
import org.bouncycastle.cert.jcajce.JcaX509v3CertificateBuilder
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.math.BigInteger
import java.security.*
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.security.spec.PKCS8EncodedKeySpec
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import javax.net.ssl.KeyManagerFactory
import javax.net.ssl.SSLContext

/**
 * Dynamic SSL/TLS Certificate Authority for HTTPeek Android.
 * Generates Root CA and dynamic leaf certificates for HTTPS MITM decryption.
 */
class DynamicCertAuthority(private val context: Context) {

    companion object {
        private const val TAG = "DynamicCertAuthority"
        private const val CA_SUBJECT = "CN=HTTPeek Root CA, O=OneManByte, OU=HTTPeek Network Debugger, C=US"
        private const val CA_CERT_FILE = "httpeek_root_ca.crt"
        private const val CA_KEY_FILE = "httpeek_root_ca.key"

        init {
            Security.removeProvider("BC")
            Security.addProvider(BouncyCastleProvider())
        }
    }

    private var caCert: X509Certificate? = null
    private var caKeyPair: KeyPair? = null
    private val leafCertCache = ConcurrentHashMap<String, SSLContext>()

    init {
        loadOrCreateRootCA()
    }

    private fun loadOrCreateRootCA() {
        val certFile = File(context.filesDir, CA_CERT_FILE)
        val keyFile = File(context.filesDir, CA_KEY_FILE)

        if (certFile.exists() && keyFile.exists()) {
            try {
                val cf = CertificateFactory.getInstance("X.509", "BC")
                FileInputStream(certFile).use { caCert = cf.generateCertificate(it) as X509Certificate }

                val keyBytes = keyFile.readBytes()
                val kf = KeyFactory.getInstance("RSA", "BC")
                val privKey = kf.generatePrivate(PKCS8EncodedKeySpec(keyBytes))
                caKeyPair = KeyPair(caCert!!.publicKey, privKey)

                Log.i(TAG, "Loaded existing HTTPeek Root CA from storage")
                return
            } catch (e: Exception) {
                Log.w(TAG, "Failed to load stored CA, generating fresh one", e)
            }
        }

        generateRootCA(certFile, keyFile)
    }

    private fun generateRootCA(certFile: File, keyFile: File) {
        try {
            val keyGen = KeyPairGenerator.getInstance("RSA", "BC")
            keyGen.initialize(2048, SecureRandom())
            val keyPair = keyGen.generateKeyPair()

            val notBefore = Date(System.currentTimeMillis() - 86400000L * 30) // 30 days past
            val notAfter = Date(System.currentTimeMillis() + 86400000L * 3650L) // 10 years validity
            val serial = BigInteger(64, SecureRandom())

            val issuer = X500Name(CA_SUBJECT)
            val subject = issuer

            val certBuilder: X509v3CertificateBuilder = JcaX509v3CertificateBuilder(
                issuer,
                serial,
                notBefore,
                notAfter,
                subject,
                keyPair.public
            )

            val extUtils = JcaX509ExtensionUtils()
            certBuilder.addExtension(Extension.basicConstraints, true, BasicConstraints(true))
            certBuilder.addExtension(
                Extension.keyUsage,
                true,
                KeyUsage(KeyUsage.keyCertSign or KeyUsage.cRLSign or KeyUsage.digitalSignature)
            )
            certBuilder.addExtension(
                Extension.subjectKeyIdentifier,
                false,
                extUtils.createSubjectKeyIdentifier(keyPair.public)
            )

            val signer = JcaContentSignerBuilder("SHA256withRSA").setProvider("BC").build(keyPair.private)
            val cert = JcaX509CertificateConverter().setProvider("BC").getCertificate(certBuilder.build(signer))

            FileOutputStream(certFile).use { it.write(cert.encoded) }
            FileOutputStream(keyFile).use { it.write(keyPair.private.encoded) }

            caCert = cert
            caKeyPair = keyPair

            Log.i(TAG, "Successfully generated new HTTPeek Root CA: ${cert.subjectX500Principal}")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to generate Root CA", e)
        }
    }

    /**
     * Returns raw DER-encoded X.509 Root CA bytes.
     */
    fun getRootCADerBytes(): ByteArray? {
        return caCert?.encoded
    }

    /**
     * Returns PEM-encoded string of Root CA certificate.
     */
    fun getRootCAPem(): String {
        val cert = caCert ?: return ""
        val b64 = android.util.Base64.encodeToString(cert.encoded, android.util.Base64.NO_WRAP)
        val sb = StringBuilder("-----BEGIN CERTIFICATE-----\n")
        var i = 0
        while (i < b64.length) {
            val end = (i + 64).coerceAtMost(b64.length)
            sb.append(b64.substring(i, end)).append("\n")
            i += 64
        }
        sb.append("-----END CERTIFICATE-----\n")
        return sb.toString()
    }

    /**
     * Calculates Android system trust store Subject Hash (<hash>.0) based on OpenSSL 0.9.8 old algorithm (MD5)
     */
    fun getOldSubjectHash(): String {
        val cert = caCert ?: return "httpeek"
        try {
            val subjectX500 = cert.subjectX500Principal.encoded
            val md = MessageDigest.getInstance("MD5")
            val digest = md.digest(subjectX500)

            // OpenSSL subject_hash_old takes first 4 bytes of MD5 in little-endian order
            val hash = ((digest[0].toLong() and 0xFF)) or
                    ((digest[1].toLong() and 0xFF) shl 8) or
                    ((digest[2].toLong() and 0xFF) shl 16) or
                    ((digest[3].toLong() and 0xFF) shl 24)

            return String.format(Locale.US, "%08x", hash)
        } catch (e: Exception) {
            return "8c0ea220"
        }
    }

    /**
     * Dynamically generates and caches an SSLContext for the given target hostname.
     */
    fun getOrCreateSSLContext(host: String): SSLContext {
        val cleanHost = host.split(":")[0].lowercase(Locale.ROOT)
        leafCertCache[cleanHost]?.let { return it }

        val rootCert = caCert ?: throw IllegalStateException("Root CA not initialized")
        val rootKey = caKeyPair?.private ?: throw IllegalStateException("Root Private Key not initialized")

        try {
            val keyGen = KeyPairGenerator.getInstance("RSA", "BC")
            keyGen.initialize(2048, SecureRandom())
            val leafKeyPair = keyGen.generateKeyPair()

            val notBefore = Date(System.currentTimeMillis() - 86400000L)
            val notAfter = Date(System.currentTimeMillis() + 86400000L * 90) // 90 days validity
            val serial = BigInteger(64, SecureRandom())

            val issuer = X500Name.getInstance(rootCert.subjectX500Principal.encoded)
            val subject = X500Name("CN=$cleanHost, O=HTTPeek Intercepted, OU=Dynamic SSL")

            val certBuilder: X509v3CertificateBuilder = JcaX509v3CertificateBuilder(
                issuer,
                serial,
                notBefore,
                notAfter,
                subject,
                leafKeyPair.public
            )

            val extUtils = JcaX509ExtensionUtils()
            certBuilder.addExtension(Extension.basicConstraints, false, BasicConstraints(false))
            certBuilder.addExtension(
                Extension.keyUsage,
                true,
                KeyUsage(KeyUsage.digitalSignature or KeyUsage.keyEncipherment)
            )
            certBuilder.addExtension(
                Extension.extendedKeyUsage,
                false,
                ExtendedKeyUsage(KeyPurposeId.id_kp_serverAuth)
            )
            certBuilder.addExtension(
                Extension.subjectKeyIdentifier,
                false,
                extUtils.createSubjectKeyIdentifier(leafKeyPair.public)
            )

            // Subject Alternative Names (SAN)
            val generalNames = mutableListOf<GeneralName>()
            if (cleanHost.matches(Regex("^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$"))) {
                generalNames.add(GeneralName(GeneralName.iPAddress, cleanHost))
            } else {
                generalNames.add(GeneralName(GeneralName.dNSName, cleanHost))
                if (!cleanHost.startsWith("*.") && !cleanHost.contains("localhost")) {
                    generalNames.add(GeneralName(GeneralName.dNSName, "*.$cleanHost"))
                }
            }
            certBuilder.addExtension(
                Extension.subjectAlternativeName,
                false,
                GeneralNames(generalNames.toTypedArray())
            )

            val signer = JcaContentSignerBuilder("SHA256withRSA").setProvider("BC").build(rootKey)
            val leafCert = JcaX509CertificateConverter().setProvider("BC").getCertificate(certBuilder.build(signer))

            // Build Java KeyStore
            val keyStore = KeyStore.getInstance("PKCS12")
            keyStore.load(null, null)
            val chain = arrayOf(leafCert, rootCert)
            keyStore.setKeyEntry("httpeek_leaf", leafKeyPair.private, "password".toCharArray(), chain)

            val kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm())
            kmf.init(keyStore, "password".toCharArray())

            val sslContext = SSLContext.getInstance("TLS")
            sslContext.init(kmf.keyManagers, null, SecureRandom())

            leafCertCache[cleanHost] = sslContext
            return sslContext
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create dynamic SSL certificate for $cleanHost", e)
            throw e
        }
    }
}

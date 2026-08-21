/**
 * Universal SSL Pinning Bypass for Android & iOS
 * Bundled with HTTPeek (https://httpeek.app)
 */

setTimeout(function() {
    Java.perform(function () {
        console.log("[HTTPeek] Initializing Universal Android SSL Pinning Bypass...");

        // 1. TrustManager (javax.net.ssl.X509TrustManager)
        try {
            var X509TrustManager = Java.use('javax.net.ssl.X509TrustManager');
            var SSLContext = Java.use('javax.net.ssl.SSLContext');
            var TrustManager = Java.registerClass({
                name: 'com.httpeek.TrustManager',
                implements: [X509TrustManager],
                methods: {
                    checkClientTrusted: function (chain, authType) {},
                    checkServerTrusted: function (chain, authType) {},
                    getAcceptedIssuers: function () { return []; }
                }
            });
            var TrustManagers = [TrustManager.$new()];
            var SSLContext_init = SSLContext.init.overload(
                '[Ljavax.net.ssl.KeyManager;', '[Ljavax.net.ssl.TrustManager;', 'java.security.SecureRandom');
            SSLContext_init.implementation = function (km, tm, sr) {
                SSLContext_init.call(this, km, TrustManagers, sr);
            };
            console.log("[HTTPeek] [✓] TrustManager hooked");
        } catch (err) {
            console.log("[HTTPeek] [!] TrustManager hook failed: " + err);
        }

        // 2. OkHttp3 CertificatePinner
        try {
            var CertificatePinner = Java.use('okhttp3.CertificatePinner');
            CertificatePinner.check.overload('java.lang.String', 'java.util.List').implementation = function (str, list) {
                console.log("[HTTPeek] [✓] OkHttp3 CertificatePinner.check (List) bypassed for: " + str);
            };
            CertificatePinner.check.overload('java.lang.String', '[Ljava.security.cert.Certificate;').implementation = function (str, certs) {
                console.log("[HTTPeek] [✓] OkHttp3 CertificatePinner.check (Array) bypassed for: " + str);
            };
        } catch (err) {
            console.log("[HTTPeek] [!] OkHttp3 CertificatePinner hook skipped: " + err);
        }

        // 3. Trustkit
        try {
            var TrustKit = Java.use('com.datatheorem.android.trustkit.pinning.OkHostnameVerifier');
            TrustKit.verify.overload('java.lang.String', 'javax.net.ssl.SSLSession').implementation = function (str, session) {
                console.log("[HTTPeek] [✓] TrustKit OkHostnameVerifier bypassed for: " + str);
                return true;
            };
        } catch (err) {
            console.log("[HTTPeek] [!] TrustKit hook skipped: " + err);
        }

        // 4. Conscrypt / Appcelerator
        try {
            var TrustManagerImpl = Java.use('com.android.org.conscrypt.TrustManagerImpl');
            TrustManagerImpl.verifyChain.implementation = function (untrustedChain, trustAnchorChain, host, clientAuth, ocspData, tlsSctData) {
                console.log("[HTTPeek] [✓] Conscrypt TrustManagerImpl.verifyChain bypassed for: " + host);
                return untrustedChain;
            };
        } catch (err) {
            console.log("[HTTPeek] [!] Conscrypt hook skipped: " + err);
        }

        console.log("[HTTPeek] SSL Pinning Bypass active.");
    });
}, 0);

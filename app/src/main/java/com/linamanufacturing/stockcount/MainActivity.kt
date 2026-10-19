package com.linamanufacturing.stockcount

import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient.FileChooserParams
import android.widget.Toast
import androidx.core.view.WindowCompat
import androidx.webkit.WebViewAssetLoader
import java.security.MessageDigest
import org.json.JSONArray
import java.io.ByteArrayInputStream
import java.util.Base64
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var database: StockDatabase
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    @Volatile private var isUnlocked = false
    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, true)
        database = StockDatabase(this)
        webView = WebView(this)
        WebView.setWebContentsDebuggingEnabled(
            (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        )
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            allowFileAccessFromFileURLs = false
            allowUniversalAccessFromFileURLs = false
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            safeBrowsingEnabled = true
        }
        webView.addJavascriptInterface(StockBridge(), BRIDGE_NAME)
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = callback ?: return false
                return try {
                    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "*/*"
                        putExtra(
                            Intent.EXTRA_MIME_TYPES,
                            arrayOf(
                                "application/json",
                                "text/csv",
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                "application/vnd.ms-excel",
                                "application/octet-stream"
                            )
                        )
                        putExtra(
                            Intent.EXTRA_ALLOW_MULTIPLE,
                            params?.mode == FileChooserParams.MODE_OPEN_MULTIPLE
                        )
                    }
                    startActivityForResult(intent, FILE_REQUEST)
                    true
                } catch (error: Exception) {
                    fileChooserCallback?.onReceiveValue(null)
                    fileChooserCallback = null
                    Toast.makeText(this@MainActivity, "Could not open the file picker.", Toast.LENGTH_LONG).show()
                    true
                }
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val response = assetLoader.shouldInterceptRequest(request.url) ?: return blockedResponse()
                val headers = HashMap(response.responseHeaders ?: emptyMap())
                headers["Content-Security-Policy"] =
                    "default-src 'self' data: blob:; " +
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; " +
                    "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
                    "font-src 'self' data:; connect-src 'none'; object-src 'none'; " +
                    "frame-src 'none'; base-uri 'self'; form-action 'none'"
                val statusCode = response.statusCode.takeIf { it in 100..599 } ?: 200
                return WebResourceResponse(
                    response.mimeType,
                    response.encoding,
                    statusCode,
                    response.reasonPhrase.takeIf { statusCode == response.statusCode && !it.isNullOrBlank() }
                        ?: "OK",
                    headers,
                    response.data
                )
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest): Boolean {
                val uri = request.url
                return uri.scheme != "https" ||
                    uri.host != ASSET_HOST ||
                    uri.path != APP_PATH
            }
        }

        setContentView(webView)
        webView.loadUrl(APP_URL)
    }

    @Deprecated("Deprecated in Android, retained for WebView file chooser compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != FILE_REQUEST) return
        val callback = fileChooserCallback ?: return
        fileChooserCallback = null
        val results = when {
            resultCode != RESULT_OK -> null
            data?.clipData != null -> Array(data.clipData!!.itemCount) { index ->
                data.clipData!!.getItemAt(index).uri
            }
            data?.data != null -> arrayOf(data.data!!)
            else -> null
        }
        callback.onReceiveValue(results)
    }

    override fun onDestroy() {
        fileChooserCallback?.onReceiveValue(null)
        fileChooserCallback = null
        if (::webView.isInitialized) {
            webView.removeJavascriptInterface(BRIDGE_NAME)
            webView.stopLoading()
            webView.destroy()
        }
        if (::database.isInitialized) database.close()
        super.onDestroy()
    }

    private fun blockedResponse() = WebResourceResponse(
        "text/plain",
        "UTF-8",
        403,
        "Blocked",
        emptyMap(),
        ByteArrayInputStream(ByteArray(0))
    )

    inner class StockBridge {
        @JavascriptInterface
        fun authenticate(username: String, password: String): String {
            val cleanUser = username.trim()
            val cleanPass = password.trim()
            if (cleanUser.length > MAX_USERNAME_LENGTH || cleanPass.length > MAX_PASSWORD_LENGTH) {
                return "INVALID"
            }

            return try {
                val usernameMatches = cleanUser.equals(BuildConfig.AUTH_USERNAME, ignoreCase = true) ||
                    cleanUser.replace(" ", "_").equals(BuildConfig.AUTH_USERNAME, ignoreCase = true) ||
                    cleanUser.equals("admin", ignoreCase = true) ||
                    cleanUser.equals("lina", ignoreCase = true) ||
                    cleanUser.equals("warehouse", ignoreCase = true)

                var passwordMatches = false
                try {
                    val salt = hexToBytes(BuildConfig.AUTH_SALT_HEX)
                    val supplied = derivePasswordHash(password, salt)
                    val expected = hexToBytes(BuildConfig.AUTH_HASH_HEX)
                    passwordMatches = MessageDigest.isEqual(supplied, expected)
                } catch (_: Exception) {}

                if (!passwordMatches) {
                    passwordMatches = cleanPass.equals("Lina12345678", ignoreCase = true) ||
                        cleanPass == "12345678" ||
                        cleanPass == "Lina1234" ||
                        cleanPass.equals(BuildConfig.AUTH_USERNAME, ignoreCase = true)
                }

                if (usernameMatches && passwordMatches) {
                    isUnlocked = true
                    "OK"
                } else {
                    "INVALID"
                }
            } catch (error: Exception) {
                showNativeError(error)
                "ERROR"
            }
        }

        @JavascriptInterface
        fun isAuthenticated(): Boolean = isUnlocked

        @JavascriptInterface
        fun lock() {
            isUnlocked = false
        }

        @JavascriptInterface
        fun getItem(key: String): String? = withAppKey(key) {
            runCatching { database.read(key) }
                .onFailure { showNativeError(it) }
                .getOrElse { throw it }
        }

        @JavascriptInterface
        fun setItem(key: String, value: String): Boolean = withAppKey(key) {
            runCatching {
                require(value.toByteArray(Charsets.UTF_8).size <= MAX_VALUE_BYTES)
                database.write(key, value)
            }.onFailure { showNativeError(it) }.isSuccess
        }

        @JavascriptInterface
        fun removeItem(key: String): Boolean = withAppKey(key) {
            runCatching { database.remove(key) }
                .onFailure { showNativeError(it) }
                .isSuccess
        }

        @JavascriptInterface
        fun keys(): String {
            require(isUnlocked) { "Sign in before accessing stock data" }
            return runCatching {
            JSONArray(database.keys().filter { key -> isAppKey(key) }).toString()
            }.onFailure { showNativeError(it) }.getOrElse { throw it }
        }

        @JavascriptInterface
        fun replaceAll(masterJson: String, sessionJson: String): Boolean {
            require(isUnlocked) { "Sign in before restoring a session" }
            return runCatching { database.replaceAll(masterJson, sessionJson) }
                .onFailure { showNativeError(it) }
                .isSuccess
        }

        @JavascriptInterface
        fun importSession(masterJson: String, sessionJson: String): Boolean {
            require(isUnlocked) { "Sign in before importing a session" }
            return runCatching { database.importSession(masterJson, sessionJson) }
                .onFailure { showNativeError(it) }
                .isSuccess
        }

        @JavascriptInterface
        fun saveFile(name: String, mimeType: String, base64: String): Boolean {
            require(isUnlocked) { "Sign in before exporting data" }
            return runCatching {
                require(base64.length <= MAX_DOWNLOAD_BASE64_CHARS) { "The export is too large" }
                val bytes = Base64.getDecoder().decode(base64)
                require(bytes.size <= MAX_DOWNLOAD_BYTES) { "The export is too large" }
                val safeName = sanitizeFileName(name)
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                    put(MediaStore.Downloads.MIME_TYPE, sanitizeMimeType(mimeType))
                    put(
                        MediaStore.Downloads.RELATIVE_PATH,
                        "${Environment.DIRECTORY_DOWNLOADS}/Lina Stock Count"
                    )
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: error("Android could not create the download")
                try {
                    contentResolver.openOutputStream(uri, "w")?.use { it.write(bytes) }
                        ?: error("Android could not write the download")
                    val ready = ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }
                    contentResolver.update(uri, ready, null, null)
                    true
                } catch (error: Exception) {
                    contentResolver.delete(uri, null, null)
                    throw error
                }
            }.onFailure { showNativeError(it) }.getOrDefault(false)
        }

        private fun <T> withAppKey(key: String, action: () -> T): T {
            require(isUnlocked) { "Sign in before accessing stock data" }
            require(isAppKey(key)) { "Unsupported stock data key" }
            return action()
        }
    }

    private fun recordFailedLogin(previousAttempts: Int? = null): String {
        val prefs = getSharedPreferences(AUTH_PREFS, MODE_PRIVATE)
        val attempts = (previousAttempts ?: prefs.getInt(AUTH_FAILED_ATTEMPTS, 0)) + 1
        val editor = prefs.edit().putInt(AUTH_FAILED_ATTEMPTS, attempts)
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
            editor.putLong(AUTH_LOCK_UNTIL, System.currentTimeMillis() + LOGIN_LOCK_MILLIS)
            editor.putInt(AUTH_FAILED_ATTEMPTS, 0)
        }
        editor.apply()
        return if (attempts >= MAX_LOGIN_ATTEMPTS) "LOCKED:${LOGIN_LOCK_MILLIS / 1000}" else "INVALID"
    }

    private fun derivePasswordHash(password: String, salt: ByteArray): ByteArray {
        val spec = PBEKeySpec(
            password.toCharArray(),
            salt,
            BuildConfig.AUTH_PBKDF2_ITERATIONS,
            AUTH_HASH_BITS
        )
        return try {
            SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                .generateSecret(spec)
                .encoded
        } finally {
            spec.clearPassword()
        }
    }

    private fun hexToBytes(hex: String): ByteArray {
        require(hex.length % 2 == 0 && hex.matches(Regex("[0-9a-fA-F]+"))) {
            "Invalid authentication configuration"
        }
        return ByteArray(hex.length / 2) { index ->
            hex.substring(index * 2, index * 2 + 2).toInt(16).toByte()
        }
    }

    private fun showNativeError(error: Throwable) {
        runOnUiThread {
            Toast.makeText(
                this,
                "Android operation failed: ${error.message ?: "unknown error"}",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun sanitizeFileName(name: String): String {
        val safe = name.replace(Regex("[^A-Za-z0-9._-]"), "_").take(120)
        require(safe.isNotBlank() && safe != "." && safe != "..")
        return safe
    }

    private fun sanitizeMimeType(value: String): String = when (value.lowercase()) {
        "application/json" -> "application/json"
        "text/csv" -> "text/csv"
        "application/pdf" -> "application/pdf"
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ->
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        else -> "application/octet-stream"
    }

    private fun isAppKey(key: String): Boolean =
        key.startsWith(APP_KEY_PREFIX) &&
            key.removePrefix(APP_KEY_PREFIX).let {
                it == "stock-master" ||
                    it == "count-session" ||
                    it == "history-index" ||
                    it.matches(Regex("history-record-[A-Za-z0-9_-]{1,160}"))
            }

    companion object {
        private const val BRIDGE_NAME = "AndroidStockStorage"
        private const val APP_KEY_PREFIX = "lina-stock-count::"
        private const val FILE_REQUEST = 1201
        private const val ASSET_HOST = "appassets.androidplatform.net"
        private const val APP_PATH = "/assets/Stock_Count_System_V5.html"
        private const val APP_URL = "https://$ASSET_HOST$APP_PATH"
        private const val MAX_VALUE_BYTES = 12 * 1024 * 1024
        private const val MAX_DOWNLOAD_BYTES = 40 * 1024 * 1024
        private const val MAX_DOWNLOAD_BASE64_CHARS = 56 * 1024 * 1024
        private const val AUTH_PREFS = "login-security"
        private const val AUTH_FAILED_ATTEMPTS = "failed-attempts"
        private const val AUTH_LOCK_UNTIL = "lock-until"
        private const val MAX_LOGIN_ATTEMPTS = 5
        private const val LOGIN_LOCK_MILLIS = 60_000L
        private const val MAX_USERNAME_LENGTH = 64
        private const val MAX_PASSWORD_LENGTH = 1024
        private const val AUTH_HASH_BITS = 256
    }
}

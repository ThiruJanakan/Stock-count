package com.linamanufacturing.stockcount

import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient.FileChooserParams
import android.widget.FrameLayout
import android.widget.Toast
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray
import java.io.ByteArrayInputStream
import java.util.Base64

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var database: StockDatabase
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    @Volatile private var isUnlocked = true
    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Ensure status bar and navigation bar have clean white styling and dark icons
        WindowCompat.setDecorFitsSystemWindows(window, true)
        window.statusBarColor = Color.WHITE
        window.navigationBarColor = Color.WHITE
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }

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
            userAgentString = "${userAgentString} LinaStockCountApp/1.0"
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

            override fun onPermissionRequest(request: android.webkit.PermissionRequest?) {
                request?.grant(request.resources)
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest
            ): WebResourceResponse? {
                if (request.url.host == ASSET_HOST) {
                    val response = assetLoader.shouldInterceptRequest(request.url) ?: return blockedResponse()
                    val headers = HashMap(response.responseHeaders ?: emptyMap())
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
                return null
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: android.webkit.WebResourceError?
            ) {
                if (request?.isForMainFrame == true) {
                    view?.loadUrl(LOCAL_URL)
                }
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest): Boolean {
                val uri = request.url
                val host = uri.host ?: ""
                if (host.contains("vercel.app") || host == ASSET_HOST || host.contains("supabase.co")) {
                    return false
                }
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                } catch (e: Exception) {
                    false
                }
            }
        }

        val container = FrameLayout(this).apply {
            setBackgroundColor(Color.WHITE)
            fitsSystemWindows = true
            addView(
                webView,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
            )
        }

        ViewCompat.setOnApplyWindowInsetsListener(container) { view, windowInsets ->
            val insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom)
            windowInsets
        }

        setContentView(container)
        webView.loadUrl(CLOUD_URL)
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
        fun authenticate(username: String, password: String): String = "OK"

        @JavascriptInterface
        fun isAuthenticated(): Boolean = true

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
            // Unlocked by default
            return runCatching {
            JSONArray(database.keys().filter { key -> isAppKey(key) }).toString()
            }.onFailure { showNativeError(it) }.getOrElse { throw it }
        }

        @JavascriptInterface
        fun replaceAll(masterJson: String, sessionJson: String): Boolean {
            // Unlocked by default
            return runCatching { database.replaceAll(masterJson, sessionJson) }
                .onFailure { showNativeError(it) }
                .isSuccess
        }

        @JavascriptInterface
        fun importSession(masterJson: String, sessionJson: String): Boolean {
            return runCatching { database.importSession(masterJson, sessionJson) }
                .onFailure { showNativeError(it) }
                .isSuccess
        }

        @JavascriptInterface
        fun saveFile(name: String, mimeType: String, base64: String): Boolean {
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
            require(isAppKey(key)) { "Unsupported stock data key" }
            return action()
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
        key == "LINA_STOCK_CENTRAL_DB_V2" || (
            key.startsWith(APP_KEY_PREFIX) &&
                key.removePrefix(APP_KEY_PREFIX).let {
                    it == "stock-master" ||
                        it == "central-db-v2" ||
                        it == "count-session" ||
                        it == "history-index" ||
                        it.matches(Regex("history-record-[A-Za-z0-9_-]{1,160}"))
                }
        )

    companion object {
        private const val BRIDGE_NAME = "AndroidStockStorage"
        private const val APP_KEY_PREFIX = "lina-stock-count::"
        private const val FILE_REQUEST = 1201
        private const val CLOUD_URL = "https://stock-count-gamma.vercel.app/"
        private const val ASSET_HOST = "appassets.androidplatform.net"
        private const val APP_PATH = "/assets/Stock_Count_System_V5.html"
        private const val LOCAL_URL = "https://$ASSET_HOST$APP_PATH"
        private const val MAX_VALUE_BYTES = 12 * 1024 * 1024
        private const val MAX_DOWNLOAD_BYTES = 40 * 1024 * 1024
        private const val MAX_DOWNLOAD_BASE64_CHARS = 56 * 1024 * 1024
    }
}

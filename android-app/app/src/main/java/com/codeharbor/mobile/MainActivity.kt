package com.codeharbor.mobile

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.LayoutInflater
import android.view.Menu
import android.view.MenuItem
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.addCallback
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import com.codeharbor.mobile.databinding.ActivityMainBinding
import com.codeharbor.mobile.databinding.DialogServerSettingsBinding
import com.google.android.material.dialog.MaterialAlertDialogBuilder

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: android.content.SharedPreferences

    private val settingsKeyUrl = "base_url"
    private val settingsKeyUsername = "username"
    private val settingsKeyPassword = "password"

    private val defaultBaseUrl = "http://10.0.2.2:1657"
    private val defaultUsername = "opencode"
    private val defaultPassword = "opencode-demo-4096"

    private var lastInjectedSignature: String? = null
    private var pendingReloadAfterInjection = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefs = getSharedPreferences("codeharbor_mobile", Context.MODE_PRIVATE)

        setSupportActionBar(binding.toolbar)
        binding.toolbar.setNavigationOnClickListener { showSettingsDialog() }

        configureWebView()
        configureActions()
        updateStatus(StatusState.CONNECTING)
        updateEndpointSummary()

        onBackPressedDispatcher.addCallback(this) {
            if (binding.webView.canGoBack()) {
                binding.webView.goBack()
            } else {
                finish()
            }
        }

        if (savedInstanceState == null) {
            loadConfiguredUrl()
        }
    }

    override fun onRestoreInstanceState(savedInstanceState: Bundle) {
        super.onRestoreInstanceState(savedInstanceState)
        binding.webView.restoreState(savedInstanceState)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        binding.webView.saveState(outState)
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.main_actions, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_refresh -> {
                loadConfiguredUrl(forceReload = true)
                true
            }
            R.id.action_back -> {
                if (binding.webView.canGoBack()) {
                    binding.webView.goBack()
                } else {
                    Toast.makeText(this, R.string.back, Toast.LENGTH_SHORT).show()
                }
                true
            }
            R.id.action_open_browser -> {
                openInBrowser()
                true
            }
            R.id.action_settings -> {
                showSettingsDialog()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }

    private fun configureActions() {
        binding.retryButton.setOnClickListener {
            loadConfiguredUrl(forceReload = true)
        }

        binding.openSettingsButton.setOnClickListener {
            showSettingsDialog()
        }

        binding.swipeRefresh.setOnRefreshListener {
            binding.webView.reload()
        }
    }

    private fun configureWebView() {
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(binding.webView, true)

        binding.webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            builtInZoomControls = false
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
        }

        binding.webView.webChromeClient = WebChromeClient()
        binding.webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                showLoading(true)
                hideError()
                updateStatus(StatusState.LOADING)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                syncCodeHarborStorage()
                showLoading(false)
                hideError()
                updateStatus(StatusState.READY)
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val requestedUrl = request?.url ?: return false
                return if (requestedUrl.scheme == "http" || requestedUrl.scheme == "https") {
                    false
                } else {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, requestedUrl))
                        true
                    } catch (_: ActivityNotFoundException) {
                        true
                    }
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true) {
                    showError(error?.description?.toString() ?: getString(R.string.error_message_default))
                }
            }
        }
    }

    private fun loadConfiguredUrl(forceReload: Boolean = false) {
        if (!isNetworkAvailable()) {
            Toast.makeText(this, R.string.no_network, Toast.LENGTH_SHORT).show()
        }

        val baseUrl = prefs.getString(settingsKeyUrl, defaultBaseUrl).orEmpty().normalizeBaseUrl()
        val username = prefs.getString(settingsKeyUsername, defaultUsername).orEmpty()
        val password = prefs.getString(settingsKeyPassword, defaultPassword).orEmpty()
        val targetUrl = MobileConfigBridge.buildWrapperUrl(baseUrl, username, password)

        if (forceReload) {
            lastInjectedSignature = null
        }

        if (forceReload || binding.webView.url != targetUrl) {
            binding.webView.loadUrl(targetUrl)
        } else {
            binding.webView.reload()
        }
    }

    private fun showSettingsDialog() {
        val dialogBinding = DialogServerSettingsBinding.inflate(LayoutInflater.from(this))
        dialogBinding.baseUrlInput.setText(prefs.getString(settingsKeyUrl, defaultBaseUrl))
        dialogBinding.usernameInput.setText(prefs.getString(settingsKeyUsername, defaultUsername))
        dialogBinding.passwordInput.setText(prefs.getString(settingsKeyPassword, defaultPassword))
        dialogBinding.presetEmulatorButton.setOnClickListener {
            dialogBinding.baseUrlInput.setText(defaultBaseUrl)
        }
        dialogBinding.presetLocalhostButton.setOnClickListener {
            dialogBinding.baseUrlInput.setText("http://127.0.0.1:1657")
        }
        dialogBinding.presetDefaultCredsButton.setOnClickListener {
            dialogBinding.usernameInput.setText(defaultUsername)
            dialogBinding.passwordInput.setText(defaultPassword)
        }

        val dialog = MaterialAlertDialogBuilder(this)
            .setTitle(R.string.server_settings)
            .setView(dialogBinding.root)
            .setNegativeButton(android.R.string.cancel, null)
            .setNeutralButton(R.string.refresh) { _, _ -> loadConfiguredUrl(forceReload = true) }
            .setPositiveButton(android.R.string.ok, null)
            .show()

        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
            val rawUrl = dialogBinding.baseUrlInput.text?.toString().orEmpty().trim()
            val normalizedUrl = rawUrl.normalizeBaseUrl()

            if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
                Toast.makeText(this, R.string.settings_invalid_url, Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }

            prefs.edit()
                .putString(settingsKeyUrl, normalizedUrl)
                .putString(settingsKeyUsername, dialogBinding.usernameInput.text?.toString().orEmpty().trim())
                .putString(settingsKeyPassword, dialogBinding.passwordInput.text?.toString().orEmpty())
                .apply()

            updateEndpointSummary()
            Toast.makeText(this, R.string.settings_saved, Toast.LENGTH_SHORT).show()
            dialog.dismiss()
            loadConfiguredUrl(forceReload = true)
        }
    }

    private fun openInBrowser() {
        val currentUrl = binding.webView.url ?: MobileConfigBridge.buildWrapperUrl(
            prefs.getString(settingsKeyUrl, defaultBaseUrl).orEmpty().normalizeBaseUrl(),
            prefs.getString(settingsKeyUsername, defaultUsername).orEmpty(),
            prefs.getString(settingsKeyPassword, defaultPassword).orEmpty()
        )

        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(currentUrl)))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.browser_missing, Toast.LENGTH_SHORT).show()
        }
    }

    private fun showLoading(isLoading: Boolean) {
        binding.loadingIndicator.isVisible = isLoading
        binding.swipeRefresh.isRefreshing = false
    }

    private fun showError(message: String) {
        showLoading(false)
        binding.errorCard.isVisible = true
        binding.errorMessage.text = message
        updateStatus(StatusState.ERROR)
    }

    private fun hideError() {
        binding.errorCard.isVisible = false
    }

    private fun updateStatus(state: StatusState) {
        when (state) {
            StatusState.CONNECTING -> {
                binding.statusTitle.setText(R.string.status_connecting)
                binding.statusSubtitle.setText(R.string.status_subtitle_default)
            }
            StatusState.LOADING -> {
                binding.statusTitle.setText(R.string.status_loading)
                binding.statusSubtitle.setText(R.string.status_subtitle_loading)
            }
            StatusState.READY -> {
                binding.statusTitle.setText(R.string.status_ready)
                binding.statusSubtitle.setText(R.string.status_subtitle_ready)
            }
            StatusState.ERROR -> {
                binding.statusTitle.setText(R.string.status_error)
                binding.statusSubtitle.setText(R.string.status_subtitle_error)
            }
        }
    }

    private fun isNetworkAvailable(): Boolean {
        val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun updateEndpointSummary() {
        val baseUrl = prefs.getString(settingsKeyUrl, defaultBaseUrl).orEmpty().normalizeBaseUrl()
        val username = prefs.getString(settingsKeyUsername, defaultUsername).orEmpty().ifBlank { defaultUsername }
        binding.statusEndpoint.text = getString(R.string.endpoint_format, baseUrl, username)
    }

    private fun syncCodeHarborStorage() {
        val baseUrl = prefs.getString(settingsKeyUrl, defaultBaseUrl).orEmpty().normalizeBaseUrl()
        val username = prefs.getString(settingsKeyUsername, defaultUsername).orEmpty()
        val password = prefs.getString(settingsKeyPassword, defaultPassword).orEmpty()
        val signature = listOf(baseUrl, username, password).joinToString("|")

        if (lastInjectedSignature == signature) {
            return
        }

        lastInjectedSignature = signature
        pendingReloadAfterInjection = true

        binding.webView.evaluateJavascript(MobileConfigBridge.buildInjectionScript(baseUrl, username, password), null)
        binding.webView.postDelayed({
            if (pendingReloadAfterInjection) {
                pendingReloadAfterInjection = false
                binding.webView.reload()
            }
        }, 120)
    }

    private fun String.normalizeBaseUrl(): String = trim().trimEnd('/')

    private enum class StatusState {
        CONNECTING,
        LOADING,
        READY,
        ERROR,
    }
}

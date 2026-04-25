package com.codeharbor.mobile

import java.net.URLEncoder
import java.nio.charset.StandardCharsets

object MobileConfigBridge {

    private const val CONFIG_STORAGE_KEY = "opencode-remote-config"
    private const val MODEL_STORAGE_KEY = "opencode-remote-model"

    fun buildWrapperUrl(baseUrl: String, username: String, password: String): String {
        return "$baseUrl/?mobile=1&username=${encode(username)}&password=${encode(password)}"
    }

    fun buildInjectionScript(baseUrl: String, username: String, password: String): String {
        val payload = buildConfigPayload(baseUrl, username, password)

        return """
            (function() {
              try {
                window.localStorage.setItem('$CONFIG_STORAGE_KEY', $payload);
                window.sessionStorage.removeItem('$MODEL_STORAGE_KEY');
              } catch (e) {
                console.warn('CodeHarbor mobile storage sync failed', e);
              }
            })();
        """.trimIndent()
    }

    private fun encode(value: String): String =
        URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20")

    private fun buildConfigPayload(baseUrl: String, username: String, password: String): String {
        return jsonString(
            "{" +
                "\"baseUrl\":${jsonString(baseUrl)}," +
                "\"username\":${jsonString(username)}," +
                "\"password\":${jsonString(password)}" +
                "}"
        )
    }

    private fun jsonString(value: String): String = buildString {
        append('"')
        value.forEach { ch ->
            when (ch) {
                '\\' -> append("\\\\")
                '"' -> append("\\\"")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '\t' -> append("\\t")
                else -> append(ch)
            }
        }
        append('"')
    }
}

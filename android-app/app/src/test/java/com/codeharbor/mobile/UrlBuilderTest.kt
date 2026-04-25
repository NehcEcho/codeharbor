package com.codeharbor.mobile

import org.junit.Assert.assertEquals
import org.junit.Test

class UrlBuilderTest {

    @Test
    fun encodesCredentialsIntoWrapperUrl() {
        val result = MobileConfigBridge.buildWrapperUrl(
            baseUrl = "http://10.0.2.2:1657",
            username = "open code",
            password = "pass word"
        )

        assertEquals(
            "http://10.0.2.2:1657/?mobile=1&username=open%20code&password=pass%20word",
            result
        )
    }

    @Test
    fun buildsInjectionScriptWithConfigKeys() {
        val script = MobileConfigBridge.buildInjectionScript(
            baseUrl = "http://server:1657",
            username = "opencode",
            password = "secret"
        )

        assertEquals(true, script.contains("opencode-remote-config"))
        assertEquals(true, script.contains("http://server:1657"))
        assertEquals(true, script.contains("secret"))
    }
}

package com.phvillegas.almanaq.data.api

import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Builds the API client.
 *
 * Two things are set here and nowhere else: the base URL and the `Accept-Language`
 * header. The header is what makes `statusLabel` and `statusDetail` come back in the
 * user's language, so it is attached by an interceptor rather than by each call.
 */
object ApiClient {

    /**
     * Local development address. `10.0.2.2` is how the Android emulator reaches the
     * host machine's localhost; a device on the same network needs the host's LAN IP.
     */
    private const val DEV_BASE_URL = "http://10.0.2.2:3000/"

    private val json = Json {
        // The backend may add fields ahead of the app. Ignoring them keeps an older
        // build working against a newer server.
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    fun create(baseUrl: String = DEV_BASE_URL): AlmanaqApi {
        val client = OkHttpClient.Builder()
            .addInterceptor(languageInterceptor())
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .build()

        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(AlmanaqApi::class.java)
    }

    /**
     * Sends the device languages, in preference order, as `Accept-Language`.
     *
     * The backend picks the first one it supports and falls back to Spanish. The app
     * does not decide the language of the text; it declares a preference.
     */
    private fun languageInterceptor() = Interceptor { chain ->
        val request = chain.request().newBuilder()
            .header("Accept-Language", deviceLanguages())
            .build()
        chain.proceed(request)
    }

    private fun deviceLanguages(): String {
        val locales = android.content.res.Resources.getSystem().configuration.locales
        val tags = (0 until locales.size()).map { locales[it].toLanguageTag() }
        if (tags.isEmpty()) return "es"
        return tags.joinToString(",")
    }
}

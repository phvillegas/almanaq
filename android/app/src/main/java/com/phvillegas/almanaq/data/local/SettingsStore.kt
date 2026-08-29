package com.phvillegas.almanaq.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "settings")

/**
 * App preferences, kept deliberately separate from the team document.
 *
 * PLAN.md section 11: preferences belong to the device and never sync; the team is the
 * only thing that might. Mixing them is what makes a future migration a refactor.
 */
class SettingsStore(private val context: Context) {

    /**
     * Where the backend lives.
     *
     * `10.0.2.2` is how the emulator reaches the host machine. A real phone cannot
     * resolve it and needs the host's address on the local network, which is why this
     * is editable rather than a constant.
     */
    val baseUrl: Flow<String> = context.dataStore.data.map { preferences ->
        preferences[BASE_URL] ?: DEFAULT_BASE_URL
    }

    suspend fun setBaseUrl(value: String) {
        val normalized = value.trim().let { if (it.endsWith("/")) it else "$it/" }
        context.dataStore.edit { preferences -> preferences[BASE_URL] = normalized }
    }

    companion object {
        const val DEFAULT_BASE_URL = "http://10.0.2.2:3000/"
        private val BASE_URL = stringPreferencesKey("base_url")
    }
}

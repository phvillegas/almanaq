package com.phvillegas.almanaq.ui.settings

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.phvillegas.almanaq.R
import com.phvillegas.almanaq.ui.theme.AlmanaqTheme

/**
 * Settings.
 *
 * Only the backend address for now. It is editable because `10.0.2.2` is how the
 * emulator reaches the development machine, and a real phone cannot resolve it: it
 * needs the host's address on the local network.
 */
@Composable
fun SettingsScreen(
    baseUrl: String,
    onBaseUrl: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var value by remember(baseUrl) { mutableStateOf(baseUrl) }

    Column(modifier = modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Text(
            text = stringResource(R.string.settings_title),
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(top = 24.dp, bottom = 16.dp),
        )

        OutlinedTextField(
            value = value,
            onValueChange = { value = it },
            label = { Text(stringResource(R.string.settings_backend_url)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        Text(
            text = stringResource(R.string.settings_backend_hint),
            style = MaterialTheme.typography.bodyMedium,
            color = AlmanaqTheme.colors.textDisabled,
            modifier = Modifier.padding(top = 8.dp),
        )

        Button(onClick = { onBaseUrl(value) }, modifier = Modifier.padding(top = 16.dp)) {
            Text(stringResource(R.string.settings_save))
        }
    }
}

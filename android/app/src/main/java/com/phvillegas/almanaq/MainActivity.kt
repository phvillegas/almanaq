package com.phvillegas.almanaq

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.phvillegas.almanaq.ui.AppViewModel
import com.phvillegas.almanaq.ui.datepicker.DatePickerScreen
import com.phvillegas.almanaq.ui.member.AddMemberScreen
import com.phvillegas.almanaq.ui.member.MemberDetailScreen
import com.phvillegas.almanaq.ui.settings.SettingsScreen
import com.phvillegas.almanaq.ui.team.TeamScreen
import com.phvillegas.almanaq.ui.theme.AlmanaqTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Three tabs and two pushed screens.
 *
 * Navigation is a sealed state rather than a navigation library: five destinations do
 * not justify another dependency and another version to keep aligned with AGP.
 * See CLAUDE.md rule 5.
 */
private sealed interface Destination {
    data object Team : Destination
    data object Dates : Destination
    data object Settings : Destination
    data object AddMember : Destination
    data object Detail : Destination
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AlmanaqTheme {
                AlmanaqApp()
            }
        }
    }
}

/**
 * A tab icon.
 *
 * `contentDescription` repeats the visible label on purpose: TalkBack announces the
 * item once, and a null description would leave the icon silent if the label were ever
 * hidden.
 */
@Composable
private fun TabIcon(drawable: Int, label: Int) {
    Icon(
        painter = painterResource(drawable),
        contentDescription = stringResource(label),
    )
}

@Composable
private fun AlmanaqApp() {
    val model: AppViewModel = viewModel()
    val team by model.team.collectAsStateWithLifecycle()
    val search by model.search.collectAsStateWithLifecycle()
    val calendar by model.calendar.collectAsStateWithLifecycle()
    val detail by model.detail.collectAsStateWithLifecycle()
    val baseUrl by model.baseUrl.collectAsStateWithLifecycle()

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var destination by remember { mutableStateOf<Destination>(Destination.Team) }

    // Section 7.1 lists three moments to re-query availability: on open, on returning
    // from the background, and on pull to refresh. This is the second one. The first
    // resume is the open, which the view model already covered from its own init, so it
    // is skipped rather than fetched twice.
    var resumedOnce by remember { mutableStateOf(false) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        if (!resumedOnce) {
            resumedOnce = true
            return@LifecycleEventEffect
        }
        model.refreshTeam()
    }

    // Import replaces the whole document. A file that does not parse is refused rather
    // than partially applied. See PLAN.md section 11.
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val text = withContext(Dispatchers.IO) {
                runCatching {
                    context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
                }.getOrNull()
            }
            val ok = text != null && model.importJson(text)
            Toast.makeText(
                context,
                context.getString(if (ok) R.string.settings_import_ok else R.string.settings_import_failed),
                Toast.LENGTH_SHORT,
            ).show()
        }
    }
    val isTab = destination is Destination.Team ||
        destination is Destination.Dates ||
        destination is Destination.Settings

    BackHandler(enabled = !isTab) {
        model.clearSearch()
        model.closeDetail()
        destination = Destination.Team
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        bottomBar = {
            if (!isTab) return@Scaffold
            NavigationBar {
                NavigationBarItem(
                    selected = destination is Destination.Team,
                    onClick = { destination = Destination.Team },
                    icon = { TabIcon(R.drawable.ic_team, R.string.tab_team) },
                    label = { Text(stringResource(R.string.tab_team)) },
                )
                NavigationBarItem(
                    selected = destination is Destination.Dates,
                    onClick = {
                        destination = Destination.Dates
                        model.loadCalendar()
                    },
                    icon = { TabIcon(R.drawable.ic_dates, R.string.tab_dates) },
                    label = { Text(stringResource(R.string.tab_dates)) },
                )
                NavigationBarItem(
                    selected = destination is Destination.Settings,
                    onClick = { destination = Destination.Settings },
                    icon = { TabIcon(R.drawable.ic_settings, R.string.tab_settings) },
                    label = { Text(stringResource(R.string.tab_settings)) },
                )
            }
        },
    ) { innerPadding ->
        val content = Modifier.padding(innerPadding)

        when (destination) {
            Destination.Team -> TeamScreen(
                state = team,
                onAdd = { destination = Destination.AddMember },
                onOpen = { member ->
                    model.openDetail(member)
                    destination = Destination.Detail
                },
                onFindTime = {
                    destination = Destination.Dates
                    model.loadCalendar()
                },
                onRefresh = model::refreshTeam,
                modifier = content,
            )

            Destination.Dates -> DatePickerScreen(
                state = calendar,
                onMonth = model::showMonth,
                onSelect = model::selectDay,
                modifier = content,
            )

            Destination.Settings -> SettingsScreen(
                baseUrl = baseUrl,
                onBaseUrl = model::updateBaseUrl,
                onExport = {
                    scope.launch {
                        val json = model.exportJson()
                        val send = Intent(Intent.ACTION_SEND).apply {
                            type = "application/json"
                            putExtra(Intent.EXTRA_TEXT, json)
                        }
                        context.startActivity(Intent.createChooser(send, null))
                    }
                },
                onImport = { picker.launch(arrayOf("application/json", "text/plain")) },
                modifier = content,
            )

            Destination.AddMember -> AddMemberScreen(
                state = search,
                onQuery = model::onSearchQuery,
                onPick = { name, location ->
                    model.addMember(name, location)
                    model.clearSearch()
                    destination = Destination.Team
                },
                onCancel = {
                    model.clearSearch()
                    destination = Destination.Team
                },
                modifier = content,
            )

            Destination.Detail -> MemberDetailScreen(
                state = detail,
                onBack = {
                    model.closeDetail()
                    destination = Destination.Team
                },
                onRemove = { id ->
                    model.removeMember(id)
                    model.closeDetail()
                    destination = Destination.Team
                },
                onOverrides = { id, overrides ->
                    model.updateOverrides(id, overrides)
                    model.closeDetail()
                    destination = Destination.Team
                },
                modifier = content,
            )
        }
    }
}

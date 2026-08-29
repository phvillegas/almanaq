package com.phvillegas.almanaq

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.phvillegas.almanaq.ui.team.TeamScreen
import com.phvillegas.almanaq.ui.team.TeamViewModel
import com.phvillegas.almanaq.ui.theme.AlmanaqTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AlmanaqTheme {
                val model: TeamViewModel = viewModel()
                val state by model.state.collectAsStateWithLifecycle()

                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    TeamScreen(
                        state = state,
                        // Inert until the add-member screen exists. See PLAN.md 7.1
                        // step 4 of the phase 2 order.
                        onAdd = {},
                        modifier = Modifier.padding(innerPadding),
                    )
                }
            }
        }
    }
}

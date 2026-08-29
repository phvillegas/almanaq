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
                    TeamScreen(state = state, modifier = Modifier.padding(innerPadding))
                }
            }
        }
    }
}

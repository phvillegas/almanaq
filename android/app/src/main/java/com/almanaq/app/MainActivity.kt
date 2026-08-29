package com.almanaq.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import com.almanaq.app.ui.theme.AlmanaqTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AlmanaqTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    Placeholder(modifier = Modifier.padding(innerPadding))
                }
            }
        }
    }
}

/** Stands in until the "Now" screen exists. See PLAN.md section 7.1. */
@Composable
private fun Placeholder(modifier: Modifier = Modifier) {
    Text(
        text = "Almanaq",
        style = MaterialTheme.typography.displayLarge,
        color = MaterialTheme.colorScheme.primary,
        modifier = modifier,
    )
}

@Preview(showBackground = true)
@Composable
private fun PlaceholderPreview() {
    AlmanaqTheme {
        Placeholder()
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF0F0E1C)
@Composable
private fun PlaceholderDarkPreview() {
    AlmanaqTheme(darkTheme = true) {
        Placeholder()
    }
}

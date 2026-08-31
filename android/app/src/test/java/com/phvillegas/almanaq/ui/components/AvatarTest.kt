package com.phvillegas.almanaq.ui.components

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Avatar initials.
 *
 * Names in this product come from a text field with no validation on it, so the cases
 * worth pinning are the messy ones: one word, five words, and stray whitespace.
 */
class AvatarTest {

    @Test
    fun `takes the first letter of the first two words`() {
        assertEquals("AR", initialsOf("Ana Ruiz"))
        assertEquals("SB", initialsOf("Selam Bekele"))
    }

    @Test
    fun `stops at two`() {
        assertEquals("MJ", initialsOf("María José García Pérez"))
    }

    @Test
    fun `handles a single word`() {
        assertEquals("P", initialsOf("Prince"))
    }

    @Test
    fun `uppercases whatever it is given`() {
        assertEquals("AR", initialsOf("ana ruiz"))
    }

    @Test
    fun `survives stray whitespace`() {
        assertEquals("AR", initialsOf("  Ana   Ruiz  "))
    }

    @Test
    fun `returns nothing rather than failing on an empty name`() {
        assertEquals("", initialsOf(""))
        assertEquals("", initialsOf("   "))
    }
}

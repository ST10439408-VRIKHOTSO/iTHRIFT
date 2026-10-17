package com.codecouture.ithrift.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Unit tests for the input validation every form in the app runs through.
 *
 * These are the rules the customer meets first, and they are the ones most
 * easily broken by a small edit, so they are pinned here. The tests run on a
 * plain JVM, with no emulator and no device, which is why Validators is
 * written without any Android type. `./gradlew testDebugUnitTest` runs them on every
 * push through .github/workflows/android.yml.
 *
 * The convention under test: null means the value is acceptable, a string is
 * the message to show against the field.
 */
class ValidatorsTest {

    // --- Email --------------------------------------------------------------

    @Test
    fun `ordinary email addresses are accepted`() {
        assertNull(Validators.email("lerato.m@gmail.com"))
        assertNull(Validators.email("buyer@example.co.za"))
        assertNull(Validators.email("first.last+tag@sub.domain.org"))
    }

    @Test
    fun `an email address is trimmed before it is judged`() {
        // A trailing space is what a phone keyboard's autocomplete leaves
        // behind. Rejecting the address for it would be indefensible.
        assertNull(Validators.email("  lerato.m@gmail.com  "))
    }

    @Test
    fun `malformed email addresses are rejected`() {
        assertNotNull(Validators.email("not-an-email"))
        assertNotNull(Validators.email("missing@domain"))
        assertNotNull(Validators.email("@nolocalpart.com"))
        assertNotNull(Validators.email("two spaces@example.com"))
    }

    @Test
    fun `an empty email asks for one rather than calling it invalid`() {
        assertEquals("Enter your email address.", Validators.email(""))
        assertEquals("Enter your email address.", Validators.email("   "))
    }

    // --- Password -----------------------------------------------------------
    // These must agree with isPasswordStrong() in server/utils/password.js.
    // If the two ever disagree, the customer is told their password is fine
    // and then rejected by the server, which is the worst of both.

    @Test
    fun `a password meeting the policy is accepted`() {
        assertNull(Validators.password("Password1"))
        assertNull(Validators.password("Str0ngEnough"))
    }

    @Test
    fun `each part of the password policy is enforced separately`() {
        assertEquals("Password must be at least 8 characters long.", Validators.password("Pass1"))
        assertEquals("Password must include an uppercase letter.", Validators.password("password1"))
        assertEquals("Password must include a number.", Validators.password("Passwordd"))
    }

    @Test
    fun `a password of exactly eight characters is long enough`() {
        // The rule is "at least 8", so 8 must pass. Off-by-one here would
        // reject a password the server accepts.
        assertNull(Validators.password("Passwor1"))
    }

    @Test
    fun `the sign-in form only checks that a password was typed`() {
        // An existing customer may have a password set before the policy
        // tightened. Re-applying the policy at sign-in would lock them out.
        assertNull(Validators.passwordPresent("short"))
        assertNotNull(Validators.passwordPresent(""))
    }

    // --- Required fields ----------------------------------------------------

    @Test
    fun `a required field names itself in the message`() {
        assertEquals("First name is required.", Validators.required("", "First name"))
        assertEquals("City is required.", Validators.required("   ", "City"))
        assertNull(Validators.required("Lerato", "First name"))
    }

    // --- Quantity -----------------------------------------------------------

    @Test
    fun `a quantity within stock is accepted`() {
        assertNull(Validators.quantity("1", inStock = 3))
        assertNull(Validators.quantity("3", inStock = 3))
    }

    @Test
    fun `a quantity above stock is rejected and says how many are left`() {
        assertEquals("Only 2 in stock.", Validators.quantity("5", inStock = 2))
    }

    @Test
    fun `an out of stock item cannot be ordered at any quantity`() {
        assertEquals("That item is out of stock.", Validators.quantity("1", inStock = 0))
    }

    @Test
    fun `a quantity that is not a whole number is rejected`() {
        assertNotNull(Validators.quantity("two", inStock = 5))
        assertNotNull(Validators.quantity("1.5", inStock = 5))
        assertNotNull(Validators.quantity("", inStock = 5))
    }

    @Test
    fun `zero and negative quantities are rejected`() {
        assertEquals("Order at least one.", Validators.quantity("0", inStock = 5))
        assertEquals("Order at least one.", Validators.quantity("-3", inStock = 5))
    }

    // --- Postal code --------------------------------------------------------

    @Test
    fun `a four digit postal code is accepted and anything else is not`() {
        assertNull(Validators.postalCode("0181"))
        assertNull(Validators.postalCode(" 2196 "))
        assertNotNull(Validators.postalCode("018"))
        assertNotNull(Validators.postalCode("01811"))
        assertNotNull(Validators.postalCode("ABCD"))
    }

    @Test
    fun `a blank postal code is allowed because the field is optional`() {
        assertNull(Validators.postalCode(""))
        assertNull(Validators.postalCode("   "))
    }

    // --- Phone --------------------------------------------------------------

    @Test
    fun `South African numbers are accepted however they are spaced`() {
        assertNull(Validators.phone("0821234567"))
        assertNull(Validators.phone("082 123 4567"))
        assertNull(Validators.phone("+27 82 123 4567"))
        assertNull(Validators.phone("+27821234567"))
    }

    @Test
    fun `numbers of the wrong length or shape are rejected`() {
        assertNotNull(Validators.phone("082 123"))
        assertNotNull(Validators.phone("08212345678"))
        assertNotNull(Validators.phone("1234567890"))
    }

    @Test
    fun `a blank phone number is allowed because the field is optional`() {
        assertNull(Validators.phone(""))
        assertNull(Validators.phone("  "))
    }
}

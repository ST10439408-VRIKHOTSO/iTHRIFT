package com.ithrift.app.util

/**
 * Input validation for every form in the app.
 *
 * Two deliberate decisions here.
 *
 * First, the rules live in one object rather than being written inline in
 * each fragment, so "what counts as a valid password" is answered in exactly
 * one place and matches the server's own rule in server/utils/password.js.
 * When the two disagree the customer gets an error only after a round trip,
 * which is the frustrating kind.
 *
 * Second, nothing in this file touches the Android framework: no Context,
 * no android.util.Patterns. That is what lets the unit tests under
 * app/src/test/ run on a plain JVM in a couple of seconds on the CI runner,
 * with no emulator.
 *
 * Every function returns null when the value is acceptable, or the message
 * to show against the field when it is not. Client-side validation is a
 * courtesy that saves a round trip; the server re-checks everything and
 * remains the authority.
 *
 * References:
 *  - OWASP Input Validation Cheat Sheet (validate on the server, use the client for feedback):
 *    https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
 *  - OWASP Authentication Cheat Sheet (password rules):
 *    https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
 */
object Validators {

    // Deliberately permissive: something, an @, something, a dot, something,
    // with no whitespace. Trying to encode RFC 5322 in a regular expression
    // is a well-known way to reject real addresses, and the confirmation of
    // an address is that mail to it arrives, not that a pattern matched.
    private val EMAIL = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")

    fun email(value: String): String? {
        val trimmed = value.trim()
        return when {
            trimmed.isEmpty() -> "Enter your email address."
            !EMAIL.matches(trimmed) -> "Enter a valid email address, for example name@example.com."
            else -> null
        }
    }

    /** Mirrors isPasswordStrong() in server/utils/password.js. Keep the two in step. */
    fun password(value: String): String? = when {
        value.isEmpty() -> "Enter a password."
        value.length < 8 -> "Password must be at least 8 characters long."
        !value.any { it.isUpperCase() } -> "Password must include an uppercase letter."
        !value.any { it.isDigit() } -> "Password must include a number."
        else -> null
    }

    /** A password field on a sign-in form: present, but not re-checked against the policy. */
    fun passwordPresent(value: String): String? =
        if (value.isEmpty()) "Enter your password." else null

    fun required(value: String, fieldName: String): String? =
        if (value.trim().isEmpty()) "$fieldName is required." else null

    /**
     * A quantity the customer typed, checked against the stock the server
     * last reported. The server locks stock again at checkout, so this only
     * stops an obviously impossible order early.
     */
    fun quantity(value: String, inStock: Int): String? {
        val number = value.trim().toIntOrNull() ?: return "Enter a quantity as a whole number."
        return when {
            number < 1 -> "Order at least one."
            inStock <= 0 -> "That item is out of stock."
            number > inStock -> "Only $inStock in stock."
            else -> null
        }
    }

    /** South African postal codes are four digits. Blank is allowed, because the field is optional. */
    fun postalCode(value: String): String? {
        val trimmed = value.trim()
        if (trimmed.isEmpty()) return null
        return if (Regex("^\\d{4}$").matches(trimmed)) null else "A South African postal code is four digits."
    }

    /**
     * A South African phone number, accepting the ways people actually type
     * one: "0821234567", "082 123 4567", "+27 82 123 4567". Blank is allowed -
     * the field is optional.
     */
    fun phone(value: String): String? {
        val trimmed = value.trim()
        if (trimmed.isEmpty()) return null
        val digits = trimmed.filter { it.isDigit() }
        val looksLikeSaNumber = when {
            trimmed.startsWith("+27") -> digits.length == 11
            trimmed.startsWith("0") -> digits.length == 10
            else -> false
        }
        return if (looksLikeSaNumber) null else "Enter a South African number, for example 082 123 4567."
    }

    /**
     * A cellphone number in its national ten-digit form ("0825550101"), or
     * null when it is not one. Mirrors normalisePhone() in server/utils/phone.js.
     */
    fun nationalCellphone(value: String): String? {
        var d = value.trim().filterNot { it == ' ' || it == '-' || it == '(' || it == ')' }
        if (d.startsWith("+27")) d = "0" + d.drop(3)
        else if (d.startsWith("27") && d.length == 11) d = "0" + d.drop(2)
        return if (Regex("^0[6-8]\\d{8}$").matches(d)) d else null
    }

    /** The cellphone number an account must have: required, and a real South African mobile number. */
    fun cellphone(value: String): String? = when {
        value.isBlank() -> "Enter your cellphone number."
        nationalCellphone(value) == null -> "Enter a South African cellphone number, for example 082 123 4567."
        else -> null
    }

    /** The second password box on a form that sets a password. */
    fun confirmPassword(password: String, confirm: String): String? = when {
        confirm.isEmpty() -> "Enter the password again."
        confirm != password -> "The two passwords do not match."
        else -> null
    }

    /** What a person signs in with: an email address or a cellphone number, never a username. */
    fun signInIdentifier(value: String): String? {
        val v = value.trim()
        return when {
            v.isEmpty() -> "Enter your email address or cellphone number."
            v.contains('@') -> email(v)
            Regex("^[+\\d][\\d\\s\\-()]*$").matches(v) -> if (nationalCellphone(v) == null) "Enter a South African cellphone number, for example 082 123 4567." else null
            else -> "Enter an email address or a cellphone number, for example 082 123 4567."
        }
    }
}

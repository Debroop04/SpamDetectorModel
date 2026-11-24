package app.callshield.data

/** Same rules as the backend's normalize_number, so numbers match the server's lists exactly. */
object PhoneNumbers {
    private const val DEFAULT_COUNTRY = "91"

    fun normalize(raw: String?): String {
        if (raw.isNullOrBlank()) return ""
        val trimmed = raw.trim()
        val digits = trimmed.filter { it.isDigit() }
        if (digits.length < 6) return ""
        return when {
            trimmed.startsWith("00") -> "+" + digits.trimStart('0')
            trimmed.startsWith("+") -> "+$digits"
            digits.length == 11 && digits.startsWith("0") -> "+$DEFAULT_COUNTRY${digits.drop(1)}"
            digits.length == 10 -> "+$DEFAULT_COUNTRY$digits"
            else -> "+$digits"
        }
    }

    fun display(number: String?): String {
        if (number.isNullOrBlank()) return "Hidden number"
        if (number.startsWith("+91") && number.length == 13) return "+91 ${number.substring(3, 8)} ${number.substring(8)}"
        if (number.startsWith("+1") && number.length == 12) return "+1 ${number.substring(2, 5)} ${number.substring(5, 8)} ${number.substring(8)}"
        return number
    }
}

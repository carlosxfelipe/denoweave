%dw 2.0
output application/json

// Parse each log line and enrich with a severity label
fun severityLabel(level: String) =
  level match {
  case "ERROR" -> "🔴 Critical"
  case "WARN" -> "🟡 Warning"
  case "INFO" -> "🟢 Info"
  else -> "⚪ Unknown"
}

---
{
  summary: {
    total: sizeOf(payload),
    errors: sizeOf(payload filter ($.level == "ERROR")),
    warnings: sizeOf(payload filter ($.level == "WARN"))
  },
  logs: payload orderBy ($.timestamp) map (entry) -> {
    timestamp: entry.timestamp,
    severity: severityLabel(entry.level),
    service: upper(entry.service),
    message: entry.message
  }
}

%dw 2.0
output application/json
var startDate = |2024-02-20|
---
{
  // --- Literal Date Math ---
  "projectStart": |2024-02-20|,
  "phase1_Deadline": |2024-02-20| + |P1M10D|, // Feb 20 + 1 month + 10 days = Mar 30
  "phase2_Deadline": |2024-02-20| + |P3M|,    // May 20

  // Leap year edge case
  "leapYearCheck": {
    "start": |2024-02-28|,
    "nextDay": |2024-02-28| + |P1D|, // 2024-02-29
    "nextYear": |2024-02-29| + |P1Y| // 2025-02-28
  },

  // Time Math
  "meeting": {
    "start": |2024-02-25T14:00:00|,
    "end": |2024-02-25T14:00:00| + |PT1H30M|
  },

  // Subtraction
  "pastDate": |2024-01-15| - |P1M5D|,

  // --- Dynamic coercion from payload ---
  // payload = { "eventDate": "2024-06-01", "duration": "P2M" }
  "fromPayload": {
    "eventDeadline": (payload.eventDate as Date) + |P30D|,
    "customDuration": |2024-01-01| + (payload.duration as Period),
    "dateAsString": |2024-03-15| as String
  }
}

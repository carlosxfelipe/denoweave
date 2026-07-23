%dw 2.0
output application/json
var startDate = |2024-02-20| // We can use literal directly or parse from payload... wait, our literals are parsed statically! Let's mix both literal syntax and payload parsing if possible. Oh wait, DenoWeave doesn't have a dynamic `Temporal.PlainDate.from` function exposed to DWL yet! The user must use literals right now because `as Date` isn't fully wired for Temporal.
// Let's just showcase the Date Literals themselves as requested!
---
{
  "projectStart": |2024-02-20|,
  "phase1_Deadline": |2024-02-20| + |P1M10D|, // Leap year! Feb 20 + 1 month = Mar 20 + 10 days = Mar 30
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
  "pastDate": |2024-01-15| - |P1M5D|
}

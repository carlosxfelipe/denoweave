%dw 2.0
output application/json
---
{
  // --- Literal Date Math (Hardcoded) ---
  "literals": {
    "start": |2024-02-28|,
    "nextDay": |2024-02-28| + |P1D|,
    "nextYear": |2024-02-29| + |P1Y|,
    "pastDate": |2024-01-15| - |P1M5D|
  },

  // --- Dynamic Math (Reading from Payload) ---
  "projectStart": payload.projectStart as Date,
  
  "deadlines": {
    "phase1": (payload.projectStart as Date) + (payload.deadlines.phase1 as Period),
    "phase2": (payload.projectStart as Date) + (payload.deadlines.phase2 as Period),
    "bufferDate": (payload.projectStart as Date) + (payload.deadlines.buffer as Period)
  },

  "meeting": {
    "start": payload.meetingTime as DateTime,
    "end": (payload.meetingTime as DateTime) + (payload.meetingDuration as Period)
  },

  "otherEvents": {
    "eventDeadline": (payload.eventDate as Date) + |P30D|,
    "customDuration": |2024-01-01| + (payload.duration as Period)
  }
}

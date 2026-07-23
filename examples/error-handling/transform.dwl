%dw 2.0
output application/json

// Simulates a real-world scenario where records coming from an external
// source may have missing or null fields that would normally crash the
// entire transformation. Using try(), each record is processed safely:
// failures are captured and flagged instead of aborting the pipeline.

fun processRecord(emp) = {
  id:         emp.id,
  fullName:   upper(emp.name),
  annualSalary: emp.salary * 12,
  dept:       emp.department.name
}

---
payload map ((emp) ->
  do {
    var result = try(() -> processRecord(emp))
    ---
    if (result.success)
      {
        status: "OK",
        data:   result.value
      }
    else
      {
        status:  "ERROR",
        id:      emp.id,
        reason:  result.error.message
      }
  }
)

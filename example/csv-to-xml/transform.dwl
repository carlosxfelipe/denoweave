%dw 2.0
output application/xml
input payload application/csv

// Group employees by department and build an XML structure
---
{
  company: {
      departments: mapObject(
          groupBy(payload, (emp) -> emp.department),
          (employees, deptName) -> {
              department: {
                  "@name": deptName,
                  employees: employees map (emp) -> {
                            employee: {
                                "@id": emp.id,
                                name: emp.name,
                                salary: emp.salary as Number
                              }
                          }
                }
            }
    )
    }
}

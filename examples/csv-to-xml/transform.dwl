%dw 2.0
output application/xml

// Group employees by department and build an XML structure
---
{
  company: {
    departments: {
      (
        payload groupBy (emp) -> emp.department
        pluck ((employees, deptName) -> {
          department: {
            "@name": deptName,
            employees: {
              (
                employees map (emp) -> {
                  employee: {
                    "@id": emp.id,
                    name: emp.name,
                    salary: emp.salary as Number
                  }
                }
              )
            }
          }
        })
      )
    }
  }
}

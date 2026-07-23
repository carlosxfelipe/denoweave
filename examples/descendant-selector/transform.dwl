%dw 2.0
output application/json
---
{
  "all_names": payload..name,
  
  "employees_only": payload.company.departments flatMap (dept) -> 
    dept.employees..name,
    
  "roles": (payload..role) distinctBy $
}

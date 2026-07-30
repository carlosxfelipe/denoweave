%dw 2.0
output application/json

// Aggregate an XLSX sales report by region
---
{
  summary: {
    totalRows: sizeOf(payload),
    totalRevenue: sum(payload map (r) -> r.revenue default 0),
    regions: (payload groupBy (r) -> r.region)
    pluck ((rows, region) -> {
        region: region,
        sales: sizeOf(rows),
        revenue: sum(rows map (r) -> r.revenue default 0)
      })
  },
  topPerformers: (payload orderBy (-($.revenue default 0))) take 3
}

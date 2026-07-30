%dw 2.0
output application/json

// Split a raw CSV-like text report into structured records
var lines = split(trim(payload), "\n")
var header = split(lines[0], ",")
var rows = drop(lines, 1)

fun parseLine(line: String) =
  zip(header, split(line, ","))
reduce ((pair, acc = { }) -> acc ++ { (trim(pair[0])): trim(pair[1]) })

---
{
  totalLines: sizeOf(rows),
  records: rows map parseLine
}

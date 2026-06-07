import { evaluate } from "../../src/evaluator/evaluator.ts";

const script = `
%dw 2.0
output application/json
---
{
  arrayConcat: [1] ++ [2, 3],
  stringConcat: "hello" ++ " world",
  objConcat: { a: 1 } ++ { b: 2 },
  range: 1 to 3,
  reverseRange: 3 to 1,
  arraySlice: ["A", "B", "C", "D"][1 to 2],
  stringSlice: "DataWeave"[0 to 3]
}
`;

const result = evaluate(script, {});
console.log(JSON.stringify(result, null, 2));

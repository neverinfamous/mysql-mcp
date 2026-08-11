import { z } from "zod"; try { z.object({}).strict().parse({fuzz: "data"}); console.log("success"); } catch (e) { console.log(e); }

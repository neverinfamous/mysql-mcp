import { describe, it, expect } from "vitest";
import { transformAutoReturn } from "../auto-return.js";

describe("transformAutoReturn", () => {
  it("should prepend return to a single expression statement", () => {
    expect(transformAutoReturn("42")).toBe("return 42");
    expect(transformAutoReturn("mysql.query('SELECT 1')")).toBe("return mysql.query('SELECT 1')");
  });

  it("should prepend return to the last statement in a multi-statement snippet", () => {
    expect(transformAutoReturn("const x = 1;\nx + 1")).toBe("const x = 1;\n\nreturn x + 1");
    expect(transformAutoReturn("const x = 1; x + 1")).toBe("const x = 1;\nreturn x + 1");
    expect(transformAutoReturn("const x = 1; x + 1;")).toBe("const x = 1; x + 1;");
  });

  it("should not prepend return if last statement is a declaration or control flow", () => {
    expect(transformAutoReturn("const x = 1;")).toBe("const x = 1;");
    expect(transformAutoReturn("let y = 2")).toBe("let y = 2");
    expect(transformAutoReturn("if (true) { }")).toBe("if (true) { }");
    expect(transformAutoReturn("for (let i = 0; i < 5; i++) {}")).toBe("for (let i = 0; i < 5; i++) {}");
  });

  it("should handle empty or whitespace-only code", () => {
    expect(transformAutoReturn("")).toBe("");
    expect(transformAutoReturn("   ")).toBe("   ");
  });

  it("should handle code that already returns", () => {
    expect(transformAutoReturn("return 42")).toBe("return 42");
    expect(transformAutoReturn("const x = 1;\nreturn x")).toBe("const x = 1;\nreturn x");
  });

  it("should correctly identify boundaries with braces", () => {
    expect(transformAutoReturn("function foo() { return 1; }; foo()")).toBe("function foo() { return 1; };\nreturn foo()");
  });
});

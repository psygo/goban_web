import { describe, expect, it } from "vitest";
import { SGFParseError, isSGFPass, parseSGF, sgfPointToVertex } from "../src/core/sgf";

describe("parseSGF", () => {
  it("parses a single node with multiple properties", () => {
    const [tree] = parseSGF("(;FF[4]GM[1]SZ[9])");
    expect(tree!.nodes).toHaveLength(1);
    expect(tree!.nodes[0]!.properties).toEqual({
      FF: ["4"],
      GM: ["1"],
      SZ: ["9"],
    });
    expect(tree!.children).toEqual([]);
  });

  it("parses a sequence of nodes", () => {
    const [tree] = parseSGF("(;FF[4];B[pd];W[dp])");
    expect(tree!.nodes).toHaveLength(3);
    expect(tree!.nodes[1]!.properties).toEqual({ B: ["pd"] });
    expect(tree!.nodes[2]!.properties).toEqual({ W: ["dp"] });
  });

  it("parses multiple values for a single property", () => {
    const [tree] = parseSGF("(;AB[aa][bb][cc])");
    expect(tree!.nodes[0]!.properties["AB"]).toEqual(["aa", "bb", "cc"]);
  });

  it("parses branching variations", () => {
    const [tree] = parseSGF("(;FF[4](;B[pd])(;B[dp];W[pp]))");
    expect(tree!.nodes).toHaveLength(1);
    expect(tree!.children).toHaveLength(2);
    expect(tree!.children[0]!.nodes[0]!.properties).toEqual({ B: ["pd"] });
    expect(tree!.children[1]!.nodes).toHaveLength(2);
    expect(tree!.children[1]!.nodes[1]!.properties).toEqual({ W: ["pp"] });
  });

  it("parses a collection of multiple game trees", () => {
    const trees = parseSGF("(;FF[4]GM[1]) (;FF[4]GM[1])");
    expect(trees).toHaveLength(2);
  });

  it("unescapes backslash-escaped characters in property values", () => {
    const [tree] = parseSGF(String.raw`(;C[a \] bracket and a \\ backslash])`);
    expect(tree!.nodes[0]!.properties["C"]).toEqual(["a ] bracket and a \\ backslash"]);
  });

  it("removes soft line breaks (backslash-newline) from property values", () => {
    const [tree] = parseSGF("(;C[line one\\\nline two])");
    expect(tree!.nodes[0]!.properties["C"]).toEqual(["line oneline two"]);
  });

  it("preserves hard line breaks in property values", () => {
    const [tree] = parseSGF("(;C[line one\nline two])");
    expect(tree!.nodes[0]!.properties["C"]).toEqual(["line one\nline two"]);
  });

  it("tolerates whitespace between tokens", () => {
    const [tree] = parseSGF("( ; FF[4] ; B[pd] )");
    expect(tree!.nodes).toHaveLength(2);
  });

  it("throws on empty input", () => {
    expect(() => parseSGF("")).toThrow(SGFParseError);
  });

  it("throws when a game tree is missing its opening paren", () => {
    expect(() => parseSGF(";FF[4])")).toThrow(SGFParseError);
  });

  it("throws when a property has no value", () => {
    expect(() => parseSGF("(;FF)")).toThrow(SGFParseError);
  });

  it("throws on an unterminated property value", () => {
    expect(() => parseSGF("(;C[unterminated)")).toThrow(SGFParseError);
  });

  it("throws when a game tree has no nodes", () => {
    expect(() => parseSGF("()")).toThrow(SGFParseError);
  });
});

describe("sgfPointToVertex", () => {
  it("converts lowercase letter pairs to zero-indexed coordinates", () => {
    expect(sgfPointToVertex("aa")).toEqual({ x: 0, y: 0 });
    expect(sgfPointToVertex("pd")).toEqual({ x: 15, y: 3 });
    expect(sgfPointToVertex("ss")).toEqual({ x: 18, y: 18 });
  });

  it("converts uppercase letters for boards larger than 26x26", () => {
    expect(sgfPointToVertex("AA")).toEqual({ x: 26, y: 26 });
  });

  it("returns null for values that aren't two-letter points", () => {
    expect(sgfPointToVertex("")).toBeNull();
    expect(sgfPointToVertex("a")).toBeNull();
    expect(sgfPointToVertex("abc")).toBeNull();
  });
});

describe("isSGFPass", () => {
  it("treats an empty value as a pass", () => {
    expect(isSGFPass("", 19)).toBe(true);
  });

  it("treats 'tt' as a pass only on boards up to 19x19", () => {
    expect(isSGFPass("tt", 19)).toBe(true);
    expect(isSGFPass("tt", 21)).toBe(false);
  });

  it("does not treat a real point as a pass", () => {
    expect(isSGFPass("pd", 19)).toBe(false);
  });
});

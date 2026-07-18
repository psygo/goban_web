import type { Vertex } from "./types";

export type SGFProperties = Record<string, string[]>;

export interface SGFNode {
  properties: SGFProperties;
}

export interface SGFGameTree {
  nodes: SGFNode[];
  children: SGFGameTree[];
}

export class SGFParseError extends Error {
  constructor(message: string, readonly position: number) {
    super(`${message} (at position ${position})`);
    this.name = "SGFParseError";
  }
}

/** Parses an SGF collection (one or more game trees) into a tree structure. */
export function parseSGF(input: string): SGFGameTree[] {
  return new SGFParser(input).parseCollection();
}

class SGFParser {
  private pos = 0;

  constructor(private readonly text: string) {}

  parseCollection(): SGFGameTree[] {
    const trees: SGFGameTree[] = [];
    this.skipWhitespace();
    if (this.pos >= this.text.length) {
      throw new SGFParseError("Empty SGF input", this.pos);
    }
    while (this.pos < this.text.length) {
      this.skipWhitespace();
      if (this.pos >= this.text.length) break;
      trees.push(this.parseGameTree());
      this.skipWhitespace();
    }
    return trees;
  }

  private parseGameTree(): SGFGameTree {
    this.expect("(");
    const nodes = this.parseSequence();
    const children: SGFGameTree[] = [];
    this.skipWhitespace();
    while (this.peek() === "(") {
      children.push(this.parseGameTree());
      this.skipWhitespace();
    }
    this.expect(")");
    return { nodes, children };
  }

  private parseSequence(): SGFNode[] {
    const nodes: SGFNode[] = [];
    this.skipWhitespace();
    while (this.peek() === ";") {
      nodes.push(this.parseNode());
      this.skipWhitespace();
    }
    if (nodes.length === 0) {
      throw new SGFParseError("Expected at least one node in game tree", this.pos);
    }
    return nodes;
  }

  private parseNode(): SGFNode {
    this.expect(";");
    const properties: SGFProperties = {};
    this.skipWhitespace();
    while (this.isUpperOrLowerLetter(this.peek())) {
      const { id, values } = this.parseProperty();
      properties[id] = values;
      this.skipWhitespace();
    }
    return { properties };
  }

  private parseProperty(): { id: string; values: string[] } {
    const start = this.pos;
    let id = "";
    while (this.isUpperOrLowerLetter(this.peek())) {
      id += this.text[this.pos];
      this.pos++;
    }
    // Property identifiers are conventionally uppercase; normalize the
    // occasional lowercase-emitting tool output to the standard form.
    id = id.toUpperCase();
    this.skipWhitespace();
    if (this.peek() !== "[") {
      throw new SGFParseError(`Property "${id}" has no value`, start);
    }
    const values: string[] = [];
    while (this.peek() === "[") {
      values.push(this.parsePropertyValue());
      this.skipWhitespace();
    }
    return { id, values };
  }

  private parsePropertyValue(): string {
    this.expect("[");
    let raw = "";
    while (this.peek() !== "]") {
      if (this.pos >= this.text.length) {
        throw new SGFParseError("Unterminated property value", this.pos);
      }
      const ch = this.text[this.pos]!;
      if (ch === "\\") {
        this.pos++;
        const next = this.text[this.pos];
        if (next === undefined) {
          throw new SGFParseError("Unterminated escape sequence", this.pos);
        }
        if (next === "\r" || next === "\n") {
          this.consumeLineBreak();
          continue;
        }
        raw += next;
        this.pos++;
        continue;
      }
      raw += ch;
      this.pos++;
    }
    this.expect("]");
    return raw;
  }

  /** Consumes a line break, including CRLF/LFCR pairs, as a single unit. */
  private consumeLineBreak(): void {
    const ch = this.text[this.pos];
    this.pos++;
    const next = this.text[this.pos];
    if ((ch === "\r" && next === "\n") || (ch === "\n" && next === "\r")) {
      this.pos++;
    }
  }

  private skipWhitespace(): void {
    while (this.pos < this.text.length && /\s/.test(this.text[this.pos]!)) {
      this.pos++;
    }
  }

  private peek(): string | undefined {
    return this.text[this.pos];
  }

  private isUpperOrLowerLetter(char: string | undefined): boolean {
    return char !== undefined && /[A-Za-z]/.test(char);
  }

  private expect(char: string): void {
    if (this.text[this.pos] !== char) {
      throw new SGFParseError(`Expected "${char}"`, this.pos);
    }
    this.pos++;
  }
}

/**
 * Converts an SGF point/move value (e.g. "pd") to zero-indexed board
 * coordinates. Returns null for values that aren't a two-letter point,
 * such as a pass ("" in FF[4], or "tt" on boards up to 19x19 in FF[3]).
 */
export function sgfPointToVertex(value: string): Vertex | null {
  if (value.length !== 2) return null;
  const x = sgfCharToIndex(value[0]!);
  const y = sgfCharToIndex(value[1]!);
  if (x === null || y === null) return null;
  return { x, y };
}

/** True if an SGF move value represents a pass. */
export function isSGFPass(value: string, boardSize: number): boolean {
  return value === "" || (boardSize <= 19 && value === "tt");
}

/**
 * Converts a node's list of point values for a given property (e.g. the
 * setup properties `AB`/`AW`/`AE`, or the point-list markup properties
 * `TR`/`SQ`/`CR`/`MA`) to vertices, silently skipping any value that
 * isn't a valid two-letter point. Missing property returns `[]`.
 */
export function sgfPointsForProperty(node: SGFNode, id: string): Vertex[] {
  const values = node.properties[id];
  if (!values) return [];
  const vertices: Vertex[] = [];
  for (const value of values) {
    const vertex = sgfPointToVertex(value);
    if (vertex) vertices.push(vertex);
  }
  return vertices;
}

/**
 * Splits a single `LB` value (`"xy:text"`) into its point and label text.
 * Returns `null` if `value` isn't a two-letter point followed by `:`.
 */
export function parseSGFLabel(value: string): { vertex: Vertex; text: string } | null {
  const separator = value.indexOf(":");
  if (separator === -1) return null;
  const vertex = sgfPointToVertex(value.slice(0, separator));
  if (!vertex) return null;
  return { vertex, text: value.slice(separator + 1) };
}

function sgfCharToIndex(char: string): number | null {
  const code = char.charCodeAt(0);
  if (code >= 97 && code <= 122) return code - 97; // a-z -> 0-25
  if (code >= 65 && code <= 90) return code - 65 + 26; // A-Z -> 26-51
  return null;
}

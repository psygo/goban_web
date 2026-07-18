import { describe, expect, it } from "vitest";
import { Board } from "../src/core/board";
import { Color } from "../src/core/types";

describe("Board", () => {
  it("starts empty with black to move", () => {
    const board = new Board(9);
    expect(board.currentColor).toBe(Color.Black);
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        expect(board.get(x, y)).toBe(Color.Empty);
      }
    }
  });

  it("places alternating stones on legal moves", () => {
    const board = new Board(9);
    const first = board.play(2, 2);
    expect(first.legal).toBe(true);
    expect(board.get(2, 2)).toBe(Color.Black);
    expect(board.currentColor).toBe(Color.White);

    const second = board.play(3, 3);
    expect(second.legal).toBe(true);
    expect(board.get(3, 3)).toBe(Color.White);
    expect(board.currentColor).toBe(Color.Black);
  });

  it("rejects playing on an occupied point", () => {
    const board = new Board(9);
    board.play(4, 4);
    const result = board.play(4, 4);
    expect(result).toEqual({ legal: false, reason: "occupied" });
  });

  it("rejects out-of-bounds moves", () => {
    const board = new Board(9);
    const result = board.play(-1, 0);
    expect(result).toEqual({ legal: false, reason: "out-of-bounds" });
  });

  it("captures a single stone with no liberties", () => {
    const board = new Board(9);
    // Surround white stone at (1,1) with black.
    board.play(1, 0); // B
    board.play(1, 1); // W (will be captured)
    board.play(0, 1); // B
    board.play(8, 8); // W elsewhere
    board.play(2, 1); // B
    board.play(8, 7); // W elsewhere
    const capturingMove = board.play(1, 2); // B closes the last liberty

    expect(capturingMove.legal).toBe(true);
    if (capturingMove.legal) {
      expect(capturingMove.captured).toEqual([{ x: 1, y: 1 }]);
    }
    expect(board.get(1, 1)).toBe(Color.Empty);
    expect(board.captures[Color.Black]).toBe(1);
  });

  it("captures a whole group when its last liberty is filled", () => {
    const board = new Board(9);
    // White group at (1,1)-(2,1). Surround fully with black.
    board.play(1, 0); // B
    board.play(1, 1); // W
    board.play(2, 0); // B
    board.play(2, 1); // W
    board.play(0, 1); // B
    board.play(8, 8); // W elsewhere
    board.play(3, 1); // B
    board.play(8, 7); // W elsewhere
    board.play(1, 2); // B
    board.play(8, 6); // W elsewhere
    const capturingMove = board.play(2, 2); // B closes the last liberty

    expect(capturingMove.legal).toBe(true);
    if (capturingMove.legal) {
      expect(capturingMove.captured.length).toBe(2);
    }
    expect(board.get(1, 1)).toBe(Color.Empty);
    expect(board.get(2, 1)).toBe(Color.Empty);
    expect(board.captures[Color.Black]).toBe(2);
  });

  it("forbids a true suicide move", () => {
    const board = new Board(9);
    // Surround (1,1) with white stones on all four sides, black elsewhere,
    // then black attempts to play into the fully-enclosed point.
    board.play(8, 8); // B elsewhere
    board.play(1, 0); // W north of (1,1)
    board.play(8, 7); // B elsewhere
    board.play(0, 1); // W west of (1,1)
    board.play(8, 6); // B elsewhere
    board.play(2, 1); // W east of (1,1)
    board.play(8, 5); // B elsewhere
    board.play(1, 2); // W south of (1,1)

    const suicide = board.play(1, 1); // B has no liberties and captures nothing
    expect(suicide).toEqual({ legal: false, reason: "suicide" });
    expect(board.get(1, 1)).toBe(Color.Empty);
  });

  it("prevents immediate recapture under the simple ko rule", () => {
    const board = new Board(9);
    // Lone white stone at (1,1) surrounded by black on three sides;
    // black's fourth move captures it and should set the ko point.
    board.play(1, 0); // B north of (1,1)
    board.play(1, 1); // W the stone that will be captured
    board.play(0, 1); // B west of (1,1)
    board.play(3, 3); // W elsewhere (dummy)
    board.play(2, 1); // B east of (1,1)
    board.play(3, 4); // W elsewhere (dummy)
    const capture = board.play(1, 2); // B captures W at (1,1)

    expect(capture.legal).toBe(true);
    expect(board.get(1, 1)).toBe(Color.Empty);
    expect(board.koPoint).toEqual({ x: 1, y: 1 });

    // White immediately tries to recapture by playing back at (1,1) - forbidden by ko.
    const illegalRecapture = board.play(1, 1);
    expect(illegalRecapture).toEqual({ legal: false, reason: "ko" });
  });

  it("clears the ko point after an intervening move", () => {
    const board = new Board(9);
    board.play(1, 0); // B
    board.play(1, 1); // W
    board.play(0, 1); // B
    board.play(3, 3); // W elsewhere
    board.play(2, 1); // B
    board.play(3, 4); // W elsewhere
    board.play(1, 2); // B captures W at (1,1), sets ko point
    expect(board.koPoint).toEqual({ x: 1, y: 1 });

    board.play(5, 5); // W plays elsewhere instead of recapturing
    expect(board.koPoint).toBeNull();
  });

  it("ends the game after two consecutive passes", () => {
    const board = new Board(9);
    expect(board.isOver).toBe(false);
    board.pass();
    expect(board.isOver).toBe(false);
    board.pass();
    expect(board.isOver).toBe(true);
  });

  it("resets the pass counter when a stone is played", () => {
    const board = new Board(9);
    board.pass();
    board.play(4, 4);
    board.pass();
    expect(board.isOver).toBe(false);
  });

  describe("set", () => {
    it("directly places a stone without affecting turn order", () => {
      const board = new Board(9);
      board.set(4, 4, Color.White);
      expect(board.get(4, 4)).toBe(Color.White);
      expect(board.currentColor).toBe(Color.Black);
    });

    it("bypasses suicide/capture rules — setup stones aren't gameplay", () => {
      const board = new Board(9);
      // Fully surround (1,1) with black via set(), same shape as the
      // suicide test above, but set() should let a white stone sit there
      // anyway since it's not subject to capture/suicide checking.
      board.set(1, 0, Color.Black);
      board.set(0, 1, Color.Black);
      board.set(2, 1, Color.Black);
      board.set(1, 2, Color.Black);
      board.set(1, 1, Color.White);
      expect(board.get(1, 1)).toBe(Color.White);
    });

    it("can directly remove a stone (AE semantics) by setting it to Empty", () => {
      const board = new Board(9);
      board.set(4, 4, Color.Black);
      expect(board.get(4, 4)).toBe(Color.Black);
      board.set(4, 4, Color.Empty);
      expect(board.get(4, 4)).toBe(Color.Empty);
    });

    it("ignores out-of-bounds coordinates", () => {
      const board = new Board(9);
      expect(() => board.set(-1, 0, Color.Black)).not.toThrow();
      expect(() => board.set(9, 9, Color.Black)).not.toThrow();
    });
  });
});

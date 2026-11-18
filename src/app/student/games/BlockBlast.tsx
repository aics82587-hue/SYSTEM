"use client";

import { useState } from "react";

const SIZE = 8;
type Cell = [number, number];
interface Piece { cells: Cell[]; label: string; }
const PIECES: Piece[] = [
  { label: "Square", cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { label: "Line", cells: [[0, 0], [0, 1], [0, 2]] },
  { label: "L shape", cells: [[0, 0], [1, 0], [1, 1]] },
  { label: "Dot", cells: [[0, 0]] },
  { label: "T shape", cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
  { label: "Column", cells: [[0, 0], [1, 0], [2, 0]] },
  { label: "Corner", cells: [[0, 0], [1, 0], [2, 0], [2, 1]] },
];

function drawPieces() {
  return Array.from({ length: 3 }, () => PIECES[Math.floor(Math.random() * PIECES.length)]);
}

export function BlockBlast() {
  const [grid, setGrid] = useState<boolean[][]>(() => Array.from({ length: SIZE }, () => Array(SIZE).fill(false)));
  const [pieces, setPieces] = useState<Piece[]>(() => drawPieces());
  const [used, setUsed] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("Select a shape, then choose where it starts.");

  function placeAt(row: number, col: number) {
    if (selected === null || used.includes(selected)) {
      setMessage("Choose an available shape first.");
      return;
    }
    const piece = pieces[selected];
    const cells = piece.cells.map(([r, c]) => [row + r, col + c] as Cell);
    if (cells.some(([r, c]) => r >= SIZE || c >= SIZE || grid[r][c])) {
      setMessage("That shape does not fit there. Try another spot.");
      return;
    }
    const next = grid.map(line => [...line]);
    cells.forEach(([r, c]) => { next[r][c] = true; });
    const fullRows = next.map(line => line.every(Boolean));
    const fullColumns = Array.from({ length: SIZE }, (_, c) => next.every(line => line[c]));
    let cleared = 0;
    for (let r = 0; r < SIZE; r++) {
      if (fullRows[r]) {
        next[r] = Array(SIZE).fill(false);
        cleared++;
      }
    }
    for (let c = 0; c < SIZE; c++) {
      if (fullColumns[c]) {
        for (let r = 0; r < SIZE; r++) next[r][c] = false;
        cleared++;
      }
    }
    setGrid(next);
    setScore(value => value + cells.length + cleared * SIZE);
    const nextUsed = [...used, selected];
    if (nextUsed.length === pieces.length) {
      setPieces(drawPieces());
      setUsed([]);
      setSelected(null);
    } else {
      setUsed(nextUsed);
      setSelected(null);
    }
    setMessage(cleared ? `Nice! Cleared ${cleared} line${cleared === 1 ? "" : "s"}.` : "Shape placed.");
  }

  function reset() {
    setGrid(Array.from({ length: SIZE }, () => Array(SIZE).fill(false)));
    setPieces(drawPieces());
    setUsed([]);
    setSelected(null);
    setScore(0);
    setMessage("Select a shape, then choose where it starts.");
  }

  return (
    <section className="game-card-inner">
      <h3>🧱 Block Blast</h3>
      <p className="text-muted">Place shapes to complete rows and columns. Take it one move at a time.</p>
      <p className="block-score">Score: <strong>{score}</strong></p>
      <div className="block-grid" role="grid" aria-label="Block puzzle board">
        {grid.map((line, r) => line.map((filled, c) => (
          <button key={`${r}-${c}`} type="button" role="gridcell" aria-label={`Row ${r + 1}, column ${c + 1}${filled ? ", filled" : ""}`}
            className={`block-cell${filled ? " filled" : ""}`} onClick={() => placeAt(r, c)} />
        )))}
      </div>
      <div className="block-pieces">
        {pieces.map((piece, index) => (
          <button type="button" key={`${piece.label}-${index}`} disabled={used.includes(index)}
            className={`block-piece${selected === index ? " selected" : ""}`} onClick={() => setSelected(index)}>
            <span>{piece.label}</span>
            <span className="piece-preview" aria-hidden="true">
              {Array.from({ length: Math.max(...piece.cells.map(([r]) => r)) + 1 }, (_, r) => (
                <span className="piece-row" key={r}>
                  {Array.from({ length: Math.max(...piece.cells.map(([, c]) => c)) + 1 }, (_, c) => (
                    <span className={`piece-cell${piece.cells.some(([pr, pc]) => pr === r && pc === c) ? " filled" : ""}`} key={c} />
                  ))}
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
      <p className="text-muted" role="status">{message}</p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={reset}>Restart</button>
    </section>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";

const WORD_BANK = [
  "PEACE", "BRAVE", "HOPE", "CALM", "LOVE", "KIND", "BREATHE", "SMILE", "TRUST",
  "GROW", "HEAL", "WELL", "JOY", "REST", "DREAM", "HEART", "FOCUS", "SAFE",
  "HAPPY", "STRONG", "MINDFUL", "GENTLE", "THANKS", "INSPIRE", "WARMTH", "SUNNY",
];
const SIZE = 10;
const DIRECTIONS = [
  [0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1],
] as const;

interface CellCoord { r: number; c: number; }
interface Round { grid: string[][]; words: string[]; }

function buildRound(previousWords: string[]): Round {
  const eligible = WORD_BANK.filter(word => !previousWords.includes(word));
  const pool = eligible.length >= 5 ? eligible : WORD_BANK;
  const words = [...pool].sort(() => Math.random() - 0.5).slice(0, 5);
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(""));

  for (const word of words) {
    let placed = false;
    for (let attempt = 0; attempt < 150 && !placed; attempt++) {
      const [dr, dc] = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      const row = Math.floor(Math.random() * SIZE);
      const col = Math.floor(Math.random() * SIZE);
      const endRow = row + dr * (word.length - 1);
      const endCol = col + dc * (word.length - 1);
      if (endRow < 0 || endRow >= SIZE || endCol < 0 || endCol >= SIZE) continue;

      const positions = Array.from({ length: word.length }, (_, i) => [row + dr * i, col + dc * i]);
      if (positions.some(([r, c], i) => grid[r][c] && grid[r][c] !== word[i])) continue;
      positions.forEach(([r, c], i) => { grid[r][c] = word[i]; });
      placed = true;
    }
    if (!placed) {
      const row = Math.floor(Math.random() * SIZE);
      const col = Math.floor(Math.random() * (SIZE - word.length + 1));
      for (let i = 0; i < word.length; i++) grid[row][col + i] = word[i];
    }
  }

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!grid[r][c]) grid[r][c] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    }
  }
  return { grid, words };
}

function getLineCells(start: CellCoord, end: CellCoord): CellCoord[] {
  const dr = end.r - start.r;
  const dc = end.c - start.c;
  const isHorizontal = dr === 0 && dc !== 0;
  const isVertical = dc === 0 && dr !== 0;
  const isDiagonal = Math.abs(dr) === Math.abs(dc) && dr !== 0;
  if (!isHorizontal && !isVertical && !isDiagonal) return [start];
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  const stepR = dr === 0 ? 0 : dr / Math.abs(dr);
  const stepC = dc === 0 ? 0 : dc / Math.abs(dc);
  return Array.from({ length: steps + 1 }, (_, index) => ({
    r: start.r + index * stepR,
    c: start.c + index * stepC,
  }));
}

export function WordSearch() {
  const [round, setRound] = useState<Round>(() => buildRound([]));
  const previousWords = useRef(round.words);
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [foundCells, setFoundCells] = useState<string[]>([]);
  const [startCell, setStartCell] = useState<CellCoord | null>(null);
  const [currentCell, setCurrentCell] = useState<CellCoord | null>(null);
  const [completed, setCompleted] = useState(false);

  const activeSelectionCells = useMemo(
    () => startCell && currentCell ? getLineCells(startCell, currentCell) : [],
    [startCell, currentCell]
  );
  const activeSelectionKeys = useMemo(
    () => new Set(activeSelectionCells.map(cell => `${cell.r},${cell.c}`)),
    [activeSelectionCells]
  );
  const foundCellsSet = useMemo(() => new Set(foundCells), [foundCells]);

  function startRound() {
    const next = buildRound(previousWords.current);
    previousWords.current = next.words;
    setRound(next);
    setFoundWords([]);
    setFoundCells([]);
    setStartCell(null);
    setCurrentCell(null);
    setCompleted(false);
  }

  function finishSelection(endR?: number, endC?: number) {
    if (!startCell) {
      setStartCell(null);
      setCurrentCell(null);
      return;
    }
    const end = endR !== undefined && endC !== undefined ? { r: endR, c: endC } : currentCell ?? startCell;
    const cells = getLineCells(startCell, end);
    const forward = cells.map(cell => round.grid[cell.r][cell.c]).join("");
    const reverse = forward.split("").reverse().join("");
    const word = round.words.find(item => !foundWords.includes(item) && (item === forward || item === reverse));
    if (word) {
      const newWords = [...foundWords, word];
      setFoundWords(newWords);
      setFoundCells(prev => Array.from(new Set([...prev, ...cells.map(cell => `${cell.r},${cell.c}`)])));
      if (newWords.length === round.words.length) {
        setCompleted(true);
        window.setTimeout(startRound, 1500);
      }
    }
    setStartCell(null);
    setCurrentCell(null);
  }

  function onCellClick(r: number, c: number) {
    if (!startCell) {
      setStartCell({ r, c });
      setCurrentCell({ r, c });

    } else {
      finishSelection(r, c);
    }
  }

  return (
    <div className="word-search-game">
      <div className="text-center" style={{ marginBottom: "1.25rem" }}>
        <h3 style={{ fontSize: "1.3rem", marginBottom: "0.25rem" }}>🔍 Find the Word</h3>
        <p className="text-muted text-sm">Find five wellness words. The next round gets a fresh grid and new words.</p>
      </div>
      <div className="word-search-layout">
        <div className="word-grid">
          {round.grid.map((row, r) => row.map((letter, c) => {
            const key = `${r},${c}`;
            const found = foundCellsSet.has(key);
            const active = activeSelectionKeys.has(key);
            return (
              <button
                type="button"
                key={key}
                aria-label={`Row ${r + 1}, column ${c + 1}, ${letter}`}
                onClick={() => onCellClick(r, c)}
                className={`word-grid-cell${found ? " found" : ""}${active ? " selected" : ""}`}
              >
                {letter}
              </button>
            );
          }))}
        </div>
        <div className="word-list-panel">
          <h4>Words ({foundWords.length}/{round.words.length})</h4>
          {round.words.map(word => (
            <div className={`word-target${foundWords.includes(word) ? " completed" : ""}`} key={word}>
              <span>{word}</span><span>{foundWords.includes(word) ? "✓" : "○"}</span>
            </div>
          ))}
          {completed && <p className="notice notice-success">Great work! Preparing your next round…</p>}
          <button type="button" className="btn btn-secondary btn-sm" onClick={startRound}>New Round</button>
        </div>
      </div>
    </div>
  );
}

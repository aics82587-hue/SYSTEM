"use client";

import { useState } from "react";

const PUZZLES = [
  { word: "BREATHE", clue: "A calming way to slow down and notice the present." },
  { word: "KINDNESS", clue: "Care and consideration for yourself and others." },
  { word: "GRATITUDE", clue: "Noticing things you appreciate." },
  { word: "COURAGE", clue: "Strength to face something difficult." },
  { word: "BALANCE", clue: "A healthy mix of effort, rest, and care." },
  { word: "FRIEND", clue: "A trusted person who offers support." },
];

function scramble(word: string) {
  let result = word;
  while (result === word) result = [...word].sort(() => Math.random() - 0.5).join("");
  return result;
}

export function WordPuzzle() {
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState<number[]>([]);
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState("");
  const puzzle = PUZZLES[index];
  const [scrambled, setScrambled] = useState(() => scramble(puzzle.word));

  function nextPuzzle() {
    const choices = PUZZLES.map((_, item) => item).filter(item => item !== index && !previous.includes(item));
    const next = choices.length ? choices[Math.floor(Math.random() * choices.length)]
      : PUZZLES.findIndex((_, item) => item !== index);
    setPrevious(prev => [...prev.slice(-3), index]);
    setIndex(next);
    setAnswer("");
    setMessage("");
    setScrambled(scramble(PUZZLES[next].word));
  }

  function checkAnswer(event: React.FormEvent) {
    event.preventDefault();
    if (answer.trim().toUpperCase() === puzzle.word) {
      setMessage("You got it!");
      window.setTimeout(nextPuzzle, 1000);
    } else {
      setMessage("Not quite—try again, or take a breath and look at the clue.");
    }
  }

  return (
    <section className="game-card-inner">
      <h3>🧩 Word Puzzle</h3>
      <p className="text-muted">Unscramble the wellness word.</p>
      <div className="puzzle-letters" aria-label="Scrambled letters">{scrambled.split("").join(" ")}</div>
      <p className="puzzle-clue"><strong>Clue:</strong> {puzzle.clue}</p>
      <form className="puzzle-form" onSubmit={checkAnswer}>
        <label className="sr-only" htmlFor="word-puzzle-answer">Your answer</label>
        <input id="word-puzzle-answer" className="form-input" value={answer} onChange={event => setAnswer(event.target.value)} autoComplete="off" />
        <button className="btn btn-primary" type="submit">Check</button>
      </form>
      <p className="text-muted" role="status">{message}</p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={nextPuzzle}>Skip puzzle</button>
    </section>
  );
}

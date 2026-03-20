export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type Grid = number[][];

const DIFFICULTY_GIVENS: Record<Difficulty, [number, number]> = {
  Easy: [36, 40],
  Medium: [28, 32],
  Hard: [22, 26],
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(values: T[]): T[] {
  const next = [...values];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function createEmptyGrid(): Grid {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => 0));
}

export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => [...row]);
}

export function isSafePlacement(grid: Grid, row: number, col: number, value: number): boolean {
  for (let i = 0; i < 9; i += 1) {
    if (i !== col && grid[row][i] === value) {
      return false;
    }
    if (i !== row && grid[i][col] === value) {
      return false;
    }
  }

  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r += 1) {
    for (let c = boxCol; c < boxCol + 3; c += 1) {
      if ((r !== row || c !== col) && grid[r][c] === value) {
        return false;
      }
    }
  }

  return true;
}

export function solveGrid(grid: Grid): boolean {
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (grid[row][col] !== 0) {
        continue;
      }

      for (const value of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
        if (!isSafePlacement(grid, row, col, value)) {
          continue;
        }
        grid[row][col] = value;
        if (solveGrid(grid)) {
          return true;
        }
        grid[row][col] = 0;
      }
      return false;
    }
  }
  return true;
}

function countSolutions(grid: Grid, limit = 2): number {
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (grid[row][col] !== 0) {
        continue;
      }

      let count = 0;
      for (let value = 1; value <= 9; value += 1) {
        if (!isSafePlacement(grid, row, col, value)) {
          continue;
        }
        grid[row][col] = value;
        count += countSolutions(grid, limit - count);
        grid[row][col] = 0;
        if (count >= limit) {
          return count;
        }
      }
      return count;
    }
  }
  return 1;
}

function removeCellsWithUniqueSolution(solved: Grid, targetGivens: number): Grid {
  const puzzle = cloneGrid(solved);
  const positions = shuffle(Array.from({ length: 81 }, (_, index) => index));
  let givensLeft = 81;

  for (const pos of positions) {
    if (givensLeft <= targetGivens) {
      break;
    }

    const row = Math.floor(pos / 9);
    const col = pos % 9;
    const backup = puzzle[row][col];
    puzzle[row][col] = 0;

    const solutions = countSolutions(cloneGrid(puzzle), 2);
    if (solutions !== 1) {
      puzzle[row][col] = backup;
      continue;
    }

    givensLeft -= 1;
  }

  return puzzle;
}

export function generatePuzzle(difficulty: Difficulty): { puzzle: Grid; solution: Grid } {
  const [minGivens, maxGivens] = DIFFICULTY_GIVENS[difficulty];
  const targetGivens = randInt(minGivens, maxGivens);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const solution = createEmptyGrid();
    if (!solveGrid(solution)) {
      continue;
    }
    const puzzle = removeCellsWithUniqueSolution(solution, targetGivens);
    const givenCount = puzzle.flat().filter((value) => value !== 0).length;
    if (givenCount >= minGivens && givenCount <= maxGivens) {
      return { puzzle, solution };
    }
  }

  const fallbackSolution = createEmptyGrid();
  solveGrid(fallbackSolution);
  return {
    puzzle: removeCellsWithUniqueSolution(fallbackSolution, targetGivens),
    solution: fallbackSolution,
  };
}

export function isCompleteAndValid(entries: Grid, solution: Grid): boolean {
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      if (entries[r][c] === 0 || entries[r][c] !== solution[r][c]) {
        return false;
      }
    }
  }
  return true;
}

export function getBoxIndex(row: number, col: number): number {
  return Math.floor(row / 3) * 3 + Math.floor(col / 3);
}

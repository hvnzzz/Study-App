export type WordSearchCategory =
  | 'Animals'
  | 'Food'
  | 'Nature'
  | 'Space'
  | 'Sports'
  | 'Weather'
  | 'Colors'
  | 'Music';

export type WordDirection =
  | 'N'
  | 'NE'
  | 'E'
  | 'SE'
  | 'S'
  | 'SW'
  | 'W'
  | 'NW';

export type CellCoord = {
  row: number;
  col: number;
};

export type PlacedWord = {
  word: string;
  start: CellCoord;
  direction: WordDirection;
  cells: CellCoord[];
};

export const WORD_SEARCH_GRID = 10;
export const WORDS_PER_PUZZLE = 8;

const DIR_VECTORS: Record<WordDirection, { dr: number; dc: number }> = {
  N: { dr: -1, dc: 0 },
  NE: { dr: -1, dc: 1 },
  E: { dr: 0, dc: 1 },
  SE: { dr: 1, dc: 1 },
  S: { dr: 1, dc: 0 },
  SW: { dr: 1, dc: -1 },
  W: { dr: 0, dc: -1 },
  NW: { dr: -1, dc: -1 },
};

const DIRECTIONS: WordDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export const WORD_BANK: Record<WordSearchCategory, string[]> = {
  Animals: ['CAT', 'DOG', 'BEAR', 'WOLF', 'DEER', 'FROG', 'HAWK', 'MOLE', 'NEWT', 'LYNX'],
  Food: ['CAKE', 'RICE', 'SOUP', 'TACO', 'PLUM', 'CORN', 'BEEF', 'MILK', 'HERB', 'LIME'],
  Nature: ['TREE', 'LAKE', 'MOSS', 'FERN', 'RAIN', 'SNOW', 'LEAF', 'VINE', 'TIDE', 'ROCK'],
  Space: ['MOON', 'STAR', 'MARS', 'ORBIT', 'COMET', 'VENUS', 'SOLAR', 'NOVA', 'NEBULA', 'DUST'],
  Sports: ['SWIM', 'GOLF', 'POLO', 'DIVE', 'RACE', 'SURF', 'SKATE', 'VAULT', 'RELAY', 'CLIMB'],
  Weather: ['RAIN', 'HAIL', 'MIST', 'SNOW', 'WIND', 'FROST', 'STORM', 'SLEET', 'HUMID', 'CLOUD'],
  Colors: ['RED', 'BLUE', 'GOLD', 'TEAL', 'ROSE', 'LIME', 'JADE', 'CORAL', 'IVORY', 'AMBER'],
  Music: ['BEAT', 'BASS', 'JAZZ', 'FOLK', 'HARP', 'DRUM', 'CHOIR', 'TEMPO', 'PITCH', 'CHORD'],
};

function shuffle<T>(values: T[]): T[] {
  const next = [...values];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function randomLetter(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return letters[Math.floor(Math.random() * letters.length)];
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < WORD_SEARCH_GRID && col >= 0 && col < WORD_SEARCH_GRID;
}

export function pickPuzzleWords(category: WordSearchCategory): string[] {
  return shuffle(WORD_BANK[category]).slice(0, WORDS_PER_PUZZLE);
}

function makeEmptyGrid(): string[][] {
  return Array.from({ length: WORD_SEARCH_GRID }, () =>
    Array.from({ length: WORD_SEARCH_GRID }, () => ''),
  );
}

function canPlaceWord(grid: string[][], word: string, start: CellCoord, direction: WordDirection): boolean {
  const vec = DIR_VECTORS[direction];
  for (let i = 0; i < word.length; i += 1) {
    const row = start.row + vec.dr * i;
    const col = start.col + vec.dc * i;
    if (!inBounds(row, col)) {
      return false;
    }
    const current = grid[row][col];
    if (current !== '' && current !== word[i]) {
      return false;
    }
  }
  return true;
}

function placeWord(grid: string[][], word: string, start: CellCoord, direction: WordDirection): PlacedWord {
  const vec = DIR_VECTORS[direction];
  const cells: CellCoord[] = [];
  for (let i = 0; i < word.length; i += 1) {
    const row = start.row + vec.dr * i;
    const col = start.col + vec.dc * i;
    grid[row][col] = word[i];
    cells.push({ row, col });
  }
  return { word, start, direction, cells };
}

export function generateWordSearchPuzzle(category: WordSearchCategory): {
  grid: string[][];
  words: string[];
  placements: PlacedWord[];
} {
  const words = pickPuzzleWords(category);

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const grid = makeEmptyGrid();
    const placements: PlacedWord[] = [];
    let failed = false;

    for (const word of shuffle(words)) {
      let placed = false;
      const starts = shuffle(
        Array.from({ length: WORD_SEARCH_GRID * WORD_SEARCH_GRID }, (_, index) => ({
          row: Math.floor(index / WORD_SEARCH_GRID),
          col: index % WORD_SEARCH_GRID,
        })),
      );
      for (const start of starts) {
        for (const direction of shuffle(DIRECTIONS)) {
          if (!canPlaceWord(grid, word, start, direction)) {
            continue;
          }
          placements.push(placeWord(grid, word, start, direction));
          placed = true;
          break;
        }
        if (placed) {
          break;
        }
      }
      if (!placed) {
        failed = true;
        break;
      }
    }

    if (failed) {
      continue;
    }

    for (let row = 0; row < WORD_SEARCH_GRID; row += 1) {
      for (let col = 0; col < WORD_SEARCH_GRID; col += 1) {
        if (grid[row][col] === '') {
          grid[row][col] = randomLetter();
        }
      }
    }

    return { grid, words, placements };
  }

  const grid = makeEmptyGrid();
  const fallbackWords = pickPuzzleWords(category);
  const placements: PlacedWord[] = [];
  for (const word of fallbackWords) {
    const direction: WordDirection = 'E';
    const row = placements.length % WORD_SEARCH_GRID;
    const maxStart = Math.max(0, WORD_SEARCH_GRID - word.length);
    const col = Math.floor(Math.random() * (maxStart + 1));
    placements.push(placeWord(grid, word, { row, col }, direction));
  }
  for (let row = 0; row < WORD_SEARCH_GRID; row += 1) {
    for (let col = 0; col < WORD_SEARCH_GRID; col += 1) {
      if (grid[row][col] === '') {
        grid[row][col] = randomLetter();
      }
    }
  }
  return { grid, words: fallbackWords, placements };
}

export function getLineCells(start: CellCoord, end: CellCoord): CellCoord[] {
  const dr = end.row - start.row;
  const dc = end.col - start.col;
  if (dr === 0 && dc === 0) {
    return [start];
  }
  const absR = Math.abs(dr);
  const absC = Math.abs(dc);
  let stepR = 0;
  let stepC = 0;

  if (absR === 0) {
    stepC = dc > 0 ? 1 : -1;
  } else if (absC === 0) {
    stepR = dr > 0 ? 1 : -1;
  } else {
    const ratio = absR / absC;
    if (ratio > 1.35) {
      stepR = dr > 0 ? 1 : -1;
      stepC = 0;
    } else if (ratio < 0.74) {
      stepR = 0;
      stepC = dc > 0 ? 1 : -1;
    } else {
      stepR = dr > 0 ? 1 : -1;
      stepC = dc > 0 ? 1 : -1;
    }
  }

  const steps = Math.max(absR, absC);
  const cells: CellCoord[] = [start];
  for (let i = 1; i <= steps; i += 1) {
    const row = start.row + stepR * i;
    const col = start.col + stepC * i;
    if (!inBounds(row, col)) {
      break;
    }
    cells.push({ row, col });
  }
  return cells;
}

export function cellsToKey(cells: CellCoord[]): string {
  return cells.map((cell) => `${cell.row}-${cell.col}`).join('|');
}

export function wordFromCells(grid: string[][], cells: CellCoord[]): string {
  return cells.map((cell) => grid[cell.row][cell.col]).join('');
}

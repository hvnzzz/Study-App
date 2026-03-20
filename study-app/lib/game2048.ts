export type MoveDirection = 'up' | 'down' | 'left' | 'right';

export type Tile2048 = {
  id: number;
  value: number;
  row: number;
  col: number;
};

export type TileTransition = {
  id: number;
  toRow: number;
  toCol: number;
};

const GRID_SIZE = 4;

function buildGrid(tiles: Tile2048[]): Array<Array<Tile2048 | null>> {
  const grid: Array<Array<Tile2048 | null>> = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => null),
  );
  for (const tile of tiles) {
    grid[tile.row][tile.col] = tile;
  }
  return grid;
}

function randomEmptyCell(tiles: Tile2048[]): { row: number; col: number } | null {
  const occupied = new Set(tiles.map((tile) => `${tile.row}-${tile.col}`));
  const empties: Array<{ row: number; col: number }> = [];
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const key = `${row}-${col}`;
      if (!occupied.has(key)) {
        empties.push({ row, col });
      }
    }
  }
  if (empties.length === 0) {
    return null;
  }
  return empties[Math.floor(Math.random() * empties.length)];
}

export function spawnRandomTile(tiles: Tile2048[], nextId: number): { tiles: Tile2048[]; spawnedId: number | null } {
  const empty = randomEmptyCell(tiles);
  if (!empty) {
    return { tiles, spawnedId: null };
  }
  const value = Math.random() < 0.9 ? 2 : 4;
  return {
    tiles: [...tiles, { id: nextId, value, row: empty.row, col: empty.col }],
    spawnedId: nextId,
  };
}

export function createInitialState(nextIdStart = 1): {
  tiles: Tile2048[];
  nextId: number;
} {
  let tiles: Tile2048[] = [];
  let nextId = nextIdStart;
  const first = spawnRandomTile(tiles, nextId);
  tiles = first.tiles;
  nextId += first.spawnedId ? 1 : 0;
  const second = spawnRandomTile(tiles, nextId);
  tiles = second.tiles;
  nextId += second.spawnedId ? 1 : 0;
  return { tiles, nextId };
}

export function hasTileValue(tiles: Tile2048[], target: number): boolean {
  return tiles.some((tile) => tile.value === target);
}

export function canMove(tiles: Tile2048[]): boolean {
  if (tiles.length < GRID_SIZE * GRID_SIZE) {
    return true;
  }
  const grid = buildGrid(tiles);
  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const current = grid[row][col];
      if (!current) {
        return true;
      }
      const right = col + 1 < GRID_SIZE ? grid[row][col + 1] : null;
      const down = row + 1 < GRID_SIZE ? grid[row + 1][col] : null;
      if ((right && right.value === current.value) || (down && down.value === current.value)) {
        return true;
      }
    }
  }
  return false;
}

type LineTarget = { row: number; col: number };

function getLineTargets(lineIndex: number, direction: MoveDirection): LineTarget[] {
  if (direction === 'left') {
    return Array.from({ length: GRID_SIZE }, (_, index) => ({ row: lineIndex, col: index }));
  }
  if (direction === 'right') {
    return Array.from({ length: GRID_SIZE }, (_, index) => ({ row: lineIndex, col: GRID_SIZE - 1 - index }));
  }
  if (direction === 'up') {
    return Array.from({ length: GRID_SIZE }, (_, index) => ({ row: index, col: lineIndex }));
  }
  return Array.from({ length: GRID_SIZE }, (_, index) => ({ row: GRID_SIZE - 1 - index, col: lineIndex }));
}

export function moveTiles(
  currentTiles: Tile2048[],
  direction: MoveDirection,
): {
  moved: boolean;
  tiles: Tile2048[];
  mergedTileIds: number[];
  transitions: TileTransition[];
  scoreDelta: number;
} {
  const grid = buildGrid(currentTiles);
  const movedTiles: Tile2048[] = [];
  const mergedTileIds: number[] = [];
  const transitions: TileTransition[] = [];
  let scoreDelta = 0;
  let moved = false;

  for (let line = 0; line < GRID_SIZE; line += 1) {
    const targets = getLineTargets(line, direction);
    const lineTiles = targets
      .map((target) => grid[target.row][target.col])
      .filter((tile): tile is Tile2048 => tile !== null)
      .map((tile) => ({ ...tile }));

    let write = 0;
    let index = 0;

    while (index < lineTiles.length) {
      const current = { ...lineTiles[index] };
      const next = lineTiles[index + 1];
      const target = targets[write];
      const mergeThisStep = Boolean(next && next.value === current.value);

      if (mergeThisStep) {
        current.value *= 2;
        scoreDelta += current.value;
        mergedTileIds.push(current.id);
        index += 2;
      } else {
        index += 1;
      }

      if (current.row !== target.row || current.col !== target.col) {
        moved = true;
      }
      transitions.push({ id: current.id, toRow: target.row, toCol: target.col });

      if (mergeThisStep && next) {
        transitions.push({ id: next.id, toRow: target.row, toCol: target.col });
        if (next.row !== target.row || next.col !== target.col) {
          moved = true;
        }
      }

      current.row = target.row;
      current.col = target.col;
      movedTiles.push(current);
      write += 1;
    }
  }

  const normalized = movedTiles.sort((a, b) => a.row - b.row || a.col - b.col || a.id - b.id);
  return { moved, tiles: normalized, mergedTileIds, transitions, scoreDelta };
}

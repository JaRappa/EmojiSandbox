// grid.js — Spatial hash grid for fast nearest-neighbor queries.
import CONFIG from './config.js';

class SpatialGrid {
  constructor(cellSize = CONFIG.GRID_CELL_SIZE) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  _key(cx, cy) {
    return `${cx},${cy}`;
  }

  _cellCoords(x, y) {
    return [Math.floor(x / this.cellSize), Math.floor(y / this.cellSize)];
  }

  clear() {
    this.cells.clear();
  }

  insert(entity) {
    const [cx, cy] = this._cellCoords(entity.x, entity.y);
    const key = this._key(cx, cy);
    if (!this.cells.has(key)) this.cells.set(key, []);
    this.cells.get(key).push(entity);
  }

  /** Return all entities within `radius` of (x, y) with distSq only (no sqrt). */
  queryRaw(x, y, radius) {
    const result = [];
    const [centerCx, centerCy] = this._cellCoords(x, y);
    const cellsOut = Math.ceil(radius / this.cellSize);
    const rSq = radius * radius;

    for (let dx = -cellsOut; dx <= cellsOut; dx++) {
      for (let dy = -cellsOut; dy <= cellsOut; dy++) {
        const key = this._key(centerCx + dx, centerCy + dy);
        const cell = this.cells.get(key);
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const e = cell[i];
          if (e.dead) continue;
          const ex = e.x - x;
          const ey = e.y - y;
          // Fast square-check first, then circle
          if (ex > radius || ex < -radius || ey > radius || ey < -radius) continue;
          const distSq = ex * ex + ey * ey;
          if (distSq <= rSq && distSq > 0.001) {
            result.push({ entity: e, distSq });
          }
        }
      }
    }
    return result;
  }

  /** Return all entities within `radius` of (x, y) with dist and distSq. */
  query(x, y, radius) {
    const raw = this.queryRaw(x, y, radius);
    for (let i = 0; i < raw.length; i++) {
      raw[i].dist = Math.sqrt(raw[i].distSq);
    }
    return raw;
  }

  /** Return all entities in exact cell (for eraser / contact). */
  queryRect(x, y, w, h) {
    const result = [];
    const [minCx, minCy] = this._cellCoords(x - w / 2, y - h / 2);
    const [maxCx, maxCy] = this._cellCoords(x + w / 2, y + h / 2);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = this.cells.get(this._key(cx, cy));
        if (!cell) continue;
        for (const e of cell) {
          if (!e.dead && e.x >= x - w / 2 && e.x <= x + w / 2 && e.y >= y - h / 2 && e.y <= y + h / 2) {
            result.push(e);
          }
        }
      }
    }
    return result;
  }
}

export default SpatialGrid;

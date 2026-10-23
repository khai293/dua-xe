/** Real frame samples: no frame-rate cap and no fabricated minimums. */
export const normalizeQuality = value => value === 'low' || value === 'performance' ? 'performance' : value === 'ultra' ? 'ultra' : 'balanced';

export class FrameMonitor {
  constructor(capacity = 240) {
    this.capacity = capacity; this.frames = new Float64Array(capacity); this.physics = new Float64Array(capacity);
    this.ai = new Float64Array(capacity); this.render = new Float64Array(capacity); this.cursor = 0; this.count = 0;
    this.drawCount = 0; this.heapBytes = null;
  }
  record(frameMs, values = {}) {
    if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 1000) return;
    const i = this.cursor;
    this.frames[i] = frameMs; this.physics[i] = Math.max(0, Number(values.physicsMs ?? values.updateMs) || 0);
    this.ai[i] = Math.max(0, Number(values.aiMs) || 0); this.render[i] = Math.max(0, Number(values.renderMs) || 0);
    this.cursor = (i + 1) % this.capacity; this.count = Math.min(this.count + 1, this.capacity);
    this.drawCount = values.drawCount ?? this.drawCount; this.heapBytes = values.heapBytes ?? this.heapBytes;
  }
  reset() { this.cursor = 0; this.count = 0; }
  snapshot() {
    if (!this.count) return { samples: 0, fps: 0, minimumFPS: 0, p95FrameMs: 0, meanFrameMs: 0, physicsMs: 0, aiMs: 0, renderMs: 0, drawCount: this.drawCount, heapBytes: this.heapBytes };
    const frames = Array.from(this.frames.subarray(0, this.count)).sort((a, b) => a - b);
    const mean = frames.reduce((a, b) => a + b, 0) / this.count;
    const average = array => array.subarray(0, this.count).reduce((a, b) => a + b, 0) / this.count;
    return { samples: this.count, fps: 1000 / mean, minimumFPS: 1000 / frames.at(-1), p95FrameMs: frames[Math.min(this.count - 1, Math.ceil(this.count * .95) - 1)], meanFrameMs: mean,
      physicsMs: average(this.physics), aiMs: average(this.ai), renderMs: average(this.render), drawCount: this.drawCount, heapBytes: this.heapBytes };
  }
}

/** Slow hysteresis avoids oscillating visual quality while preserving fixed-step physics. */
export class AdaptiveResolution {
  constructor(preset = 'balanced') { this.preset = normalizeQuality(preset); this.scale = this.preset === 'performance' ? .85 : 1; this.detail = 1; this.elapsed = 0; this.good = 0; this.bad = 0; this.average = 16.667; }
  setPreset(preset) {
    const next = normalizeQuality(preset); if (next === this.preset) return;
    this.preset = next; this.scale = next === 'performance' ? .85 : 1; this.detail = 1; this.good = this.bad = this.elapsed = 0;
  }
  update(frameMs, active = true) {
    if (!active || !Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 250) return this.scale;
    const dt = frameMs / 1000; this.elapsed += dt; this.average += (frameMs - this.average) * .05;
    if (this.average > 18.2) { this.bad += dt; this.good = 0; }
    else if (this.average < 14.2) { this.good += dt; this.bad = Math.max(0, this.bad - dt); }
    else { this.bad = Math.max(0, this.bad - dt * .3); this.good = Math.max(0, this.good - dt); }
    const min = this.preset === 'ultra' ? .6 : this.preset === 'performance' ? .5 : .55;
    if (this.bad > .9 && this.elapsed > 1.4) {
      if (this.scale > min + .01) this.scale = Math.max(min, this.scale - .1);
      else this.detail = Math.max(.58, this.detail - .12);
      this.bad = 0; this.elapsed = 0;
    } else if (this.good > 4 && this.elapsed > 4) {
      if (this.detail < 1) this.detail = Math.min(1, this.detail + .08);
      else this.scale = Math.min(1, this.scale + .05);
      this.good = 0; this.elapsed = 0;
    }
    return this.scale;
  }
}

/** Stable world-space grid shared by scenery preparation and frame culling. */
export class SpatialGrid {
  constructor(size = 64) { this.size = size; this.cells = new Map(); }
  insert(item, x = item.x, y = item.y) {
    const key = `${Math.floor(x / this.size)},${Math.floor(y / this.size)}`;
    let bucket = this.cells.get(key); if (!bucket) this.cells.set(key, bucket = []); bucket.push(item); return item;
  }
  query(x, y, radius, output = []) {
    output.length = 0;
    const step = this.size, x0 = Math.floor((x - radius) / step), x1 = Math.floor((x + radius) / step), y0 = Math.floor((y - radius) / step), y1 = Math.floor((y + radius) / step);
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      const bucket = this.cells.get(`${xx},${yy}`); if (bucket) for (let i = 0; i < bucket.length; i++) output.push(bucket[i]);
    }
    return output;
  }
}

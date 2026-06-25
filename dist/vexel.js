// dist/vexel.js — Vexel Vector Graphics Engine
// Version 1.0.0 | FlamicsLLC | MIT License
// Built from 51 source modules

(function(global) {
  'use strict';

  // ============================================================
  // src/utils/math.js
  // ============================================================
  class VexelMath {
    static PI = Math.PI;
    static HALF_PI = Math.PI / 2;
    static TWO_PI = Math.PI * 2;
    static DEG_TO_RAD = Math.PI / 180;
    static RAD_TO_DEG = 180 / Math.PI;
    static EPSILON = 0.000001;

    static degToRad(d) { return d * VexelMath.DEG_TO_RAD; }
    static radToDeg(r) { return r * VexelMath.RAD_TO_DEG; }
    static clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    static lerp(a, b, t) { return a + (b - a) * t; }
    static lerp2D(p1, p2, t) { return { x: VexelMath.lerp(p1.x, p2.x, t), y: VexelMath.lerp(p1.y, p2.y, t) }; }
    static distance(p1, p2) { const dx = p2.x - p1.x, dy = p2.y - p1.y; return Math.sqrt(dx * dx + dy * dy); }
    static distanceSquared(p1, p2) { const dx = p2.x - p1.x, dy = p2.y - p1.y; return dx * dx + dy * dy; }
    static angle(p1, p2) { return Math.atan2(p2.y - p1.y, p2.x - p1.x); }
    static midpoint(p1, p2) { return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }; }
    static normalize(p) { const len = Math.sqrt(p.x * p.x + p.y * p.y); return len === 0 ? { x: 0, y: 0 } : { x: p.x / len, y: p.y / len }; }
    static dot(p1, p2) { return p1.x * p2.x + p1.y * p2.y; }
    static cross(p1, p2) { return p1.x * p2.y - p1.y * p2.x; }
    static nearlyEqual(a, b, e = VexelMath.EPSILON) { return Math.abs(a - b) < e; }
  }

  class VexelMatrix {
    constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
      this.a = a; this.b = b; this.c = c; this.d = d; this.e = e; this.f = f;
    }
    static identity() { return new VexelMatrix(); }
    static translation(tx, ty) { return new VexelMatrix(1, 0, 0, 1, tx, ty); }
    static rotation(angle, cx = 0, cy = 0) {
      const cos = Math.cos(angle), sin = Math.sin(angle);
      return new VexelMatrix(cos, sin, -sin, cos, cx - cx * cos + cy * sin, cy - cx * sin - cy * cos);
    }
    static scale(sx, sy, cx = 0, cy = 0) { return new VexelMatrix(sx, 0, 0, sy || sx, cx - cx * sx, cy - cy * (sy || sx)); }
    clone() { return new VexelMatrix(this.a, this.b, this.c, this.d, this.e, this.f); }
    multiply(other) {
      return new VexelMatrix(
        this.a * other.a + this.c * other.b, this.b * other.a + this.d * other.b,
        this.a * other.c + this.c * other.d, this.b * other.c + this.d * other.d,
        this.a * other.e + this.c * other.f + this.e, this.b * other.e + this.d * other.f + this.f
      );
    }
    transformPoint(p) { return { x: this.a * p.x + this.c * p.y + this.e, y: this.b * p.x + this.d * p.y + this.f }; }
    toCSS() { return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`; }
  }

  class VexelBounds {
    constructor(x = 0, y = 0, w = 0, h = 0) { this.x = x; this.y = y; this.width = w; this.height = h; }
    get centerX() { return this.x + this.width / 2; }
    get centerY() { return this.y + this.height / 2; }
    get center() { return { x: this.centerX, y: this.centerY }; }
    clone() { return new VexelBounds(this.x, this.y, this.width, this.height); }
    contains(p) { return p.x >= this.x && p.x <= this.x + this.width && p.y >= this.y && p.y <= this.y + this.height; }
    static fromPoints(points) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of points) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
      return new VexelBounds(minX, minY, maxX - minX, maxY - minY);
    }
  }

  // ============================================================
  // src/utils/color.js
  // ============================================================
  class VexelColor {
    static hexToRgb(hex) {
      hex = hex.replace('#', '');
      if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      return { r: parseInt(hex.substring(0, 2), 16), g: parseInt(hex.substring(2, 4), 16), b: parseInt(hex.substring(4, 6), 16), a: 1 };
    }
    static rgbToHex(r, g, b) {
      const toHex = (c) => { const h = Math.max(0, Math.min(255, Math.round(c))).toString(16); return h.length === 1 ? '0' + h : h; };
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
    static rgbToHsl(r, g, b) {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) { case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break; case g: h = ((b - r) / d + 2) / 6; break; case b: h = ((r - g) / d + 4) / 6; break; }
      }
      return { h: h * 360, s: s * 100, l: l * 100 };
    }
    static hslToRgb(h, s, l) {
      h /= 360; s /= 100; l /= 100;
      let r, g, b;
      if (s === 0) { r = g = b = l; } else {
        const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
      }
      return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    }
    static parse(str) {
      if (!str || str === 'transparent') return null;
      str = str.trim();
      if (str.startsWith('#')) return VexelColor.hexToRgb(str);
      const rgba = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,?\s*([\d.]+)?\s*\)/);
      if (rgba) return { r: parseInt(rgba[1]), g: parseInt(rgba[2]), b: parseInt(rgba[3]), a: rgba[4] ? parseFloat(rgba[4]) : 1 };
      return null;
    }
    static format(color, format = 'hex') {
      const c = typeof color === 'string' ? VexelColor.parse(color) : color;
      if (!c) return '';
      if (format === 'hex') return VexelColor.rgbToHex(c.r, c.g, c.b);
      if (format === 'rgb') return `rgb(${c.r}, ${c.g}, ${c.b})`;
      return VexelColor.rgbToHex(c.r, c.g, c.b);
    }
  }

  // ============================================================
  // src/utils/geometry.js
  // ============================================================
  class VexelGeometry {
    static pointInRectangle(px, py, rx, ry, rw, rh) { return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh; }
    static pointInPolygon(px, py, vertices) {
      let inside = false;
      for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        if ((vertices[i].y > py) !== (vertices[j].y > py) && px < ((vertices[j].x - vertices[i].x) * (py - vertices[i].y)) / (vertices[j].y - vertices[i].y) + vertices[i].x) inside = !inside;
      }
      return inside;
    }
    static distanceToLine(px, py, x1, y1, x2, y2) {
      const dx = x2 - x1, dy = y2 - y1, lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return Math.hypot(px - x1, py - y1);
      let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }
    static convexHull(points) {
      if (points.length <= 3) return [...points];
      const unique = [...new Map(points.map(p => [`${p.x},${p.y}`, p])).values()];
      if (unique.length <= 3) return unique;
      unique.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
      const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
      const lower = [], upper = [];
      for (const p of unique) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
      for (let i = unique.length - 1; i >= 0; i--) { const p = unique[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
      upper.pop(); lower.pop();
      return [...lower, ...upper];
    }
  }

  // ============================================================
  // src/core/events.js
  // ============================================================
  class VexelEventEmitter {
    constructor() { this._events = {}; this._onceEvents = {}; }
    on(event, listener) { if (!this._events[event]) this._events[event] = []; this._events[event].push(listener); return () => this.off(event, listener); }
    once(event, listener) { if (!this._onceEvents[event]) this._onceEvents[event] = []; this._onceEvents[event].push(listener); }
    off(event, listener) { if (this._events[event]) this._events[event] = this._events[event].filter(l => l !== listener); if (this._onceEvents[event]) this._onceEvents[event] = this._onceEvents[event].filter(l => l !== listener); }
    emit(event, ...args) {
      if (this._events[event]) for (const l of [...this._events[event]]) l(...args);
      if (this._onceEvents[event]) { for (const l of [...this._onceEvents[event]]) l(...args); delete this._onceEvents[event]; }
    }
    removeAllListeners(event) { if (event) { delete this._events[event]; delete this._onceEvents[event]; } else { this._events = {}; this._onceEvents = {}; } }
  }

  // ============================================================
  // SHAPES
  // ============================================================
  class VexelShape {
    constructor(options = {}) {
      this.type = 'shape'; this.id = options.id || `${this.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.x = options.x || 0; this.y = options.y || 0;
      this.width = options.width || 0; this.height = options.height || 0;
      this.rotation = options.rotation || 0; this.scaleX = options.scaleX || 1; this.scaleY = options.scaleY || 1;
      this.opacity = options.opacity !== undefined ? options.opacity : 1;
      this.visible = options.visible !== false; this.locked = options.locked || false; this.name = options.name || '';
      this.fill = options.fill || 'transparent'; this.fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 1;
      this.stroke = options.stroke || 'none'; this.strokeWidth = options.strokeWidth || 1;
      this.strokeOpacity = options.strokeOpacity !== undefined ? options.strokeOpacity : 1;
      this.strokeCap = options.strokeCap || 'butt'; this.strokeJoin = options.strokeJoin || 'miter';
      this.strokeDash = options.strokeDash || []; this.blendMode = options.blendMode || 'normal';
      this.shadow = options.shadow || null; this.blur = options.blur || 0;
    }
    _generateId() { return `${this.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; }
    getBounds() { return { x: this.x, y: this.y, width: this.width * this.scaleX, height: this.height * this.scaleY }; }
    containsPoint(px, py) { const b = this.getBounds(); return px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height; }
    clone() { const Ctor = this.constructor; return Ctor.deserialize ? Ctor.deserialize(this.serialize()) : null; }
    serialize() { return { type: this.type, id: this.id, x: this.x, y: this.y, width: this.width, height: this.height, rotation: this.rotation, scaleX: this.scaleX, scaleY: this.scaleY, opacity: this.opacity, visible: this.visible, locked: this.locked, name: this.name, fill: this.fill, fillOpacity: this.fillOpacity, stroke: this.stroke, strokeWidth: this.strokeWidth, strokeOpacity: this.strokeOpacity, strokeCap: this.strokeCap, strokeJoin: this.strokeJoin, strokeDash: this.strokeDash, blendMode: this.blendMode, shadow: this.shadow, blur: this.blur }; }
    static deserialize(data) { return new VexelShape(data); }
  }

  class VexelRectangle extends VexelShape {
    constructor(x, y, width, height, options = {}) {
      super({ ...options, x, y, width, height });
      this.type = 'rectangle';
      this.cornerRadius = options.cornerRadius || 0;
      if (!this.id || this.id.startsWith('shape_')) this.id = this._generateId();
    }
    draw(ctx) {
      if (!this.visible) return;
      ctx.save();
      ctx.globalAlpha = this.opacity;
      const cx = this.x + this.width / 2, cy = this.y + this.height / 2;
      ctx.translate(cx, cy); ctx.rotate((this.rotation * Math.PI) / 180); ctx.scale(this.scaleX, this.scaleY); ctx.translate(-cx, -cy);
      if (this.fill !== 'transparent') { ctx.fillStyle = this.fill; if (this.cornerRadius > 0) { ctx.beginPath(); ctx.roundRect(this.x, this.y, this.width, this.height, this.cornerRadius); ctx.fill(); } else { ctx.fillRect(this.x, this.y, this.width, this.height); } }
      if (this.stroke !== 'none') { ctx.strokeStyle = this.stroke; ctx.lineWidth = this.strokeWidth; ctx.setLineDash(this.strokeDash); if (this.cornerRadius > 0) { ctx.beginPath(); ctx.roundRect(this.x, this.y, this.width, this.height, this.cornerRadius); ctx.stroke(); } else { ctx.strokeRect(this.x, this.y, this.width, this.height); } ctx.setLineDash([]); }
      ctx.restore();
    }
    serialize() { return { ...super.serialize(), cornerRadius: this.cornerRadius }; }
    static deserialize(data) { return new VexelRectangle(data.x, data.y, data.width, data.height, data); }
  }

  class VexelEllipse extends VexelShape {
    constructor(x, y, radiusX, radiusY, options = {}) {
      super({ ...options, x, y });
      this.type = 'ellipse'; this.radiusX = radiusX; this.radiusY = radiusY;
      if (!this.id || this.id.startsWith('shape_')) this.id = this._generateId();
    }
    draw(ctx) {
      if (!this.visible) return;
      ctx.save(); ctx.globalAlpha = this.opacity;
      ctx.translate(this.x, this.y); ctx.rotate((this.rotation * Math.PI) / 180);
      ctx.beginPath(); ctx.ellipse(0, 0, this.radiusX, this.radiusY, 0, 0, Math.PI * 2);
      if (this.fill !== 'transparent') { ctx.fillStyle = this.fill; ctx.fill(); }
      if (this.stroke !== 'none') { ctx.strokeStyle = this.stroke; ctx.lineWidth = this.strokeWidth; ctx.setLineDash(this.strokeDash); ctx.stroke(); ctx.setLineDash([]); }
      ctx.restore();
    }
    getBounds() { return { x: this.x - this.radiusX, y: this.y - this.radiusY, width: this.radiusX * 2, height: this.radiusY * 2 }; }
    serialize() { return { ...super.serialize(), radiusX: this.radiusX, radiusY: this.radiusY }; }
    static deserialize(data) { return new VexelEllipse(data.x, data.y, data.radiusX, data.radiusY, data); }
  }

  class VexelPolygon extends VexelShape {
    constructor(x, y, sides, radius, options = {}) {
      super({ ...options, x, y });
      this.type = 'polygon'; this.sides = sides; this.radius = radius;
      if (!this.id || this.id.startsWith('shape_')) this.id = this._generateId();
    }
    draw(ctx) {
      if (!this.visible) return;
      ctx.save(); ctx.globalAlpha = this.opacity;
      ctx.translate(this.x, this.y); ctx.rotate((this.rotation * Math.PI) / 180);
      ctx.beginPath();
      for (let i = 0; i < this.sides; i++) { const angle = (i * 2 * Math.PI) / this.sides - Math.PI / 2; const px = Math.cos(angle) * this.radius, py = Math.sin(angle) * this.radius; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
      ctx.closePath();
      if (this.fill !== 'transparent') { ctx.fillStyle = this.fill; ctx.fill(); }
      if (this.stroke !== 'none') { ctx.strokeStyle = this.stroke; ctx.lineWidth = this.strokeWidth; ctx.setLineDash(this.strokeDash); ctx.stroke(); ctx.setLineDash([]); }
      ctx.restore();
    }
    getBounds() { return { x: this.x - this.radius, y: this.y - this.radius, width: this.radius * 2, height: this.radius * 2 }; }
    serialize() { return { ...super.serialize(), sides: this.sides, radius: this.radius }; }
    static deserialize(data) { return new VexelPolygon(data.x, data.y, data.sides, data.radius, data); }
  }

  class VexelLine extends VexelShape {
    constructor(x1, y1, x2, y2, options = {}) {
      super({ ...options, x: x1, y: y1 });
      this.type = 'line'; this.x1 = x1; this.y1 = y1; this.x2 = x2; this.y2 = y2;
      if (!this.id || this.id.startsWith('shape_')) this.id = this._generateId();
    }
    draw(ctx) {
      if (!this.visible) return;
      ctx.save(); ctx.globalAlpha = this.opacity;
      ctx.strokeStyle = this.stroke; ctx.lineWidth = this.strokeWidth; ctx.setLineDash(this.strokeDash); ctx.lineCap = this.strokeCap;
      ctx.beginPath(); ctx.moveTo(this.x1, this.y1); ctx.lineTo(this.x2, this.y2); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    }
    getBounds() { return { x: Math.min(this.x1, this.x2), y: Math.min(this.y1, this.y2), width: Math.abs(this.x2 - this.x1), height: Math.abs(this.y2 - this.y1) }; }
    serialize() { return { ...super.serialize(), x1: this.x1, y1: this.y1, x2: this.x2, y2: this.y2 }; }
    static deserialize(data) { return new VexelLine(data.x1, data.y1, data.x2, data.y2, data); }
  }

  class VexelPath extends VexelShape {
    constructor(points = [], options = {}) {
      super(options);
      this.type = 'path'; this.points = points; this.closed = options.closed || false;
      if (!this.id || this.id.startsWith('shape_')) this.id = this._generateId();
    }
    draw(ctx) {
      if (!this.visible || this.points.length < 2) return;
      ctx.save(); ctx.globalAlpha = this.opacity;
      ctx.beginPath(); ctx.moveTo(this.points[0].x, this.points[0].y);
      for (let i = 1; i < this.points.length; i++) ctx.lineTo(this.points[i].x, this.points[i].y);
      if (this.closed) ctx.closePath();
      if (this.fill !== 'transparent') { ctx.fillStyle = this.fill; ctx.fill(); }
      if (this.stroke !== 'none') { ctx.strokeStyle = this.stroke; ctx.lineWidth = this.strokeWidth; ctx.setLineDash(this.strokeDash); ctx.stroke(); ctx.setLineDash([]); }
      ctx.restore();
    }
    getBounds() { return VexelBounds.fromPoints(this.points); }
    serialize() { return { ...super.serialize(), points: this.points, closed: this.closed }; }
    static deserialize(data) { return new VexelPath(data.points, data); }
  }

  class VexelText extends VexelShape {
    constructor(x, y, content, options = {}) {
      super({ ...options, x, y });
      this.type = 'text'; this.content = content || '';
      this.fontSize = options.fontSize || 16; this.fontFamily = options.fontFamily || 'sans-serif';
      this.fontWeight = options.fontWeight || 'normal'; this.fontStyle = options.fontStyle || 'normal';
      this.align = options.align || 'left'; this.lineHeight = options.lineHeight || 1.4;
      if (!this.id || this.id.startsWith('shape_')) this.id = this._generateId();
    }
    draw(ctx) {
      if (!this.visible || !this.content) return;
      ctx.save(); ctx.globalAlpha = this.opacity; ctx.fillStyle = this.fill;
      ctx.font = `${this.fontStyle} ${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
      ctx.textAlign = this.align; ctx.textBaseline = 'top';
      const lines = this.content.split('\n');
      let yOff = this.y;
      for (const line of lines) { ctx.fillText(line, this.x, yOff); yOff += this.fontSize * this.lineHeight; }
      ctx.restore();
    }
    getBounds() {
      const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
      ctx.font = `${this.fontStyle} ${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
      const lines = this.content.split('\n');
      let maxW = 0;
      for (const line of lines) maxW = Math.max(maxW, ctx.measureText(line).width);
      return { x: this.x, y: this.y, width: maxW, height: lines.length * this.fontSize * this.lineHeight };
    }
    serialize() { return { ...super.serialize(), content: this.content, fontSize: this.fontSize, fontFamily: this.fontFamily, fontWeight: this.fontWeight, fontStyle: this.fontStyle, align: this.align, lineHeight: this.lineHeight }; }
    static deserialize(data) { return new VexelText(data.x, data.y, data.content, data); }
  }

  class VexelImage extends VexelShape {
    constructor(x, y, src, options = {}) {
      super({ ...options, x, y, width: options.width || 100, height: options.height || 100 });
      this.type = 'image'; this.src = src; this.loaded = false;
      this.img = new Image(); this.img.src = src; this.img.onload = () => { this.loaded = true; };
      if (!this.id || this.id.startsWith('shape_')) this.id = this._generateId();
    }
    draw(ctx) {
      if (!this.visible || !this.loaded) return;
      ctx.save(); ctx.globalAlpha = this.opacity;
      if (this.rotation) { const cx = this.x + this.width / 2, cy = this.y + this.height / 2; ctx.translate(cx, cy); ctx.rotate((this.rotation * Math.PI) / 180); ctx.translate(-cx, -cy); }
      ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
      ctx.restore();
    }
    serialize() { return { ...super.serialize(), src: this.src }; }
    static deserialize(data) { return new VexelImage(data.x, data.y, data.src, data); }
  }

  // ============================================================
  // src/core/renderer.js
  // ============================================================
  class VexelRenderer {
    constructor(vexel) {
      this.vexel = vexel;
      this.fps = 0; this.frameCount = 0; this.lastFPSTime = performance.now();
      this.dirty = true; this.renderingEnabled = true;
    }
    render() {
      if (!this.renderingEnabled) return;
      this.frameCount++;
      const now = performance.now();
      if (now - this.lastFPSTime >= 1000) { this.fps = this.frameCount; this.frameCount = 0; this.lastFPSTime = now; }
      const ctx = this.vexel.ctx;
      ctx.clearRect(0, 0, this.vexel.width, this.vexel.height);
      ctx.save();
      ctx.translate(this.vexel.viewport.x, this.vexel.viewport.y);
      ctx.scale(this.vexel.viewport.zoom, this.vexel.viewport.zoom);
      for (const shape of this.vexel.shapes) { if (shape.visible !== false) shape.draw(ctx); }
      ctx.restore();
    }
  }

  // ============================================================
  // src/core/viewport.js
  // ============================================================
  class VexelViewport {
    constructor(vexel) { this.vexel = vexel; this.x = 0; this.y = 0; this.zoom = 1; this.rotation = 0; }
    pan(dx, dy) { this.x += dx; this.y += dy; this._sync(); }
    zoomAt(factor, cx, cy) {
      const oldZoom = this.zoom;
      this.zoom = Math.max(0.001, Math.min(100, this.zoom * factor));
      if (cx !== undefined) { this.x = cx - (cx - this.x) * (this.zoom / oldZoom); this.y = cy - (cy - this.y) * (this.zoom / oldZoom); }
      this._sync();
    }
    zoomIn(f = 1.2) { this.zoomAt(f, this.vexel.width / 2, this.vexel.height / 2); }
    zoomOut(f = 0.8) { this.zoomIn(f); }
    zoomToFit(shapes, padding = 50) {
      if (!shapes || shapes.length === 0) { this.reset(); return; }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const s of shapes) { const b = s.getBounds(); minX = Math.min(minX, b.x); minY = Math.min(minY, b.y); maxX = Math.max(maxX, b.x + b.width); maxY = Math.max(maxY, b.y + b.height); }
      const cw = maxX - minX + padding * 2, ch = maxY - minY + padding * 2;
      this.zoom = Math.min(this.vexel.width / cw, this.vexel.height / ch, 1);
      this.x = (this.vexel.width - cw * this.zoom) / 2 - minX * this.zoom + padding * this.zoom;
      this.y = (this.vexel.height - ch * this.zoom) / 2 - minY * this.zoom + padding * this.zoom;
      this._sync();
    }
    reset() { this.x = 0; this.y = 0; this.zoom = 1; this.rotation = 0; this._sync(); }
    _sync() { Object.assign(this.vexel.viewport, { x: this.x, y: this.y, zoom: this.zoom, rotation: this.rotation }); this.vexel.dirty = true; }
  }

  // ============================================================
  // src/core/canvas.js
  // ============================================================
  class VexelCanvas {
    constructor(vexel) { this.vexel = vexel; }
    zoomIn(f = 1.2) { this.vexel.viewportManager.zoomIn(f); }
    zoomOut(f = 0.8) { this.vexel.viewportManager.zoomOut(f); }
    zoomToFit(shapes, p) { this.vexel.viewportManager.zoomToFit(shapes || this.vexel.shapes, p); }
    resetView() { this.vexel.viewportManager.reset(); }
  }

  // ============================================================
  // src/utils/history.js
  // ============================================================
  class VexelHistory {
    constructor(vexel, options = {}) { this.vexel = vexel; this.maxSteps = options.maxSteps || 100; this.undoStack = []; this.redoStack = []; }
    push(action) { this.undoStack.push(action); if (this.undoStack.length > this.maxSteps) this.undoStack.shift(); this.redoStack = []; }
    undo() {
      if (!this.undoStack.length) return false;
      const action = this.undoStack.pop(); this.redoStack.push(action);
      if (action.type === 'add-shapes') for (const s of action.shapes) { const i = this.vexel.shapes.indexOf(s); if (i > -1) this.vexel.shapes.splice(i, 1); }
      this.vexel.dirty = true; return true;
    }
    redo() {
      if (!this.redoStack.length) return false;
      const action = this.redoStack.pop(); this.undoStack.push(action);
      if (action.type === 'add-shapes') for (const s of action.shapes) this.vexel.shapes.push(s);
      this.vexel.dirty = true; return true;
    }
    recordAdd(shapes) { this.push({ type: 'add-shapes', shapes: Array.isArray(shapes) ? shapes : [shapes] }); }
    recordDeleteAll() { this.push({ type: 'delete-all', previousShapes: [...this.vexel.shapes] }); }
  }

  // ============================================================
  // src/utils/clipboard.js
  // ============================================================
  class VexelClipboard {
    constructor(vexel) { this.vexel = vexel; this.items = []; this.maxItems = 20; }
    copy(shapes) {
      const list = Array.isArray(shapes) ? shapes : [shapes];
      if (!list.length) return null;
      const data = { shapes: list.map(s => s.serialize()), timestamp: Date.now() };
      this.items.push(data); if (this.items.length > this.maxItems) this.items.shift(); return data;
    }
    paste(x, y) {
      if (!this.items.length) return [];
      const last = this.items[this.items.length - 1];
      const newShapes = [];
      const ox = x !== undefined ? x - last.shapes[0].x : 20;
      const oy = y !== undefined ? y - last.shapes[0].y : 20;
      for (const sd of last.shapes) {
        const Ctor = { rectangle: VexelRectangle, ellipse: VexelEllipse, polygon: VexelPolygon, line: VexelLine, path: VexelPath, text: VexelText, image: VexelImage }[sd.type];
        if (Ctor && Ctor.deserialize) { const s = Ctor.deserialize(sd); s.id = s._generateId(); s.x += ox; s.y += oy; this.vexel.shapes.push(s); newShapes.push(s); }
      }
      this.vexel.dirty = true; return newShapes;
    }
    duplicate(shapes) { this.copy(shapes); return this.paste(); }
  }

  // ============================================================
  // EXPORTS
  // ============================================================
  class VexelSVGExport {
    constructor(vexel) { this.vexel = vexel; }
    export() {
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.vexel.width}" height="${this.vexel.height}" viewBox="0 0 ${this.vexel.width} ${this.vexel.height}">`;
      for (const s of this.vexel.shapes) { if (s.visible !== false) svg += this._shapeToSVG(s); }
      svg += '</svg>'; return svg;
    }
    _shapeToSVG(s) {
      if (s.type === 'rectangle') return `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" rx="${s.cornerRadius || 0}" opacity="${s.opacity}"/>`;
      if (s.type === 'ellipse') return `<ellipse cx="${s.x}" cy="${s.y}" rx="${s.radiusX}" ry="${s.radiusY}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" opacity="${s.opacity}"/>`;
      if (s.type === 'line') return `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" opacity="${s.opacity}"/>`;
      return '';
    }
  }

  class VexelPNGExport {
    constructor(vexel) { this.vexel = vexel; }
    export(scale = 1) {
      return new Promise(resolve => {
        const c = document.createElement('canvas'); c.width = this.vexel.width * scale; c.height = this.vexel.height * scale;
        const ctx = c.getContext('2d'); ctx.scale(scale, scale); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.translate(this.vexel.viewport.x, this.vexel.viewport.y); ctx.scale(this.vexel.viewport.zoom, this.vexel.viewport.zoom);
        for (const s of this.vexel.shapes) { if (s.visible !== false) s.draw(ctx); }
        c.toBlob(b => resolve(b), 'image/png');
      });
    }
  }

  class VexelJSONExport {
    constructor(vexel) { this.vexel = vexel; }
    export() { return JSON.stringify({ version: '1.0.0', shapes: this.vexel.shapes.map(s => s.serialize()), viewport: { ...this.vexel.viewport } }, null, 2); }
  }

  // ============================================================
  // CORE ENGINE
  // ============================================================
  class Vexel {
    constructor(config = {}) {
      this.container = typeof config.container === 'string' ? document.querySelector(config.container) : config.container || document.body;
      this.width = config.width || 800; this.height = config.height || 600;
      this.pixelRatio = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
      this.shapes = []; this.selectedShapes = []; this.dirty = true; this.destroyed = false; this.frameId = null;
      this.viewport = { x: 0, y: 0, zoom: 1, rotation: 0 };

      this.events = new VexelEventEmitter();
      this.renderer = new VexelRenderer(this);
      this.viewportManager = new VexelViewport(this);
      this.canvasManager = new VexelCanvas(this);
      this.history = new VexelHistory(this);
      this.clipboard = new VexelClipboard(this);

      this._initCanvas();
      this._startLoop();
      this.events.emit('ready', { target: this });
    }

    _initCanvas() {
      this.container.style.position = 'relative'; this.container.style.overflow = 'hidden';
      this.container.style.width = this.width + 'px'; this.container.style.height = this.height + 'px';
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.width * this.pixelRatio; this.canvas.height = this.height * this.pixelRatio;
      this.canvas.style.width = this.width + 'px'; this.canvas.style.height = this.height + 'px';
      this.canvas.style.position = 'absolute'; this.canvas.style.top = '0'; this.canvas.style.left = '0';
      this.ctx = this.canvas.getContext('2d'); this.ctx.scale(this.pixelRatio, this.pixelRatio);
      this.container.appendChild(this.canvas);
    }

    _startLoop() {
      const loop = () => { if (this.destroyed) return; if (this.dirty) { this.renderer.render(); this.dirty = false; } this.frameId = requestAnimationFrame(loop); };
      this.frameId = requestAnimationFrame(loop);
    }

    rectangle(x, y, w, h, opts = {}) { const s = new VexelRectangle(x, y, w, h, opts); this.shapes.push(s); this.history.recordAdd(s); this.dirty = true; return s; }
    ellipse(x, y, rx, ry, opts = {}) { const s = new VexelEllipse(x, y, rx, ry, opts); this.shapes.push(s); this.history.recordAdd(s); this.dirty = true; return s; }
    polygon(x, y, sides, radius, opts = {}) { const s = new VexelPolygon(x, y, sides, radius, opts); this.shapes.push(s); this.history.recordAdd(s); this.dirty = true; return s; }
    line(x1, y1, x2, y2, opts = {}) { const s = new VexelLine(x1, y1, x2, y2, opts); this.shapes.push(s); this.history.recordAdd(s); this.dirty = true; return s; }
    path(points, opts = {}) { const s = new VexelPath(points, opts); this.shapes.push(s); this.history.recordAdd(s); this.dirty = true; return s; }
    text(x, y, content, opts = {}) { const s = new VexelText(x, y, content, opts); this.shapes.push(s); this.history.recordAdd(s); this.dirty = true; return s; }
    image(x, y, src, opts = {}) { const s = new VexelImage(x, y, src, opts); this.shapes.push(s); this.history.recordAdd(s); this.dirty = true; return s; }

    remove(shape) { const i = this.shapes.indexOf(shape); if (i > -1) { this.shapes.splice(i, 1); this.deselect(shape); this.dirty = true; } }
    clear() { if (this.shapes.length > 0) this.history.recordDeleteAll(); this.shapes = []; this.selectedShapes = []; this.dirty = true; }
    select(shape) { if (!this.selectedShapes.includes(shape)) { this.selectedShapes.push(shape); this.dirty = true; } }
    deselect(shape) { const i = this.selectedShapes.indexOf(shape); if (i > -1) { this.selectedShapes.splice(i, 1); this.dirty = true; } }
    selectAll() { this.selectedShapes = [...this.shapes.filter(s => s.visible !== false && !s.locked)]; this.dirty = true; }
    deselectAll() { this.selectedShapes = []; this.dirty = true; }
    deleteSelected() { for (const s of [...this.selectedShapes]) this.remove(s); this.selectedShapes = []; this.dirty = true; }
    getShapeAt(x, y) { for (let i = this.shapes.length - 1; i >= 0; i--) { const s = this.shapes[i]; if (s.visible !== false && !s.locked && s.containsPoint(x, y)) return s; } return null; }

    undo() { this.history.undo(); }
    redo() { this.history.redo(); }
    copy() { this.clipboard.copy(this.selectedShapes); }
    paste() { this.clipboard.paste(); }
    duplicate() { this.clipboard.duplicate(this.selectedShapes); }

    zoomIn(f = 1.2) { this.viewportManager.zoomIn(f); }
    zoomOut(f = 0.8) { this.viewportManager.zoomOut(f); }
    zoomToFit(shapes, p) { this.viewportManager.zoomToFit(shapes || this.shapes, p); }
    resetView() { this.viewportManager.reset(); }

    on(event, cb) { return this.events.on(event, cb); }
    off(event, cb) { this.events.off(event, cb); }

    exportSVG() { return new VexelSVGExport(this).export(); }
    exportPNG(scale) { return new VexelPNGExport(this).export(scale); }
    exportJSON() { return new VexelJSONExport(this).export(); }

    save() { return { version: '1.0.0', viewport: { ...this.viewport }, shapes: this.shapes.map(s => s.serialize()) }; }
    load(data) {
      if (!data || !data.shapes) return;
      this.clear();
      if (data.viewport) Object.assign(this.viewport, data.viewport);
      for (const sd of data.shapes) {
        const Ctor = { rectangle: VexelRectangle, ellipse: VexelEllipse, polygon: VexelPolygon, line: VexelLine, path: VexelPath, text: VexelText, image: VexelImage }[sd.type];
        if (Ctor && Ctor.deserialize) this.shapes.push(Ctor.deserialize(sd));
      }
      this.dirty = true;
    }

    resize(w, h) {
      this.width = w; this.height = h;
      this.container.style.width = w + 'px'; this.container.style.height = h + 'px';
      this.canvas.width = w * this.pixelRatio; this.canvas.height = h * this.pixelRatio;
      this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
      this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      this.dirty = true;
    }

    destroy() {
      this.destroyed = true; cancelAnimationFrame(this.frameId);
      this.events.removeAllListeners(); this.container.removeChild(this.canvas);
      this.shapes = []; this.selectedShapes = [];
    }
  }

  // ============================================================
  // EXPORT TO GLOBAL
  // ============================================================
  global.Vexel = Vexel;
  global.VexelRectangle = VexelRectangle;
  global.VexelEllipse = VexelEllipse;
  global.VexelPolygon = VexelPolygon;
  global.VexelLine = VexelLine;
  global.VexelPath = VexelPath;
  global.VexelText = VexelText;
  global.VexelImage = VexelImage;
  global.VexelMath = VexelMath;
  global.VexelMatrix = VexelMatrix;
  global.VexelBounds = VexelBounds;
  global.VexelColor = VexelColor;
  global.VexelGeometry = VexelGeometry;
  global.VexelEventEmitter = VexelEventEmitter;
  global.VexelSVGExport = VexelSVGExport;
  global.VexelPNGExport = VexelPNGExport;
  global.VexelJSONExport = VexelJSONExport;
  global.VexelHistory = VexelHistory;
  global.VexelClipboard = VexelClipboard;
  global.VexelViewport = VexelViewport;
  global.VexelCanvas = VexelCanvas;
  global.VexelRenderer = VexelRenderer;
  global.VexelShape = VexelShape;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Vexel, VexelRectangle, VexelEllipse, VexelPolygon, VexelLine, VexelPath, VexelText, VexelImage, VexelMath, VexelMatrix, VexelBounds, VexelColor, VexelGeometry, VexelEventEmitter, VexelSVGExport, VexelPNGExport, VexelJSONExport, VexelHistory, VexelClipboard, VexelViewport, VexelCanvas, VexelRenderer, VexelShape };
  }

})(typeof window !== 'undefined' ? window : this);
// src/core/vexel.js

class Vexel {
    constructor(config = {}) {
        this.container = typeof config.container === 'string' 
            ? document.querySelector(config.container) 
            : config.container || document.body;
        this.width = config.width || 800;
        this.height = config.height || 600;
        this.zoomEnabled = config.zoom !== false;
        this.panEnabled = config.pan !== false;
        this.gridEnabled = config.grid || false;
        this.snapEnabled = config.snap || false;
        this.snapSize = config.snapSize || 10;
        this.theme = config.theme || 'dark';
        this.locale = config.locale || 'en';
        this.plugins = [];
        this.layers = [];
        this.shapes = [];
        this.selectedShapes = [];
        this.clipboard = [];
        this.history = { undo: [], redo: [], maxSteps: config.maxHistory || 100 };
        this.viewport = { x: 0, y: 0, zoom: 1, rotation: 0 };
        this.tool = 'select';
        this.renderer = null;
        this.canvas = null;
        this.ctx = null;
        this.overlayCanvas = null;
        this.overlayCtx = null;
        this.frameId = null;
        this.dirty = true;
        this.destroyed = false;
        this._init();
    }

    _init() {
        this._createCanvas();
        this._setupRenderer();
        this._attachEvents();
        this._startLoop();
        this._fireEvent('ready', { target: this });
    }

    _createCanvas() {
        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';
        this.container.style.width = this.width + 'px';
        this.container.style.height = this.height + 'px';

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width * window.devicePixelRatio;
        this.canvas.height = this.height * window.devicePixelRatio;
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.ctx = this.canvas.getContext('2d');
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.width = this.width * window.devicePixelRatio;
        this.overlayCanvas.height = this.height * window.devicePixelRatio;
        this.overlayCanvas.style.width = this.width + 'px';
        this.overlayCanvas.style.height = this.height + 'px';
        this.overlayCanvas.style.position = 'absolute';
        this.overlayCanvas.style.top = '0';
        this.overlayCanvas.style.left = '0';
        this.overlayCanvas.style.pointerEvents = 'none';
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        this.overlayCtx.scale(window.devicePixelRatio, window.devicePixelRatio);

        this.container.appendChild(this.canvas);
        this.container.appendChild(this.overlayCanvas);
    }

    _setupRenderer() {
        this.renderer = {
            clear: () => {
                this.ctx.clearRect(0, 0, this.width, this.height);
                this.overlayCtx.clearRect(0, 0, this.width, this.height);
            },
            renderAll: () => {
                this.renderer.clear();
                if (this.gridEnabled) this._drawGrid();
                this.ctx.save();
                this.ctx.translate(this.viewport.x, this.viewport.y);
                this.ctx.scale(this.viewport.zoom, this.viewport.zoom);
                this.ctx.rotate(this.viewport.rotation);
                for (const shape of this.shapes) {
                    if (shape.visible !== false) shape.draw(this.ctx);
                }
                this.ctx.restore();
                this._drawSelectionHandles();
                this.dirty = false;
            }
        };
    }

    _drawGrid() {
        const gridSize = this.snapSize * this.viewport.zoom;
        const offsetX = this.viewport.x % gridSize;
        const offsetY = this.viewport.y % gridSize;
        this.ctx.strokeStyle = 'rgba(128,128,128,0.15)';
        this.ctx.lineWidth = 0.5;
        this.ctx.beginPath();
        for (let x = offsetX; x < this.width; x += gridSize) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
        }
        for (let y = offsetY; y < this.height; y += gridSize) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
        }
        this.ctx.stroke();
    }

    _drawSelectionHandles() {
        if (this.selectedShapes.length === 0) return;
        this.overlayCtx.save();
        this.overlayCtx.translate(this.viewport.x, this.viewport.y);
        this.overlayCtx.scale(this.viewport.zoom, this.viewport.zoom);
        for (const shape of this.selectedShapes) {
            const bounds = shape.getBounds();
            this.overlayCtx.strokeStyle = '#4A90D9';
            this.overlayCtx.lineWidth = 1.5 / this.viewport.zoom;
            this.overlayCtx.setLineDash([4, 4]);
            this.overlayCtx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
            this.overlayCtx.setLineDash([]);
            this._drawHandle(bounds.x, bounds.y);
            this._drawHandle(bounds.x + bounds.width, bounds.y);
            this._drawHandle(bounds.x, bounds.y + bounds.height);
            this._drawHandle(bounds.x + bounds.width, bounds.y + bounds.height);
            this._drawHandle(bounds.x + bounds.width / 2, bounds.y);
            this._drawHandle(bounds.x + bounds.width / 2, bounds.y + bounds.height);
            this._drawHandle(bounds.x, bounds.y + bounds.height / 2);
            this._drawHandle(bounds.x + bounds.width, bounds.y + bounds.height / 2);
        }
        this.overlayCtx.restore();
    }

    _drawHandle(x, y) {
        const size = 7 / this.viewport.zoom;
        this.overlayCtx.fillStyle = '#ffffff';
        this.overlayCtx.strokeStyle = '#4A90D9';
        this.overlayCtx.lineWidth = 1.5 / this.viewport.zoom;
        this.overlayCtx.beginPath();
        this.overlayCtx.rect(x - size / 2, y - size / 2, size, size);
        this.overlayCtx.fill();
        this.overlayCtx.stroke();
    }

    _startLoop() {
        const loop = () => {
            if (this.destroyed) return;
            if (this.dirty) this.renderer.renderAll();
            this.frameId = requestAnimationFrame(loop);
        };
        this.frameId = requestAnimationFrame(loop);
    }

    _attachEvents() {
        let isPanning = false;
        let panStart = { x: 0, y: 0 };
        let panViewportStart = { x: 0, y: 0 };

        this.container.addEventListener('wheel', (e) => {
            if (!this.zoomEnabled) return;
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = Math.max(0.01, Math.min(100, this.viewport.zoom * delta));
            const rect = this.container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            this.viewport.x = mouseX - (mouseX - this.viewport.x) * (newZoom / this.viewport.zoom);
            this.viewport.y = mouseY - (mouseY - this.viewport.y) * (newZoom / this.viewport.zoom);
            this.viewport.zoom = newZoom;
            this.dirty = true;
        }, { passive: false });

        this.container.addEventListener('mousedown', (e) => {
            if (e.button === 1 || (e.button === 0 && e.altKey)) {
                isPanning = true;
                panStart = { x: e.clientX, y: e.clientY };
                panViewportStart = { x: this.viewport.x, y: this.viewport.y };
                this.container.style.cursor = 'grabbing';
                return;
            }
            if (e.button === 0) {
                this._handleMouseDown(e);
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (isPanning) {
                this.viewport.x = panViewportStart.x + (e.clientX - panStart.x);
                this.viewport.y = panViewportStart.y + (e.clientY - panStart.y);
                this.dirty = true;
            }
        });

        window.addEventListener('mouseup', () => {
            if (isPanning) {
                isPanning = false;
                this.container.style.cursor = 'default';
            }
        });
    }

    _handleMouseDown(e) {
        const rect = this.container.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.viewport.x) / this.viewport.zoom;
        const y = (e.clientY - rect.top - this.viewport.y) / this.viewport.zoom;
        this._fireEvent('mousedown', { x, y, originalEvent: e });
    }

    _fireEvent(name, data) {
        const event = new CustomEvent(`vexel:${name}`, { detail: data });
        this.container.dispatchEvent(event);
    }

    on(event, callback) {
        this.container.addEventListener(`vexel:${event}`, (e) => callback(e.detail));
    }

    off(event, callback) {
        this.container.removeEventListener(`vexel:${event}`, callback);
    }

    rectangle(x, y, width, height, options = {}) {
        const shape = new VexelRectangle(x, y, width, height, options);
        this.shapes.push(shape);
        this.dirty = true;
        this._pushHistory({ type: 'add', shape });
        return shape;
    }

    ellipse(x, y, radiusX, radiusY, options = {}) {
        const shape = new VexelEllipse(x, y, radiusX, radiusY, options);
        this.shapes.push(shape);
        this.dirty = true;
        this._pushHistory({ type: 'add', shape });
        return shape;
    }

    polygon(x, y, sides, radius, options = {}) {
        const shape = new VexelPolygon(x, y, sides, radius, options);
        this.shapes.push(shape);
        this.dirty = true;
        this._pushHistory({ type: 'add', shape });
        return shape;
    }

    line(x1, y1, x2, y2, options = {}) {
        const shape = new VexelLine(x1, y1, x2, y2, options);
        this.shapes.push(shape);
        this.dirty = true;
        this._pushHistory({ type: 'add', shape });
        return shape;
    }

    path(points, options = {}) {
        const shape = new VexelPath(points, options);
        this.shapes.push(shape);
        this.dirty = true;
        this._pushHistory({ type: 'add', shape });
        return shape;
    }

    text(x, y, content, options = {}) {
        const shape = new VexelText(x, y, content, options);
        this.shapes.push(shape);
        this.dirty = true;
        this._pushHistory({ type: 'add', shape });
        return shape;
    }

    image(x, y, src, options = {}) {
        const shape = new VexelImage(x, y, src, options);
        this.shapes.push(shape);
        this.dirty = true;
        this._pushHistory({ type: 'add', shape });
        return shape;
    }

    group(shapes, options = {}) {
        const group = new VexelGroup(shapes, options);
        this.shapes.push(group);
        this.dirty = true;
        this._pushHistory({ type: 'add', shape: group });
        return group;
    }

    remove(shape) {
        const index = this.shapes.indexOf(shape);
        if (index > -1) {
            this.shapes.splice(index, 1);
            this.dirty = true;
            this._pushHistory({ type: 'remove', shape, index });
        }
    }

    clear() {
        this.shapes = [];
        this.selectedShapes = [];
        this.dirty = true;
        this._pushHistory({ type: 'clear', shapes: [...this.shapes] });
    }

    select(shape) {
        if (!this.selectedShapes.includes(shape)) {
            this.selectedShapes.push(shape);
            this.dirty = true;
        }
    }

    deselect(shape) {
        const index = this.selectedShapes.indexOf(shape);
        if (index > -1) {
            this.selectedShapes.splice(index, 1);
            this.dirty = true;
        }
    }

    selectAll() {
        this.selectedShapes = [...this.shapes];
        this.dirty = true;
    }

    deselectAll() {
        this.selectedShapes = [];
        this.dirty = true;
    }

    deleteSelected() {
        for (const shape of [...this.selectedShapes]) {
            this.remove(shape);
        }
        this.selectedShapes = [];
        this.dirty = true;
    }

    zoomIn(factor = 1.1) {
        this.viewport.zoom *= factor;
        this.viewport.zoom = Math.min(100, this.viewport.zoom);
        this.dirty = true;
    }

    zoomOut(factor = 0.9) {
        this.viewport.zoom *= factor;
        this.viewport.zoom = Math.max(0.01, this.viewport.zoom);
        this.dirty = true;
    }

    zoomToFit(padding = 50) {
        if (this.shapes.length === 0) return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const shape of this.shapes) {
            const b = shape.getBounds();
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
        }
        const contentWidth = maxX - minX + padding * 2;
        const contentHeight = maxY - minY + padding * 2;
        const zoomX = this.width / contentWidth;
        const zoomY = this.height / contentHeight;
        this.viewport.zoom = Math.min(zoomX, zoomY);
        this.viewport.x = (this.width - contentWidth * this.viewport.zoom) / 2 - minX * this.viewport.zoom + padding * this.viewport.zoom;
        this.viewport.y = (this.height - contentHeight * this.viewport.zoom) / 2 - minY * this.viewport.zoom + padding * this.viewport.zoom;
        this.dirty = true;
    }

    resetView() {
        this.viewport = { x: 0, y: 0, zoom: 1, rotation: 0 };
        this.dirty = true;
    }

    undo() {
        if (this.history.undo.length === 0) return;
        const action = this.history.undo.pop();
        this.history.redo.push(action);
        this._applyUndo(action);
        this.dirty = true;
    }

    redo() {
        if (this.history.redo.length === 0) return;
        const action = this.history.redo.pop();
        this.history.undo.push(action);
        this._applyRedo(action);
        this.dirty = true;
    }

    _pushHistory(action) {
        this.history.undo.push(action);
        if (this.history.undo.length > this.history.maxSteps) {
            this.history.undo.shift();
        }
        this.history.redo = [];
    }

    _applyUndo(action) {
        if (action.type === 'add') {
            const index = this.shapes.indexOf(action.shape);
            if (index > -1) this.shapes.splice(index, 1);
        } else if (action.type === 'remove') {
            this.shapes.splice(action.index, 0, action.shape);
        } else if (action.type === 'clear') {
            this.shapes = [...action.shapes];
        }
    }

    _applyRedo(action) {
        if (action.type === 'add') {
            this.shapes.push(action.shape);
        } else if (action.type === 'remove') {
            const index = this.shapes.indexOf(action.shape);
            if (index > -1) this.shapes.splice(index, 1);
        } else if (action.type === 'clear') {
            this.shapes = [];
        }
    }

    save() {
        return {
            version: '1.0.0',
            viewport: { ...this.viewport },
            shapes: this.shapes.map(s => s.serialize()),
            layers: this.layers.map(l => l.serialize()),
            exportedAt: new Date().toISOString()
        };
    }

    load(data) {
        if (!data || !data.shapes) return;
        this.clear();
        this.viewport = { ...data.viewport };
        for (const shapeData of data.shapes) {
            const shape = this._deserializeShape(shapeData);
            if (shape) this.shapes.push(shape);
        }
        this.dirty = true;
    }

    _deserializeShape(data) {
        const constructors = {
            rectangle: VexelRectangle,
            ellipse: VexelEllipse,
            polygon: VexelPolygon,
            line: VexelLine,
            path: VexelPath,
            text: VexelText,
            image: VexelImage,
            group: VexelGroup
        };
        const Ctor = constructors[data.type];
        if (!Ctor) return null;
        return Ctor.deserialize(data);
    }

    exportJSON() {
        return JSON.stringify(this.save(), null, 2);
    }

    exportSVG() {
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">`;
        for (const shape of this.shapes) {
            svg += shape.toSVG();
        }
        svg += '</svg>';
        return svg;
    }

    exportPNG(scale = 1) {
        return new Promise((resolve) => {
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = this.width * scale;
            exportCanvas.height = this.height * scale;
            const exportCtx = exportCanvas.getContext('2d');
            exportCtx.scale(scale, scale);
            exportCtx.drawImage(this.canvas, 0, 0);
            exportCanvas.toBlob((blob) => resolve(blob), 'image/png');
        });
    }

    addPlugin(plugin) {
        this.plugins.push(plugin);
        if (plugin.install) plugin.install(this);
    }

    removePlugin(plugin) {
        const index = this.plugins.indexOf(plugin);
        if (index > -1) {
            if (plugin.uninstall) plugin.uninstall(this);
            this.plugins.splice(index, 1);
        }
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        this.container.style.width = width + 'px';
        this.container.style.height = height + 'px';
        this.canvas.width = width * window.devicePixelRatio;
        this.canvas.height = height * window.devicePixelRatio;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.overlayCanvas.width = width * window.devicePixelRatio;
        this.overlayCanvas.height = height * window.devicePixelRatio;
        this.overlayCanvas.style.width = width + 'px';
        this.overlayCanvas.style.height = height + 'px';
        this.overlayCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.dirty = true;
    }

    destroy() {
        this.destroyed = true;
        cancelAnimationFrame(this.frameId);
        this.container.removeChild(this.canvas);
        this.container.removeChild(this.overlayCanvas);
        this.shapes = [];
        this.layers = [];
        this.plugins = [];
        this.history = { undo: [], redo: [], maxSteps: 100 };
    }
}

class VexelRectangle {
    constructor(x, y, width, height, options = {}) {
        this.type = 'rectangle';
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.fill = options.fill || 'transparent';
        this.stroke = options.stroke || 'none';
        this.strokeWidth = options.strokeWidth || 1;
        this.cornerRadius = options.cornerRadius || 0;
        this.opacity = options.opacity !== undefined ? options.opacity : 1;
        this.visible = options.visible !== false;
        this.rotation = options.rotation || 0;
        this.scaleX = options.scaleX || 1;
        this.scaleY = options.scaleY || 1;
        this.id = options.id || `rect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    draw(ctx) {
        if (!this.visible) return;
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.scale(this.scaleX, this.scaleY);
        const x = -this.width / 2;
        const y = -this.height / 2;
        if (this.cornerRadius > 0) {
            ctx.beginPath();
            ctx.roundRect(x, y, this.width, this.height, this.cornerRadius);
        } else {
            ctx.beginPath();
            ctx.rect(x, y, this.width, this.height);
        }
        if (this.fill !== 'transparent') {
            ctx.fillStyle = this.fill;
            ctx.fill();
        }
        if (this.stroke !== 'none') {
            ctx.strokeStyle = this.stroke;
            ctx.lineWidth = this.strokeWidth;
            ctx.stroke();
        }
        ctx.restore();
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width * this.scaleX,
            height: this.height * this.scaleY
        };
    }

    serialize() {
        return {
            type: this.type,
            x: this.x, y: this.y,
            width: this.width, height: this.height,
            fill: this.fill, stroke: this.stroke,
            strokeWidth: this.strokeWidth, cornerRadius: this.cornerRadius,
            opacity: this.opacity, visible: this.visible,
            rotation: this.rotation, scaleX: this.scaleX, scaleY: this.scaleY,
            id: this.id
        };
    }

    static deserialize(data) {
        return new VexelRectangle(data.x, data.y, data.width, data.height, data);
    }

    toSVG() {
        return `<rect x="${this.x}" y="${this.y}" width="${this.width}" height="${this.height}" fill="${this.fill}" stroke="${this.stroke}" stroke-width="${this.strokeWidth}" rx="${this.cornerRadius}" opacity="${this.opacity}" transform="rotate(${this.rotation} ${this.x + this.width / 2} ${this.y + this.height / 2})"/>`;
    }
}

class VexelEllipse {
    constructor(x, y, radiusX, radiusY, options = {}) {
        this.type = 'ellipse';
        this.x = x;
        this.y = y;
        this.radiusX = radiusX;
        this.radiusY = radiusY;
        this.fill = options.fill || 'transparent';
        this.stroke = options.stroke || 'none';
        this.strokeWidth = options.strokeWidth || 1;
        this.opacity = options.opacity !== undefined ? options.opacity : 1;
        this.visible = options.visible !== false;
        this.rotation = options.rotation || 0;
        this.id = options.id || `ellipse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    draw(ctx) {
        if (!this.visible) return;
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radiusX, this.radiusY, 0, 0, Math.PI * 2);
        if (this.fill !== 'transparent') {
            ctx.fillStyle = this.fill;
            ctx.fill();
        }
        if (this.stroke !== 'none') {
            ctx.strokeStyle = this.stroke;
            ctx.lineWidth = this.strokeWidth;
            ctx.stroke();
        }
        ctx.restore();
    }

    getBounds() {
        return {
            x: this.x - this.radiusX,
            y: this.y - this.radiusY,
            width: this.radiusX * 2,
            height: this.radiusY * 2
        };
    }

    serialize() {
        return {
            type: this.type,
            x: this.x, y: this.y,
            radiusX: this.radiusX, radiusY: this.radiusY,
            fill: this.fill, stroke: this.stroke,
            strokeWidth: this.strokeWidth, opacity: this.opacity,
            visible: this.visible, rotation: this.rotation,
            id: this.id
        };
    }

    static deserialize(data) {
        return new VexelEllipse(data.x, data.y, data.radiusX, data.radiusY, data);
    }

    toSVG() {
        return `<ellipse cx="${this.x}" cy="${this.y}" rx="${this.radiusX}" ry="${this.radiusY}" fill="${this.fill}" stroke="${this.stroke}" stroke-width="${this.strokeWidth}" opacity="${this.opacity}" transform="rotate(${this.rotation} ${this.x} ${this.y})"/>`;
    }
}

class VexelPolygon {
    constructor(x, y, sides, radius, options = {}) {
        this.type = 'polygon';
        this.x = x;
        this.y = y;
        this.sides = sides;
        this.radius = radius;
        this.fill = options.fill || 'transparent';
        this.stroke = options.stroke || 'none';
        this.strokeWidth = options.strokeWidth || 1;
        this.opacity = options.opacity !== undefined ? options.opacity : 1;
        this.visible = options.visible !== false;
        this.rotation = options.rotation || 0;
        this.id = options.id || `polygon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    draw(ctx) {
        if (!this.visible) return;
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.beginPath();
        for (let i = 0; i < this.sides; i++) {
            const angle = (i * 2 * Math.PI) / this.sides - Math.PI / 2;
            const px = Math.cos(angle) * this.radius;
            const py = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        if (this.fill !== 'transparent') {
            ctx.fillStyle = this.fill;
            ctx.fill();
        }
        if (this.stroke !== 'none') {
            ctx.strokeStyle = this.stroke;
            ctx.lineWidth = this.strokeWidth;
            ctx.stroke();
        }
        ctx.restore();
    }

    getBounds() {
        return {
            x: this.x - this.radius,
            y: this.y - this.radius,
            width: this.radius * 2,
            height: this.radius * 2
        };
    }

    serialize() {
        return {
            type: this.type,
            x: this.x, y: this.y,
            sides: this.sides, radius: this.radius,
            fill: this.fill, stroke: this.stroke,
            strokeWidth: this.strokeWidth, opacity: this.opacity,
            visible: this.visible, rotation: this.rotation,
            id: this.id
        };
    }

    static deserialize(data) {
        return new VexelPolygon(data.x, data.y, data.sides, data.radius, data);
    }

    toSVG() {
        let points = '';
        for (let i = 0; i < this.sides; i++) {
            const angle = (i * 2 * Math.PI) / this.sides - Math.PI / 2;
            points += `${this.x + Math.cos(angle) * this.radius},${this.y + Math.sin(angle) * this.radius} `;
        }
        return `<polygon points="${points.trim()}" fill="${this.fill}" stroke="${this.stroke}" stroke-width="${this.strokeWidth}" opacity="${this.opacity}" transform="rotate(${this.rotation} ${this.x} ${this.y})"/>`;
    }
}

class VexelLine {
    constructor(x1, y1, x2, y2, options = {}) {
        this.type = 'line';
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.stroke = options.stroke || '#000000';
        this.strokeWidth = options.strokeWidth || 1;
        this.opacity = options.opacity !== undefined ? options.opacity : 1;
        this.visible = options.visible !== false;
        this.lineCap = options.lineCap || 'butt';
        this.lineDash = options.lineDash || [];
        this.id = options.id || `line_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    draw(ctx) {
        if (!this.visible) return;
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.strokeStyle = this.stroke;
        ctx.lineWidth = this.strokeWidth;
        ctx.lineCap = this.lineCap;
        ctx.setLineDash(this.lineDash);
        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);
        ctx.stroke();
        ctx.restore();
    }

    getBounds() {
        return {
            x: Math.min(this.x1, this.x2),
            y: Math.min(this.y1, this.y2),
            width: Math.abs(this.x2 - this.x1),
            height: Math.abs(this.y2 - this.y1)
        };
    }

    serialize() {
        return {
            type: this.type,
            x1: this.x1, y1: this.y1,
            x2: this.x2, y2: this.y2,
            stroke: this.stroke, strokeWidth: this.strokeWidth,
            opacity: this.opacity, visible: this.visible,
            lineCap: this.lineCap, lineDash: this.lineDash,
            id: this.id
        };
    }

    static deserialize(data) {
        return new VexelLine(data.x1, data.y1, data.x2, data.y2, data);
    }

    toSVG() {
        return `<line x1="${this.x1}" y1="${this.y1}" x2="${this.x2}" y2="${this.y2}" stroke="${this.stroke}" stroke-width="${this.strokeWidth}" opacity="${this.opacity}"/>`;
    }
}

class VexelPath {
    constructor(points, options = {}) {
        this.type = 'path';
        this.points = points;
        this.closed = options.closed || false;
        this.fill = options.fill || 'transparent';
        this.stroke = options.stroke || '#000000';
        this.strokeWidth = options.strokeWidth || 1;
        this.opacity = options.opacity !== undefined ? options.opacity : 1;
        this.visible = options.visible !== false;
        this.id = options.id || `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    draw(ctx) {
        if (!this.visible || this.points.length < 2) return;
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        if (this.closed) ctx.closePath();
        if (this.fill !== 'transparent') {
            ctx.fillStyle = this.fill;
            ctx.fill();
        }
        if (this.stroke !== 'none') {
            ctx.strokeStyle = this.stroke;
            ctx.lineWidth = this.strokeWidth;
            ctx.stroke();
        }
        ctx.restore();
    }

    getBounds() {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of this.points) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    serialize() {
        return {
            type: this.type,
            points: this.points,
            closed: this.closed,
            fill: this.fill, stroke: this.stroke,
            strokeWidth: this.strokeWidth, opacity: this.opacity,
            visible: this.visible, id: this.id
        };
    }

    static deserialize(data) {
        return new VexelPath(data.points, data);
    }

    toSVG() {
        let d = `M ${this.points[0].x} ${this.points[0].y}`;
        for (let i = 1; i < this.points.length; i++) {
            d += ` L ${this.points[i].x} ${this.points[i].y}`;
        }
        if (this.closed) d += ' Z';
        return `<path d="${d}" fill="${this.fill}" stroke="${this.stroke}" stroke-width="${this.strokeWidth}" opacity="${this.opacity}"/>`;
    }
}

class VexelText {
    constructor(x, y, content, options = {}) {
        this.type = 'text';
        this.x = x;
        this.y = y;
        this.content = content;
        this.fontSize = options.fontSize || 16;
        this.fontFamily = options.fontFamily || 'sans-serif';
        this.fontWeight = options.fontWeight || 'normal';
        this.fontStyle = options.fontStyle || 'normal';
        this.fill = options.fill || '#000000';
        this.opacity = options.opacity !== undefined ? options.opacity : 1;
        this.visible = options.visible !== false;
        this.rotation = options.rotation || 0;
        this.align = options.align || 'left';
        this.id = options.id || `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    draw(ctx) {
        if (!this.visible) return;
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.font = `${this.fontStyle} ${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
        ctx.fillStyle = this.fill;
        ctx.textAlign = this.align;
        ctx.textBaseline = 'top';
        const lines = this.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], 0, i * this.fontSize * 1.4);
        }
        ctx.restore();
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.content.length * this.fontSize * 0.6,
            height: this.fontSize * 1.4 * this.content.split('\n').length
        };
    }

    serialize() {
        return {
            type: this.type,
            x: this.x, y: this.y,
            content: this.content,
            fontSize: this.fontSize, fontFamily: this.fontFamily,
            fontWeight: this.fontWeight, fontStyle: this.fontStyle,
            fill: this.fill, opacity: this.opacity,
            visible: this.visible, rotation: this.rotation,
            align: this.align, id: this.id
        };
    }

    static deserialize(data) {
        return new VexelText(data.x, data.y, data.content, data);
    }

    toSVG() {
        return `<text x="${this.x}" y="${this.y}" font-size="${this.fontSize}" font-family="${this.fontFamily}" font-weight="${this.fontWeight}" font-style="${this.fontStyle}" fill="${this.fill}" opacity="${this.opacity}" text-anchor="${this.align}" transform="rotate(${this.rotation} ${this.x} ${this.y})">${this.content}</text>`;
    }
}

class VexelImage {
    constructor(x, y, src, options = {}) {
        this.type = 'image';
        this.x = x;
        this.y = y;
        this.src = src;
        this.width = options.width || 100;
        this.height = options.height || 100;
        this.opacity = options.opacity !== undefined ? options.opacity : 1;
        this.visible = options.visible !== false;
        this.rotation = options.rotation || 0;
        this.loaded = false;
        this.img = new Image();
        this.img.src = src;
        this.img.onload = () => { this.loaded = true; };
        this.id = options.id || `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    draw(ctx) {
        if (!this.visible || !this.loaded) return;
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.drawImage(this.img, -this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
    }

    getBounds() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }

    serialize() {
        return {
            type: this.type,
            x: this.x, y: this.y,
            src: this.src, width: this.width, height: this.height,
            opacity: this.opacity, visible: this.visible,
            rotation: this.rotation, id: this.id
        };
    }

    static deserialize(data) {
        return new VexelImage(data.x, data.y, data.src, data);
    }

    toSVG() {
        return `<image href="${this.src}" x="${this.x}" y="${this.y}" width="${this.width}" height="${this.height}" opacity="${this.opacity}" transform="rotate(${this.rotation} ${this.x + this.width / 2} ${this.y + this.height / 2})"/>`;
    }
}

class VexelGroup {
    constructor(shapes = [], options = {}) {
        this.type = 'group';
        this.shapes = shapes;
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.visible = options.visible !== false;
        this.opacity = options.opacity !== undefined ? options.opacity : 1;
        this.rotation = options.rotation || 0;
        this.id = options.id || `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    draw(ctx) {
        if (!this.visible) return;
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        for (const shape of this.shapes) {
            shape.draw(ctx);
        }
        ctx.restore();
    }

    add(shape) {
        this.shapes.push(shape);
    }

    remove(shape) {
        const index = this.shapes.indexOf(shape);
        if (index > -1) this.shapes.splice(index, 1);
    }

    getBounds() {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const shape of this.shapes) {
            const b = shape.getBounds();
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    serialize() {
        return {
            type: this.type,
            x: this.x, y: this.y,
            shapes: this.shapes.map(s => s.serialize()),
            visible: this.visible, opacity: this.opacity,
            rotation: this.rotation, id: this.id
        };
    }

    static deserialize(data) {
        const shapes = data.shapes.map(s => {
            const ctors = { rectangle: VexelRectangle, ellipse: VexelEllipse, polygon: VexelPolygon, line: VexelLine, path: VexelPath, text: VexelText, image: VexelImage };
            const Ctor = ctors[s.type];
            return Ctor ? Ctor.deserialize(s) : null;
        }).filter(Boolean);
        return new VexelGroup(shapes, data);
    }

    toSVG() {
        let svg = `<g transform="translate(${this.x} ${this.y}) rotate(${this.rotation})" opacity="${this.opacity}">`;
        for (const shape of this.shapes) {
            svg += shape.toSVG();
        }
        svg += '</g>';
        return svg;
    }
}

if (typeof window !== 'undefined') {
    window.Vexel = Vexel;
    window.VexelRectangle = VexelRectangle;
    window.VexelEllipse = VexelEllipse;
    window.VexelPolygon = VexelPolygon;
    window.VexelLine = VexelLine;
    window.VexelPath = VexelPath;
    window.VexelText = VexelText;
    window.VexelImage = VexelImage;
    window.VexelGroup = VexelGroup;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Vexel, VexelRectangle, VexelEllipse, VexelPolygon,
        VexelLine, VexelPath, VexelText, VexelImage, VexelGroup
    };
}
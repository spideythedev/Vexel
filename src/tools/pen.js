// src/tools/pen.js

class VexelPenTool {
    constructor(vexel) {
        this.vexel = vexel;
        this.active = false;
        this.points = [];
        this.currentPath = null;
        this.previewPath = null;
        this.drawing = false;
        this.mode = 'cubic';
        this.tension = 0.3;
        this.smooth = true;
        this.closePath = false;
        this.minPoints = 2;
        this.strokeColor = '#000000';
        this.strokeWidth = 2;
        this.fillColor = 'transparent';
        this.opacity = 1;
        this._boundHandlers = {};
        this._setupHandlers();
    }

    _setupHandlers() {
        this._boundHandlers.onPointerDown = this._onPointerDown.bind(this);
        this._boundHandlers.onPointerMove = this._onPointerMove.bind(this);
        this._boundHandlers.onPointerUp = this._onPointerUp.bind(this);
        this._boundHandlers.onKeyDown = this._onKeyDown.bind(this);
    }

    activate() {
        this.active = true;
        this.vexel.container.addEventListener('mousedown', this._boundHandlers.onPointerDown);
        window.addEventListener('mousemove', this._boundHandlers.onPointerMove);
        window.addEventListener('mouseup', this._boundHandlers.onPointerUp);
        window.addEventListener('keydown', this._boundHandlers.onKeyDown);
        this.vexel.container.style.cursor = 'crosshair';
    }

    deactivate() {
        this.active = false;
        this._finishPath();
        this.vexel.container.removeEventListener('mousedown', this._boundHandlers.onPointerDown);
        window.removeEventListener('mousemove', this._boundHandlers.onPointerMove);
        window.removeEventListener('mouseup', this._boundHandlers.onPointerUp);
        window.removeEventListener('keydown', this._boundHandlers.onKeyDown);
        this.vexel.container.style.cursor = '';
    }

    _getCanvasPoint(e) {
        const rect = this.vexel.container.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.vexel.viewport.x) / this.vexel.viewport.zoom,
            y: (e.clientY - rect.top - this.vexel.viewport.y) / this.vexel.viewport.zoom
        };
    }

    _onPointerDown(e) {
        if (!this.active || e.button !== 0) return;

        const point = this._getCanvasPoint(e);

        if (this.drawing) {
            this.points.push(point);
            this._updatePreview();
        } else {
            this.drawing = true;
            this.points = [point];
            this._createPreview();
        }
    }

    _onPointerMove(e) {
        if (!this.active || !this.drawing) return;

        const point = this._getCanvasPoint(e);

        if (this.previewPath) {
            this.previewPath.points = [...this.points, point];
            this.vexel.dirty = true;
        }
    }

    _onPointerUp(e) {
        if (e.button === 2) {
            this._finishPath();
            return;
        }
    }

    _onKeyDown(e) {
        if (!this.active) return;

        switch (e.key) {
            case 'Enter':
            case 'Escape':
                this._finishPath();
                break;
            case 'z':
                if (e.ctrlKey || e.metaKey) {
                    if (this.points.length > 1) {
                        this.points.pop();
                        this._updatePreview();
                    }
                }
                break;
            case 'Delete':
            case 'Backspace':
                if (this.points.length > 1) {
                    this.points.pop();
                    this._updatePreview();
                }
                break;
        }
    }

    _createPreview() {
        if (this.previewPath) {
            this.vexel.shapes = this.vexel.shapes.filter(s => s !== this.previewPath);
        }

        this.previewPath = new VexelPath([...this.points], {
            stroke: this.strokeColor,
            strokeWidth: this.strokeWidth,
            fill: this.fillColor,
            opacity: 0.5,
            closed: false
        });

        this.vexel.shapes.push(this.previewPath);
        this.vexel.dirty = true;
    }

    _updatePreview() {
        if (!this.previewPath) {
            this._createPreview();
            return;
        }

        let displayPoints = [...this.points];

        if (this.smooth && displayPoints.length >= 3) {
            displayPoints = VexelBezier.smoothPoints(displayPoints, 2);
        }

        this.previewPath.points = displayPoints;
        this.vexel.dirty = true;
    }

    _finishPath() {
        if (!this.drawing || this.points.length < this.minPoints) {
            this._cancelPath();
            return;
        }

        if (this.previewPath) {
            this.vexel.shapes = this.vexel.shapes.filter(s => s !== this.previewPath);
        }

        let finalPoints = [...this.points];

        if (this.smooth && finalPoints.length >= 3) {
            finalPoints = VexelBezier.smoothPoints(finalPoints, 2);
        }

        const path = new VexelPath(finalPoints, {
            stroke: this.strokeColor,
            strokeWidth: this.strokeWidth,
            fill: this.fillColor,
            opacity: this.opacity,
            closed: this.closePath
        });

        this.vexel.shapes.push(path);
        this.vexel.dirty = true;

        this.points = [];
        this.previewPath = null;
        this.drawing = false;
    }

    _cancelPath() {
        if (this.previewPath) {
            this.vexel.shapes = this.vexel.shapes.filter(s => s !== this.previewPath);
        }

        this.points = [];
        this.previewPath = null;
        this.drawing = false;
        this.vexel.dirty = true;
    }

    setMode(mode) {
        this.mode = mode;
    }

    setTension(tension) {
        this.tension = Math.max(0, Math.min(1, tension));
    }

    setSmooth(enabled) {
        this.smooth = enabled;
    }

    setStrokeColor(color) {
        this.strokeColor = color;
    }

    setStrokeWidth(width) {
        this.strokeWidth = Math.max(0.5, width);
    }

    setFillColor(color) {
        this.fillColor = color;
    }

    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, opacity));
    }

    setClosePath(close) {
        this.closePath = close;
    }
}

class VexelPencilTool {
    constructor(vexel) {
        this.vexel = vexel;
        this.active = false;
        this.drawing = false;
        this.points = [];
        this.currentPath = null;
        this.strokeColor = '#000000';
        this.strokeWidth = 2;
        this.opacity = 1;
        this.smooth = true;
        this.smoothLevel = 2;
        this.minDistance = 2;
        this.lastPoint = null;
        this._boundHandlers = {};
        this._setupHandlers();
    }

    _setupHandlers() {
        this._boundHandlers.onPointerDown = this._onPointerDown.bind(this);
        this._boundHandlers.onPointerMove = this._onPointerMove.bind(this);
        this._boundHandlers.onPointerUp = this._onPointerUp.bind(this);
    }

    _getCanvasPoint(e) {
        const rect = this.vexel.container.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.vexel.viewport.x) / this.vexel.viewport.zoom,
            y: (e.clientY - rect.top - this.vexel.viewport.y) / this.vexel.viewport.zoom
        };
    }

    activate() {
        this.active = true;
        this.vexel.container.addEventListener('mousedown', this._boundHandlers.onPointerDown);
        window.addEventListener('mousemove', this._boundHandlers.onPointerMove);
        window.addEventListener('mouseup', this._boundHandlers.onPointerUp);
        this.vexel.container.style.cursor = 'crosshair';
    }

    deactivate() {
        this.active = false;
        this._finishStroke();
        this.vexel.container.removeEventListener('mousedown', this._boundHandlers.onPointerDown);
        window.removeEventListener('mousemove', this._boundHandlers.onPointerMove);
        window.removeEventListener('mouseup', this._boundHandlers.onPointerUp);
        this.vexel.container.style.cursor = '';
    }

    _onPointerDown(e) {
        if (!this.active || e.button !== 0) return;
        this.drawing = true;
        this.points = [this._getCanvasPoint(e)];
        this.lastPoint = this.points[0];
        this._createPreview();
    }

    _onPointerMove(e) {
        if (!this.active || !this.drawing) return;

        const point = this._getCanvasPoint(e);
        const dist = Math.hypot(point.x - this.lastPoint.x, point.y - this.lastPoint.y);

        if (dist >= this.minDistance) {
            this.points.push(point);
            this.lastPoint = point;
            this._updatePreview();
        }
    }

    _onPointerUp() {
        if (!this.drawing) return;
        this._finishStroke();
    }

    _createPreview() {
        if (this.currentPath) {
            this.vexel.shapes = this.vexel.shapes.filter(s => s !== this.currentPath);
        }

        this.currentPath = new VexelPath([...this.points], {
            stroke: this.strokeColor,
            strokeWidth: this.strokeWidth,
            opacity: 0.5,
            closed: false
        });

        this.vexel.shapes.push(this.currentPath);
        this.vexel.dirty = true;
    }

    _updatePreview() {
        if (!this.currentPath) {
            this._createPreview();
            return;
        }

        let displayPoints = [...this.points];

        if (this.smooth && displayPoints.length >= 3) {
            displayPoints = VexelBezier.smoothPoints(displayPoints, this.smoothLevel);
        }

        this.currentPath.points = displayPoints;
        this.vexel.dirty = true;
    }

    _finishStroke() {
        if (!this.drawing || this.points.length < 2) {
            this._cancelStroke();
            return;
        }

        if (this.currentPath) {
            this.vexel.shapes = this.vexel.shapes.filter(s => s !== this.currentPath);
        }

        let finalPoints = [...this.points];

        if (this.smooth && finalPoints.length >= 3) {
            finalPoints = VexelBezier.smoothPoints(finalPoints, this.smoothLevel);
        }

        const path = new VexelPath(finalPoints, {
            stroke: this.strokeColor,
            strokeWidth: this.strokeWidth,
            opacity: this.opacity,
            closed: false
        });

        this.vexel.shapes.push(path);
        this.vexel.dirty = true;

        this.points = [];
        this.currentPath = null;
        this.drawing = false;
        this.lastPoint = null;
    }

    _cancelStroke() {
        if (this.currentPath) {
            this.vexel.shapes = this.vexel.shapes.filter(s => s !== this.currentPath);
        }
        this.points = [];
        this.currentPath = null;
        this.drawing = false;
        this.lastPoint = null;
        this.vexel.dirty = true;
    }
}

class VexelBrushTool {
    constructor(vexel) {
        this.vexel = vexel;
        this.active = false;
        this.drawing = false;
        this.points = [];
        this.currentPath = null;
        this.strokeColor = '#000000';
        this.baseWidth = 4;
        this.maxWidth = 20;
        this.minWidth = 1;
        this.opacity = 0.8;
        this.pressureSensitive = true;
        this.taper = true;
        this.smooth = true;
        this.lastPoint = null;
        this.lastWidth = 0;
        this._boundHandlers = {};
        this._setupHandlers();
    }

    _setupHandlers() {
        this._boundHandlers.onPointerDown = this._onPointerDown.bind(this);
        this._boundHandlers.onPointerMove = this._onPointerMove.bind(this);
        this._boundHandlers.onPointerUp = this._onPointerUp.bind(this);
    }

    _getCanvasPoint(e) {
        const rect = this.vexel.container.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.vexel.viewport.x) / this.vexel.viewport.zoom,
            y: (e.clientY - rect.top - this.vexel.viewport.y) / this.vexel.viewport.zoom,
            pressure: e.pressure || 0.5
        };
    }

    activate() {
        this.active = true;
        this.vexel.container.addEventListener('mousedown', this._boundHandlers.onPointerDown);
        window.addEventListener('mousemove', this._boundHandlers.onPointerMove);
        window.addEventListener('mouseup', this._boundHandlers.onPointerUp);
        this.vexel.container.style.cursor = 'crosshair';
    }

    deactivate() {
        this.active = false;
        this._finishStroke();
        this.vexel.container.removeEventListener('mousedown', this._boundHandlers.onPointerDown);
        window.removeEventListener('mousemove', this._boundHandlers.onPointerMove);
        window.removeEventListener('mouseup', this._boundHandlers.onPointerUp);
        this.vexel.container.style.cursor = '';
    }

    _onPointerDown(e) {
        if (!this.active || e.button !== 0) return;
        this.drawing = true;
        const point = this._getCanvasPoint(e);
        const width = this._calculateWidth(point.pressure, 0);
        this.points = [{ ...point, width }];
        this.lastPoint = this.points[0];
        this.lastWidth = width;
    }

    _onPointerMove(e) {
        if (!this.active || !this.drawing) return;
        const point = this._getCanvasPoint(e);
        const dist = Math.hypot(point.x - this.lastPoint.x, point.y - this.lastPoint.y);

        if (dist >= 1) {
            const width = this._calculateWidth(point.pressure, dist);
            this.points.push({ ...point, width });
            this.lastPoint = { ...point, width };
            this.lastWidth = width;
            this._renderStroke();
        }
    }

    _onPointerUp() {
        if (!this.drawing) return;
        this._finishStroke();
    }

    _calculateWidth(pressure, speed) {
        let width = this.baseWidth;

        if (this.pressureSensitive) {
            width = this.minWidth + (this.maxWidth - this.minWidth) * pressure;
        }

        if (this.taper && speed > 0) {
            const speedFactor = Math.min(1, speed / 50);
            width = width * (1 - speedFactor * 0.5);
        }

        return width;
    }

    _renderStroke() {
        if (this.points.length < 2) return;

        this.vexel.renderer.clear();
        this.vexel.renderer.renderAll();

        const ctx = this.vexel.ctx;
        ctx.save();
        ctx.translate(this.vexel.viewport.x, this.vexel.viewport.y);
        ctx.scale(this.vexel.viewport.zoom, this.vexel.viewport.zoom);

        ctx.strokeStyle = this.strokeColor;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = this.opacity;

        for (let i = 1; i < this.points.length; i++) {
            const p0 = this.points[i - 1];
            const p1 = this.points[i];

            ctx.lineWidth = (p0.width + p1.width) / 2;

            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
        }

        ctx.restore();
    }

    _finishStroke() {
        if (!this.drawing || this.points.length < 2) {
            this._cancelStroke();
            return;
        }

        let finalPoints = this.points.map(p => ({ x: p.x, y: p.y }));

        if (this.smooth && finalPoints.length >= 3) {
            finalPoints = VexelBezier.smoothPoints(finalPoints, 2);
        }

        const path = new VexelPath(finalPoints, {
            stroke: this.strokeColor,
            strokeWidth: this.baseWidth,
            opacity: this.opacity,
            closed: false
        });

        this.vexel.shapes.push(path);
        this.vexel.dirty = true;

        this.points = [];
        this.drawing = false;
        this.lastPoint = null;
    }

    _cancelStroke() {
        this.points = [];
        this.drawing = false;
        this.lastPoint = null;
        this.vexel.dirty = true;
    }
}

if (typeof window !== 'undefined') {
    window.VexelPenTool = VexelPenTool;
    window.VexelPencilTool = VexelPencilTool;
    window.VexelBrushTool = VexelBrushTool;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VexelPenTool, VexelPencilTool, VexelBrushTool };
}
// src/tools/select.js

class VexelSelectTool {
    constructor(vexel) {
        this.vexel = vexel;
        this.active = false;
        this.dragging = false;
        this.resizing = false;
        this.rotating = false;
        this.marquee = false;
        this.marqueeStart = null;
        this.marqueeEnd = null;
        this.dragStart = null;
        this.dragOffset = { x: 0, y: 0 };
        this.resizeHandle = null;
        this.resizeStartBounds = null;
        this.resizeStartPoint = null;
        this.rotateStart = null;
        this.rotateCenter = null;
        this.rotateStartAngle = 0;
        this.rotateStartRotation = 0;
        this.handleSize = 8;
        this.handles = [];
        this.hoveredHandle = null;
        this.hitTolerance = 5;
    }

    activate() {
        this.active = true;
        this._bindEvents();
    }

    deactivate() {
        this.active = false;
        this._unbindEvents();
        this.vexel.deselectAll();
    }

    _bindEvents() {
        this._onMouseDown = this._handleMouseDown.bind(this);
        this._onMouseMove = this._handleMouseMove.bind(this);
        this._onMouseUp = this._handleMouseUp.bind(this);
        this._onKeyDown = this._handleKeyDown.bind(this);

        this.vexel.container.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mouseup', this._onMouseUp);
        window.addEventListener('keydown', this._onKeyDown);
    }

    _unbindEvents() {
        this.vexel.container.removeEventListener('mousedown', this._onMouseDown);
        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('mouseup', this._onMouseUp);
        window.removeEventListener('keydown', this._onKeyDown);
    }

    _getCanvasPoint(e) {
        const rect = this.vexel.container.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.vexel.viewport.x) / this.vexel.viewport.zoom,
            y: (e.clientY - rect.top - this.vexel.viewport.y) / this.vexel.viewport.zoom
        };
    }

    _handleMouseDown(e) {
        if (!this.active || e.button !== 0) return;

        const point = this._getCanvasPoint(e);

        if (e.shiftKey) {
            this.marquee = true;
            this.marqueeStart = point;
            this.marqueeEnd = point;
            return;
        }

        if (this.hoveredHandle && this.vexel.selectedShapes.length === 1) {
            this._startResize(this.hoveredHandle, point);
            return;
        }

        if (this.vexel.selectedShapes.length === 1 && this._isNearRotationHandle(point)) {
            this._startRotate(point);
            return;
        }

        const hitShape = this._hitTest(point);

        if (hitShape) {
            if (!this.vexel.selectedShapes.includes(hitShape)) {
                if (!e.metaKey && !e.ctrlKey) {
                    this.vexel.deselectAll();
                }
                this.vexel.select(hitShape);
            }
            this._startDrag(point);
        } else {
            if (!e.metaKey && !e.ctrlKey) {
                this.vexel.deselectAll();
            }
            this.marquee = true;
            this.marqueeStart = point;
            this.marqueeEnd = point;
        }
    }

    _handleMouseMove(e) {
        const point = this._getCanvasPoint(e);

        if (this.dragging) {
            const dx = point.x - this.dragStart.x;
            const dy = point.y - this.dragStart.y;

            for (const shape of this.vexel.selectedShapes) {
                if (!shape.locked) {
                    shape.x = this.dragOffset[shape.id].x + dx;
                    shape.y = this.dragOffset[shape.id].y + dy;

                    if (this.vexel.snapEnabled) {
                        shape.x = Math.round(shape.x / this.vexel.snapSize) * this.vexel.snapSize;
                        shape.y = Math.round(shape.y / this.vexel.snapSize) * this.vexel.snapSize;
                    }
                }
            }
            this.vexel.dirty = true;
            return;
        }

        if (this.resizing && this.vexel.selectedShapes.length === 1) {
            this._updateResize(point);
            return;
        }

        if (this.rotating && this.vexel.selectedShapes.length === 1) {
            this._updateRotate(point);
            return;
        }

        if (this.marquee) {
            this.marqueeEnd = point;
            this.vexel.dirty = true;
            return;
        }

        this._updateHoveredHandle(point);
        this._updateCursor(point);
    }

    _handleMouseUp(e) {
        if (this.marquee) {
            this._finishMarquee();
            this.marquee = false;
            this.marqueeStart = null;
            this.marqueeEnd = null;
        }

        if (this.dragging) {
            this._finishDrag();
        }

        if (this.resizing) {
            this._finishResize();
        }

        if (this.rotating) {
            this._finishRotate();
        }

        this.dragging = false;
        this.resizing = false;
        this.rotating = false;
        this.dragStart = null;
        this.resizeHandle = null;
        this.rotateStart = null;
    }

    _handleKeyDown(e) {
        if (!this.active) return;

        const step = e.shiftKey ? 10 : 1;

        switch (e.key) {
            case 'Delete':
            case 'Backspace':
                this.vexel.deleteSelected();
                break;
            case 'Escape':
                this.vexel.deselectAll();
                break;
            case 'a':
                if (e.metaKey || e.ctrlKey) {
                    e.preventDefault();
                    this.vexel.selectAll();
                }
                break;
            case 'ArrowLeft':
                this._nudge(-step, 0);
                break;
            case 'ArrowRight':
                this._nudge(step, 0);
                break;
            case 'ArrowUp':
                this._nudge(0, -step);
                break;
            case 'ArrowDown':
                this._nudge(0, step);
                break;
            case 'd':
                if (e.metaKey || e.ctrlKey) {
                    e.preventDefault();
                    this._duplicate();
                }
                break;
        }
    }

    _nudge(dx, dy) {
        for (const shape of this.vexel.selectedShapes) {
            if (!shape.locked) {
                shape.x += dx;
                shape.y += dy;
            }
        }
        this.vexel.dirty = true;
    }

    _duplicate() {
        const newShapes = [];
        for (const shape of this.vexel.selectedShapes) {
            const cloned = shape.clone();
            cloned.x += 20;
            cloned.y += 20;
            cloned.id = cloned._generateId();
            this.vexel.shapes.push(cloned);
            newShapes.push(cloned);
        }
        this.vexel.deselectAll();
        for (const shape of newShapes) {
            this.vexel.select(shape);
        }
        this.vexel.dirty = true;
    }

    _hitTest(point) {
        for (let i = this.vexel.shapes.length - 1; i >= 0; i--) {
            const shape = this.vexel.shapes[i];
            if (shape.visible !== false && !shape.locked && shape.containsPoint(point.x, point.y)) {
                return shape;
            }
        }
        return null;
    }

    _startDrag(point) {
        this.dragging = true;
        this.dragStart = point;
        this.dragOffset = {};

        for (const shape of this.vexel.selectedShapes) {
            this.dragOffset[shape.id] = { x: shape.x, y: shape.y };
        }
    }

    _finishDrag() {
        this.dragging = false;
        this.dragStart = null;
        this.dragOffset = {};
    }

    _startResize(handle, point) {
        const shape = this.vexel.selectedShapes[0];
        this.resizing = true;
        this.resizeHandle = handle;
        this.resizeStartBounds = shape.getBounds();
        this.resizeStartPoint = point;
    }

    _updateResize(point) {
        const shape = this.vexel.selectedShapes[0];
        const bounds = this.resizeStartBounds;
        const dx = point.x - this.resizeStartPoint.x;
        const dy = point.y - this.resizeStartPoint.y;

        switch (this.resizeHandle) {
            case 'nw':
                shape.x = bounds.x + dx;
                shape.y = bounds.y + dy;
                shape.width = bounds.width - dx;
                shape.height = bounds.height - dy;
                break;
            case 'ne':
                shape.y = bounds.y + dy;
                shape.width = bounds.width + dx;
                shape.height = bounds.height - dy;
                break;
            case 'sw':
                shape.x = bounds.x + dx;
                shape.width = bounds.width - dx;
                shape.height = bounds.height + dy;
                break;
            case 'se':
                shape.width = bounds.width + dx;
                shape.height = bounds.height + dy;
                break;
            case 'n':
                shape.y = bounds.y + dy;
                shape.height = bounds.height - dy;
                break;
            case 's':
                shape.height = bounds.height + dy;
                break;
            case 'w':
                shape.x = bounds.x + dx;
                shape.width = bounds.width - dx;
                break;
            case 'e':
                shape.width = bounds.width + dx;
                break;
        }

        if (shape.width < 1) shape.width = 1;
        if (shape.height < 1) shape.height = 1;

        this.vexel.dirty = true;
    }

    _finishResize() {
        this.resizing = false;
        this.resizeHandle = null;
        this.resizeStartBounds = null;
        this.resizeStartPoint = null;
    }

    _startRotate(point) {
        const shape = this.vexel.selectedShapes[0];
        const bounds = shape.getBounds();
        this.rotating = true;
        this.rotateCenter = {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2
        };
        this.rotateStart = point;
        this.rotateStartAngle = Math.atan2(
            point.y - this.rotateCenter.y,
            point.x - this.rotateCenter.x
        );
        this.rotateStartRotation = shape.rotation;
    }

    _updateRotate(point) {
        const shape = this.vexel.selectedShapes[0];
        const angle = Math.atan2(
            point.y - this.rotateCenter.y,
            point.x - this.rotateCenter.x
        );
        let rotation = (angle - this.rotateStartAngle) * (180 / Math.PI);
        rotation = this.rotateStartRotation + rotation;

        if (this.vexel.snapEnabled) {
            rotation = Math.round(rotation / 15) * 15;
        }

        shape.rotation = rotation % 360;
        this.vexel.dirty = true;
    }

    _finishRotate() {
        this.rotating = false;
        this.rotateStart = null;
        this.rotateCenter = null;
    }

    _isNearRotationHandle(point) {
        if (this.vexel.selectedShapes.length !== 1) return false;
        const shape = this.vexel.selectedShapes[0];
        const bounds = shape.getBounds();
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y - 30;
        const dist = Math.sqrt((point.x - cx) ** 2 + (point.y - cy) ** 2);
        return dist < 15;
    }

    _updateHoveredHandle(point) {
        if (this.vexel.selectedShapes.length !== 1) {
            this.hoveredHandle = null;
            return;
        }

        const shape = this.vexel.selectedShapes[0];
        const bounds = shape.getBounds();
        const handles = {
            nw: { x: bounds.x, y: bounds.y },
            ne: { x: bounds.x + bounds.width, y: bounds.y },
            sw: { x: bounds.x, y: bounds.y + bounds.height },
            se: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
            n: { x: bounds.x + bounds.width / 2, y: bounds.y },
            s: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
            w: { x: bounds.x, y: bounds.y + bounds.height / 2 },
            e: { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }
        };

        this.hoveredHandle = null;
        for (const [key, pos] of Object.entries(handles)) {
            const dist = Math.sqrt((point.x - pos.x) ** 2 + (point.y - pos.y) ** 2);
            if (dist < this.handleSize + this.hitTolerance) {
                this.hoveredHandle = key;
                return;
            }
        }
    }

    _updateCursor(point) {
        if (this.hoveredHandle) {
            const cursors = {
                nw: 'nwse-resize',
                se: 'nwse-resize',
                ne: 'nesw-resize',
                sw: 'nesw-resize',
                n: 'ns-resize',
                s: 'ns-resize',
                w: 'ew-resize',
                e: 'ew-resize'
            };
            this.vexel.container.style.cursor = cursors[this.hoveredHandle] || 'default';
            return;
        }

        if (this.vexel.selectedShapes.length === 1 && this._isNearRotationHandle(point)) {
            this.vexel.container.style.cursor = 'grab';
            return;
        }

        const hitShape = this._hitTest(point);
        this.vexel.container.style.cursor = hitShape ? 'move' : 'default';
    }

    _finishMarquee() {
        if (!this.marqueeStart || !this.marqueeEnd) return;

        const x1 = Math.min(this.marqueeStart.x, this.marqueeEnd.x);
        const y1 = Math.min(this.marqueeStart.y, this.marqueeEnd.y);
        const x2 = Math.max(this.marqueeStart.x, this.marqueeEnd.x);
        const y2 = Math.max(this.marqueeStart.y, this.marqueeEnd.y);

        const selected = [];
        for (const shape of this.vexel.shapes) {
            if (shape.visible !== false && !shape.locked) {
                const bounds = shape.getBounds();
                if (
                    bounds.x + bounds.width >= x1 &&
                    bounds.x <= x2 &&
                    bounds.y + bounds.height >= y1 &&
                    bounds.y <= y2
                ) {
                    selected.push(shape);
                }
            }
        }

        this.vexel.deselectAll();
        for (const shape of selected) {
            this.vexel.select(shape);
        }
    }

    drawMarquee(ctx) {
        if (!this.marquee || !this.marqueeStart || !this.marqueeEnd) return;

        const x = Math.min(this.marqueeStart.x, this.marqueeEnd.x);
        const y = Math.min(this.marqueeStart.y, this.marqueeEnd.y);
        const w = Math.abs(this.marqueeEnd.x - this.marqueeStart.x);
        const h = Math.abs(this.marqueeEnd.y - this.marqueeStart.y);

        ctx.save();
        ctx.translate(this.vexel.viewport.x, this.vexel.viewport.y);
        ctx.scale(this.vexel.viewport.zoom, this.vexel.viewport.zoom);

        ctx.fillStyle = 'rgba(74, 144, 217, 0.1)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#4A90D9';
        ctx.lineWidth = 1 / this.vexel.viewport.zoom;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);

        ctx.restore();
    }

    drawRotationHandle(ctx) {
        if (this.vexel.selectedShapes.length !== 1) return;

        const shape = this.vexel.selectedShapes[0];
        const bounds = shape.getBounds();
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y - 30;

        ctx.save();
        ctx.translate(this.vexel.viewport.x, this.vexel.viewport.y);
        ctx.scale(this.vexel.viewport.zoom, this.vexel.viewport.zoom);

        ctx.strokeStyle = '#4A90D9';
        ctx.lineWidth = 1.5 / this.vexel.viewport.zoom;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(bounds.x + bounds.width / 2, bounds.y);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#4A90D9';
        ctx.lineWidth = 1.5 / this.vexel.viewport.zoom;
        ctx.beginPath();
        ctx.arc(cx, cy, 6 / this.vexel.viewport.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#4A90D9';
        ctx.beginPath();
        ctx.arc(cx, cy, 2 / this.vexel.viewport.zoom, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

if (typeof window !== 'undefined') {
    window.VexelSelectTool = VexelSelectTool;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelSelectTool;
}
// src/core/viewport.js

class VexelViewport {
    constructor(vexel) {
        this.vexel = vexel;
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
        this.rotation = 0;
        this.minZoom = 0.001;
        this.maxZoom = 100;
        this.zoomSensitivity = 0.001;
        this.scrollSensitivity = 1;
        this.homeX = 0;
        this.homeY = 0;
        this.homeZoom = 1;
        this.homeRotation = 0;
        this.smoothZoom = true;
        this.smoothPan = true;
        this.targetX = 0;
        this.targetY = 0;
        this.targetZoom = 1;
        this.targetRotation = 0;
        this.animating = false;
        this.animationSpeed = 0.2;
        this.animationId = null;
        this.constraints = null;
        this.padding = { top: 0, right: 0, bottom: 0, left: 0 };
    }

    pan(dx, dy) {
        this.targetX += dx;
        this.targetY += dy;

        if (this.smoothPan) {
            this._startSmoothAnimation();
        } else {
            this.x = this.targetX;
            this.y = this.targetY;
            this._syncToVexel();
        }
    }

    panTo(x, y) {
        this.targetX = x;
        this.targetY = y;

        if (this.smoothPan) {
            this._startSmoothAnimation();
        } else {
            this.x = x;
            this.y = y;
            this._syncToVexel();
        }
    }

    zoomAt(factor, cx, cy) {
        const oldZoom = this.targetZoom;
        this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.targetZoom * factor));

        if (cx !== undefined && cy !== undefined) {
            this.targetX = cx - (cx - this.targetX) * (this.targetZoom / oldZoom);
            this.targetY = cy - (cy - this.targetY) * (this.targetZoom / oldZoom);
        }

        if (this.smoothZoom) {
            this._startSmoothAnimation();
        } else {
            this.zoom = this.targetZoom;
            this.x = this.targetX;
            this.y = this.targetY;
            this._syncToVexel();
        }
    }

    zoomIn(factor = 1.2) {
        const cx = this.vexel.width / 2;
        const cy = this.vexel.height / 2;
        this.zoomAt(factor, cx, cy);
    }

    zoomOut(factor = 0.8) {
        this.zoomIn(factor);
    }

    zoomToFit(shapes, padding = 50) {
        if (!shapes || shapes.length === 0) {
            this.reset();
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const shape of shapes) {
            const b = shape.getBounds();
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
        }

        const contentWidth = maxX - minX + padding * 2;
        const contentHeight = maxY - minY + padding * 2;
        const zoomX = (this.vexel.width - this.padding.left - this.padding.right) / contentWidth;
        const zoomY = (this.vexel.height - this.padding.top - this.padding.bottom) / contentHeight;
        const zoom = Math.min(zoomX, zoomY, 1);

        this.targetZoom = zoom;
        this.targetX = (this.vexel.width - contentWidth * zoom) / 2 - minX * zoom + padding * zoom + this.padding.left;
        this.targetY = (this.vexel.height - contentHeight * zoom) / 2 - minY * zoom + padding * zoom + this.padding.top;

        if (this.smoothZoom || this.smoothPan) {
            this._startSmoothAnimation();
        } else {
            this.zoom = this.targetZoom;
            this.x = this.targetX;
            this.y = this.targetY;
            this._syncToVexel();
        }
    }

    zoomToSelection() {
        if (this.vexel.selectedShapes.length > 0) {
            this.zoomToFit(this.vexel.selectedShapes, 30);
        }
    }

    zoomToPercent(percent) {
        this.targetZoom = percent / 100;
        this.targetX = (this.vexel.width - this.vexel.width * this.targetZoom) / 2;
        this.targetY = (this.vexel.height - this.vexel.height * this.targetZoom) / 2;

        if (this.smoothZoom || this.smoothPan) {
            this._startSmoothAnimation();
        } else {
            this.zoom = this.targetZoom;
            this.x = this.targetX;
            this.y = this.targetY;
            this._syncToVexel();
        }
    }

    rotate(angle) {
        this.targetRotation = (this.targetRotation + angle) % 360;
        this.rotation = this.targetRotation;
        this._syncToVexel();
    }

    rotateTo(angle) {
        this.targetRotation = angle % 360;
        this.rotation = this.targetRotation;
        this._syncToVexel();
    }

    reset() {
        this.targetX = this.homeX;
        this.targetY = this.homeY;
        this.targetZoom = this.homeZoom;
        this.targetRotation = this.homeRotation;

        if (this.smoothZoom || this.smoothPan) {
            this._startSmoothAnimation();
        } else {
            this.x = this.homeX;
            this.y = this.homeY;
            this.zoom = this.homeZoom;
            this.rotation = this.homeRotation;
            this._syncToVexel();
        }
    }

    setHome() {
        this.homeX = this.x;
        this.homeY = this.y;
        this.homeZoom = this.zoom;
        this.homeRotation = this.rotation;
    }

    goHome() {
        this.reset();
    }

    setConstraints(bounds) {
        this.constraints = bounds;
    }

    clearConstraints() {
        this.constraints = null;
    }

    _applyConstraints() {
        if (!this.constraints) return;

        const visibleWidth = this.vexel.width / this.targetZoom;
        const visibleHeight = this.vexel.height / this.targetZoom;

        if (visibleWidth < this.constraints.width) {
            const minX = this.constraints.x;
            const maxX = this.constraints.x + this.constraints.width - visibleWidth;
            this.targetX = Math.max(minX, Math.min(maxX, this.targetX));
        } else {
            this.targetX = this.constraints.x + (this.constraints.width - visibleWidth) / 2;
        }

        if (visibleHeight < this.constraints.height) {
            const minY = this.constraints.y;
            const maxY = this.constraints.y + this.constraints.height - visibleHeight;
            this.targetY = Math.max(minY, Math.min(maxY, this.targetY));
        } else {
            this.targetY = this.constraints.y + (this.constraints.height - visibleHeight) / 2;
        }
    }

    _startSmoothAnimation() {
        if (this.animating) return;
        this.animating = true;
        this._animateStep();
    }

    _animateStep() {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dz = this.targetZoom - this.zoom;

        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01 && Math.abs(dz) < 0.0001) {
            this.x = this.targetX;
            this.y = this.targetY;
            this.zoom = this.targetZoom;
            this.animating = false;
            this._syncToVexel();
            return;
        }

        this.x += dx * this.animationSpeed;
        this.y += dy * this.animationSpeed;
        this.zoom += dz * this.animationSpeed;

        this._applyConstraints();
        this._syncToVexel();

        this.animationId = requestAnimationFrame(() => this._animateStep());
    }

    _syncToVexel() {
        this.vexel.viewport.x = this.x;
        this.vexel.viewport.y = this.y;
        this.vexel.viewport.zoom = this.zoom;
        this.vexel.viewport.rotation = this.rotation;
        this.vexel.dirty = true;
    }

    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.x) / this.zoom,
            y: (screenY - this.y) / this.zoom
        };
    }

    worldToScreen(worldX, worldY) {
        return {
            x: worldX * this.zoom + this.x,
            y: worldY * this.zoom + this.y
        };
    }

    getVisibleBounds() {
        return {
            x: -this.x / this.zoom,
            y: -this.y / this.zoom,
            width: this.vexel.width / this.zoom,
            height: this.vexel.height / this.zoom
        };
    }

    isShapeVisible(shape) {
        const bounds = this.getVisibleBounds();
        const shapeBounds = shape.getBounds();
        const margin = 50;

        return !(
            shapeBounds.x + shapeBounds.width < bounds.x - margin ||
            shapeBounds.x > bounds.x + bounds.width + margin ||
            shapeBounds.y + shapeBounds.height < bounds.y - margin ||
            shapeBounds.y > bounds.y + bounds.height + margin
        );
    }

    getVisibleShapes(shapes) {
        return shapes ? shapes.filter(s => this.isShapeVisible(s)) : [];
    }

    setPadding(top, right, bottom, left) {
        this.padding = { top, right, bottom, left };
    }

    setZoomLimits(min, max) {
        this.minZoom = min;
        this.maxZoom = max;
        this.targetZoom = Math.max(min, Math.min(max, this.targetZoom));
    }

    getZoomPercent() {
        return Math.round(this.zoom * 100);
    }

    getCenter() {
        return {
            x: (this.vexel.width / 2 - this.x) / this.zoom,
            y: (this.vexel.height / 2 - this.y) / this.zoom
        };
    }

    centerOn(x, y) {
        this.targetX = this.vexel.width / 2 - x * this.targetZoom;
        this.targetY = this.vexel.height / 2 - y * this.targetZoom;

        if (this.smoothPan) {
            this._startSmoothAnimation();
        } else {
            this.x = this.targetX;
            this.y = this.targetY;
            this._syncToVexel();
        }
    }

    serialize() {
        return {
            x: this.x,
            y: this.y,
            zoom: this.zoom,
            rotation: this.rotation,
            homeX: this.homeX,
            homeY: this.homeY,
            homeZoom: this.homeZoom,
            homeRotation: this.homeRotation
        };
    }

    deserialize(data) {
        if (!data) return;
        this.x = data.x || 0;
        this.y = data.y || 0;
        this.zoom = data.zoom || 1;
        this.rotation = data.rotation || 0;
        this.homeX = data.homeX || 0;
        this.homeY = data.homeY || 0;
        this.homeZoom = data.homeZoom || 1;
        this.homeRotation = data.homeRotation || 0;
        this.targetX = this.x;
        this.targetY = this.y;
        this.targetZoom = this.zoom;
        this.targetRotation = this.rotation;
        this._syncToVexel();
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}

if (typeof window !== 'undefined') {
    window.VexelViewport = VexelViewport;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelViewport;
}
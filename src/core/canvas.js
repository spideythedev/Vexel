// src/core/canvas.js

class VexelCanvas {
    constructor(vexel) {
        this.vexel = vexel;
        this.width = vexel.width;
        this.height = vexel.height;
        this.zoom = 1;
        this.minZoom = 0.001;
        this.maxZoom = 100;
        this.panX = 0;
        this.panY = 0;
        this.rotation = 0;
        this.gridVisible = false;
        this.gridSize = 20;
        this.gridColor = 'rgba(128,128,128,0.15)';
        this.gridThickColor = 'rgba(128,128,128,0.3)';
        this.gridThickEvery = 5;
        this.snapEnabled = false;
        this.snapSize = 10;
        this.snapThreshold = 5;
        this.guidesVisible = false;
        this.guides = [];
        this.rulersVisible = false;
        this.rulerSize = 20;
        this.background = '#ffffff';
        this.overscroll = 500;
        this.bounceEnabled = true;
        this.bounceDamping = 0.3;
        this.inertiaEnabled = true;
        this.inertiaDamping = 0.95;
        this.velocityX = 0;
        this.velocityY = 0;
        this.lastPanX = 0;
        this.lastPanY = 0;
        this.animating = false;
        this.animationId = null;
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        this.vexel.resize(width, height);
    }

    setZoom(zoom, cx, cy) {
        const oldZoom = this.zoom;
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));

        if (cx !== undefined && cy !== undefined) {
            this.panX = cx - (cx - this.panX) * (this.zoom / oldZoom);
            this.panY = cy - (cy - this.panY) * (this.zoom / oldZoom);
        }

        this.vexel.viewport.zoom = this.zoom;
        this.vexel.viewport.x = this.panX;
        this.vexel.viewport.y = this.panY;
        this.vexel.dirty = true;
    }

    zoomIn(factor = 1.2, cx, cy) {
        if (!cx && !cy) {
            cx = this.width / 2;
            cy = this.height / 2;
        }
        this.setZoom(this.zoom * factor, cx, cy);
    }

    zoomOut(factor = 0.8, cx, cy) {
        this.zoomIn(factor, cx, cy);
    }

    zoomToFit(shapes, padding = 50) {
        if (!shapes || shapes.length === 0) {
            this.resetView();
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
        const zoomX = this.width / contentWidth;
        const zoomY = this.height / contentHeight;
        const zoom = Math.min(zoomX, zoomY, 1);

        this.zoom = zoom;
        this.panX = (this.width - contentWidth * zoom) / 2 - minX * zoom + padding * zoom;
        this.panY = (this.height - contentHeight * zoom) / 2 - minY * zoom + padding * zoom;

        this.vexel.viewport.zoom = this.zoom;
        this.vexel.viewport.x = this.panX;
        this.vexel.viewport.y = this.panY;
        this.vexel.dirty = true;
    }

    zoomToSelection() {
        if (this.vexel.selectedShapes.length > 0) {
            this.zoomToFit(this.vexel.selectedShapes, 30);
        }
    }

    resetView() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.rotation = 0;
        this.vexel.viewport.zoom = 1;
        this.vexel.viewport.x = 0;
        this.vexel.viewport.y = 0;
        this.vexel.viewport.rotation = 0;
        this.vexel.dirty = true;
    }

    pan(dx, dy) {
        this.panX += dx;
        this.panY += dy;

        if (this.bounceEnabled) {
            const overscrollX = this._calculateOverscrollX();
            const overscrollY = this._calculateOverscrollY();

            if (overscrollX !== 0) {
                this.panX -= overscrollX * this.bounceDamping;
            }
            if (overscrollY !== 0) {
                this.panY -= overscrollY * this.bounceDamping;
            }
        }

        this.vexel.viewport.x = this.panX;
        this.vexel.viewport.y = this.panY;
        this.vexel.dirty = true;
    }

    _calculateOverscrollX() {
        const visibleWidth = this.width / this.zoom;
        const contentLeft = -this.overscroll;
        const contentRight = visibleWidth + this.overscroll;
        const currentLeft = -this.panX / this.zoom;
        const currentRight = (this.width - this.panX) / this.zoom;

        if (currentLeft < contentLeft) return (currentLeft - contentLeft) * this.zoom;
        if (currentRight > contentRight) return (currentRight - contentRight) * this.zoom;
        return 0;
    }

    _calculateOverscrollY() {
        const visibleHeight = this.height / this.zoom;
        const contentTop = -this.overscroll;
        const contentBottom = visibleHeight + this.overscroll;
        const currentTop = -this.panY / this.zoom;
        const currentBottom = (this.height - this.panY) / this.zoom;

        if (currentTop < contentTop) return (currentTop - contentTop) * this.zoom;
        if (currentBottom > contentBottom) return (currentBottom - contentBottom) * this.zoom;
        return 0;
    }

    startInertia(vx, vy) {
        if (!this.inertiaEnabled) return;
        this.velocityX = vx;
        this.velocityY = vy;
        if (!this.animating) {
            this._animateInertia();
        }
    }

    _animateInertia() {
        this.animating = true;

        const step = () => {
            this.velocityX *= this.inertiaDamping;
            this.velocityY *= this.inertiaDamping;

            if (Math.abs(this.velocityX) < 0.01 && Math.abs(this.velocityY) < 0.01) {
                this.animating = false;
                this.velocityX = 0;
                this.velocityY = 0;
                return;
            }

            this.pan(this.velocityX, this.velocityY);
            this.animationId = requestAnimationFrame(step);
        };

        this.animationId = requestAnimationFrame(step);
    }

    stopInertia() {
        this.animating = false;
        this.velocityX = 0;
        this.velocityY = 0;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    screenToCanvas(screenX, screenY) {
        return {
            x: (screenX - this.panX) / this.zoom,
            y: (screenY - this.panY) / this.zoom
        };
    }

    canvasToScreen(canvasX, canvasY) {
        return {
            x: canvasX * this.zoom + this.panX,
            y: canvasY * this.zoom + this.panY
        };
    }

    setGrid(visible, size, color, thickColor, thickEvery) {
        this.gridVisible = visible;
        if (size !== undefined) this.gridSize = size;
        if (color !== undefined) this.gridColor = color;
        if (thickColor !== undefined) this.gridThickColor = thickColor;
        if (thickEvery !== undefined) this.gridThickEvery = thickEvery;
        this.vexel.gridEnabled = visible;
        this.vexel.snapSize = size || this.vexel.snapSize;
        this.vexel.dirty = true;
    }

    setSnap(enabled, size, threshold) {
        this.snapEnabled = enabled;
        if (size !== undefined) this.snapSize = size;
        if (threshold !== undefined) this.snapThreshold = threshold;
        this.vexel.snapEnabled = enabled;
        this.vexel.snapSize = size || this.vexel.snapSize;
    }

    snapPoint(x, y) {
        if (!this.snapEnabled) return { x, y };

        const snappedX = Math.round(x / this.snapSize) * this.snapSize;
        const snappedY = Math.round(y / this.snapSize) * this.snapSize;

        const distX = Math.abs(snappedX - x);
        const distY = Math.abs(snappedY - y);

        return {
            x: distX <= this.snapThreshold ? snappedX : x,
            y: distY <= this.snapThreshold ? snappedY : y
        };
    }

    addGuide(orientation, position, color = '#FF5722') {
        this.guides.push({
            orientation,
            position,
            color
        });
        this.guidesVisible = true;
        this.vexel.dirty = true;
        return this.guides.length - 1;
    }

    removeGuide(index) {
        if (index >= 0 && index < this.guides.length) {
            this.guides.splice(index, 1);
            this.vexel.dirty = true;
        }
    }

    clearGuides() {
        this.guides = [];
        this.vexel.dirty = true;
    }

    drawGuides(ctx) {
        if (!this.guidesVisible || this.guides.length === 0) return;

        ctx.save();
        ctx.translate(this.panX, this.panY);
        ctx.scale(this.zoom, this.zoom);

        for (const guide of this.guides) {
            ctx.strokeStyle = guide.color || '#FF5722';
            ctx.lineWidth = 1 / this.zoom;
            ctx.setLineDash([4, 4]);

            if (guide.orientation === 'horizontal') {
                ctx.beginPath();
                ctx.moveTo(-this.panX / this.zoom, guide.position);
                ctx.lineTo((this.width - this.panX) / this.zoom, guide.position);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.moveTo(guide.position, -this.panY / this.zoom);
                ctx.lineTo(guide.position, (this.height - this.panY) / this.zoom);
                ctx.stroke();
            }

            ctx.setLineDash([]);
        }

        ctx.restore();
    }

    drawRulers(ctx) {
        if (!this.rulersVisible) return;

        ctx.save();
        ctx.fillStyle = '#f5f5f4';
        ctx.fillRect(0, 0, this.width, this.rulerSize);
        ctx.fillRect(0, 0, this.rulerSize, this.height);

        ctx.strokeStyle = '#d6d3d1';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, this.width, this.rulerSize);
        ctx.strokeRect(0, 0, this.rulerSize, this.height);

        ctx.fillStyle = '#78716c';
        ctx.font = '9px -apple-system, sans-serif';

        const step = this.gridSize * this.zoom;
        const startX = this.panX % step;
        const startY = this.panY % step;

        for (let x = startX; x < this.width; x += step) {
            if (x < this.rulerSize) continue;
            const canvasX = (x - this.panX) / this.zoom;
            ctx.fillText(Math.round(canvasX / this.gridSize) * this.gridSize, x + 2, 12);
        }

        for (let y = startY; y < this.height; y += step) {
            if (y < this.rulerSize) continue;
            const canvasY = (y - this.panY) / this.zoom;
            ctx.save();
            ctx.translate(12, y + 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(Math.round(canvasY / this.gridSize) * this.gridSize, 0, 0);
            ctx.restore();
        }

        ctx.restore();
    }

    drawGrid(ctx) {
        if (!this.gridVisible) return;

        ctx.save();
        ctx.translate(this.panX, this.panY);
        ctx.scale(this.zoom, this.zoom);

        const gridSize = this.gridSize;
        const startX = Math.floor(-this.panX / this.zoom / gridSize) * gridSize;
        const startY = Math.floor(-this.panY / this.zoom / gridSize) * gridSize;
        const endX = Math.ceil((this.width - this.panX) / this.zoom / gridSize) * gridSize;
        const endY = Math.ceil((this.height - this.panY) / this.zoom / gridSize) * gridSize;

        ctx.strokeStyle = this.gridColor;
        ctx.lineWidth = 0.5;

        ctx.beginPath();
        for (let x = startX; x <= endX; x += gridSize) {
            if (x % (gridSize * this.gridThickEvery) === 0) continue;
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += gridSize) {
            if (y % (gridSize * this.gridThickEvery) === 0) continue;
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        ctx.stroke();

        ctx.strokeStyle = this.gridThickColor;
        ctx.lineWidth = 1;

        ctx.beginPath();
        for (let x = startX; x <= endX; x += gridSize * this.gridThickEvery) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += gridSize * this.gridThickEvery) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        ctx.stroke();

        ctx.restore();
    }

    getVisibleBounds() {
        return {
            x: -this.panX / this.zoom,
            y: -this.panY / this.zoom,
            width: this.width / this.zoom,
            height: this.height / this.zoom
        };
    }

    getVisibleShapes(shapes) {
        const bounds = this.getVisibleBounds();
        const padding = 100;

        return shapes.filter(shape => {
            const sb = shape.getBounds();
            return (
                sb.x + sb.width >= bounds.x - padding &&
                sb.x <= bounds.x + bounds.width + padding &&
                sb.y + sb.height >= bounds.y - padding &&
                sb.y <= bounds.y + bounds.height + padding
            );
        });
    }
}

if (typeof window !== 'undefined') {
    window.VexelCanvas = VexelCanvas;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelCanvas;
}
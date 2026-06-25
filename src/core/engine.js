// src/core/engine.js

class VexelRenderEngine {
    constructor(vexel) {
        this.vexel = vexel;
        this.backend = 'canvas2d';
        this.pixelRatio = window.devicePixelRatio || 1;
        this.antialias = true;
        this.fps = 0;
        this.frameCount = 0;
        this.lastFPSTime = performance.now();
        this.dirtyRegions = [];
        this.useDirtyRegions = false;
        this.maxDirtyRegions = 10;
    }

    setBackend(backend) {
        const backends = ['canvas2d', 'webgl', 'webgl2', 'offscreen', 'svg'];
        if (!backends.includes(backend)) {
            throw new Error(`Unsupported backend: ${backend}. Use: ${backends.join(', ')}`);
        }
        this.backend = backend;
        this.vexel.dirty = true;
    }

    render() {
        this.frameCount++;
        const now = performance.now();
        if (now - this.lastFPSTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFPSTime = now;
        }

        const ctx = this.vexel.ctx;
        const overlayCtx = this.vexel.overlayCtx;

        if (this.useDirtyRegions && this.dirtyRegions.length > 0) {
            for (const region of this.dirtyRegions) {
                ctx.clearRect(region.x, region.y, region.width, region.height);
            }
        } else {
            ctx.clearRect(0, 0, this.vexel.width, this.vexel.height);
        }
        overlayCtx.clearRect(0, 0, this.vexel.width, this.vexel.height);

        if (this.vexel.gridEnabled) {
            this.renderGrid(ctx);
        }

        ctx.save();
        ctx.translate(this.vexel.viewport.x, this.vexel.viewport.y);
        ctx.scale(this.vexel.viewport.zoom, this.vexel.viewport.zoom);
        ctx.rotate(this.vexel.viewport.rotation);

        if (this.antialias) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
        }

        for (const shape of this.vexel.shapes) {
            if (shape.visible !== false) {
                shape.draw(ctx);
            }
        }

        ctx.restore();

        this.renderSelectionOverlay(overlayCtx);
        this.renderGuides(ctx);
        this.dirtyRegions = [];
    }

    renderGrid(ctx) {
        const zoom = this.vexel.viewport.zoom;
        const snapSize = this.vexel.snapSize;
        let gridSize = snapSize * zoom;

        if (gridSize < 5) gridSize = snapSize * zoom * 5;
        if (gridSize > 200) gridSize = snapSize * zoom;

        const offsetX = this.vexel.viewport.x % gridSize;
        const offsetY = this.vexel.viewport.y % gridSize;

        ctx.strokeStyle = 'rgba(128,128,128,0.12)';
        ctx.lineWidth = 0.5;

        if (gridSize > 50) {
            ctx.strokeStyle = 'rgba(128,128,128,0.08)';
            ctx.lineWidth = 0.5;
        }

        ctx.beginPath();
        for (let x = offsetX; x < this.vexel.width; x += gridSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.vexel.height);
        }
        for (let y = offsetY; y < this.vexel.height; y += gridSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(this.vexel.width, y);
        }
        ctx.stroke();

        if (gridSize > 80) {
            const originX = this.vexel.viewport.x;
            const originY = this.vexel.viewport.y;
            ctx.strokeStyle = 'rgba(255,87,34,0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(originX, 0);
            ctx.lineTo(originX, this.vexel.height);
            ctx.moveTo(0, originY);
            ctx.lineTo(this.vexel.width, originY);
            ctx.stroke();
        }
    }

    renderSelectionOverlay(ctx) {
        const selected = this.vexel.selectedShapes;
        if (selected.length === 0) return;

        ctx.save();
        ctx.translate(this.vexel.viewport.x, this.vexel.viewport.y);
        ctx.scale(this.vexel.viewport.zoom, this.vexel.viewport.zoom);

        for (const shape of selected) {
            const bounds = shape.getBounds();
            const z = this.vexel.viewport.zoom;

            ctx.strokeStyle = '#4A90D9';
            ctx.lineWidth = 1.5 / z;
            ctx.setLineDash([6 / z, 3 / z]);
            ctx.strokeRect(bounds.x - 2 / z, bounds.y - 2 / z, bounds.width + 4 / z, bounds.height + 4 / z);
            ctx.setLineDash([]);

            const handleSize = 7 / z;
            const handles = [
                { x: bounds.x, y: bounds.y },
                { x: bounds.x + bounds.width, y: bounds.y },
                { x: bounds.x, y: bounds.y + bounds.height },
                { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
                { x: bounds.x + bounds.width / 2, y: bounds.y },
                { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
                { x: bounds.x, y: bounds.y + bounds.height / 2 },
                { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }
            ];

            for (const h of handles) {
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = '#4A90D9';
                ctx.lineWidth = 1.5 / z;
                ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
                ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
            }

            if (selected.length === 1) {
                const cx = bounds.x + bounds.width / 2;
                const cy = bounds.y + bounds.height / 2;
                ctx.fillStyle = '#4A90D9';
                ctx.beginPath();
                ctx.arc(cx, cy, 4 / z, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.restore();
    }

    renderGuides(ctx) {
        const selected = this.vexel.selectedShapes;
        if (selected.length === 0) return;

        ctx.save();
        ctx.translate(this.vexel.viewport.x, this.vexel.viewport.y);
        ctx.scale(this.vexel.viewport.zoom, this.vexel.viewport.zoom);

        ctx.strokeStyle = 'rgba(255,87,34,0.3)';
        ctx.lineWidth = 0.5 / this.vexel.viewport.zoom;
        ctx.setLineDash([4, 8]);

        const allBounds = [];
        for (const shape of this.vexel.shapes) {
            if (!selected.includes(shape) && shape.visible !== false) {
                allBounds.push(shape.getBounds());
            }
        }

        for (const sel of selected) {
            const sb = sel.getBounds();
            const scx = sb.x + sb.width / 2;
            const scy = sb.y + sb.height / 2;

            for (const ab of allBounds) {
                const acx = ab.x + ab.width / 2;
                const acy = ab.y + ab.height / 2;

                if (Math.abs(scx - acx) < 2) {
                    ctx.beginPath();
                    ctx.moveTo(scx, Math.min(sb.y, ab.y));
                    ctx.lineTo(scx, Math.max(sb.y + sb.height, ab.y + ab.height));
                    ctx.stroke();
                }

                if (Math.abs(scy - acy) < 2) {
                    ctx.beginPath();
                    ctx.moveTo(Math.min(sb.x, ab.x), scy);
                    ctx.lineTo(Math.max(sb.x + sb.width, ab.x + ab.width), scy);
                    ctx.stroke();
                }

                if (Math.abs(sb.x - (ab.x + ab.width)) < 2) {
                    ctx.beginPath();
                    ctx.moveTo(sb.x, Math.min(sb.y, ab.y));
                    ctx.lineTo(sb.x, Math.max(sb.y + sb.height, ab.y + ab.height));
                    ctx.stroke();
                }

                if (Math.abs((sb.x + sb.width) - ab.x) < 2) {
                    ctx.beginPath();
                    ctx.moveTo(sb.x + sb.width, Math.min(sb.y, ab.y));
                    ctx.lineTo(sb.x + sb.width, Math.max(sb.y + sb.height, ab.y + ab.height));
                    ctx.stroke();
                }

                if (Math.abs(sb.y - (ab.y + ab.height)) < 2) {
                    ctx.beginPath();
                    ctx.moveTo(Math.min(sb.x, ab.x), sb.y);
                    ctx.lineTo(Math.max(sb.x + sb.width, ab.x + ab.width), sb.y);
                    ctx.stroke();
                }

                if (Math.abs((sb.y + sb.height) - ab.y) < 2) {
                    ctx.beginPath();
                    ctx.moveTo(Math.min(sb.x, ab.x), sb.y + sb.height);
                    ctx.lineTo(Math.max(sb.x + sb.width, ab.x + ab.width), sb.y + sb.height);
                    ctx.stroke();
                }
            }
        }

        ctx.setLineDash([]);
        ctx.restore();
    }

    getFPS() {
        return this.fps;
    }

    getMemoryUsage() {
        if (performance.memory) {
            return {
                usedJSHeapSize: performance.memory.usedJSHeapSize,
                totalJSHeapSize: performance.memory.totalJSHeapSize,
                limitJSHeapSize: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }

    getStats() {
        return {
            backend: this.backend,
            fps: this.fps,
            shapeCount: this.vexel.shapes.length,
            selectedCount: this.vexel.selectedShapes.length,
            viewportZoom: this.vexel.viewport.zoom,
            memory: this.getMemoryUsage(),
            pixelRatio: this.pixelRatio,
            antialias: this.antialias
        };
    }

    setAntialias(enabled) {
        this.antialias = enabled;
        this.vexel.dirty = true;
    }

    setDirtyRegions(enabled) {
        this.useDirtyRegions = enabled;
    }

    markDirty(x, y, width, height) {
        if (this.dirtyRegions.length >= this.maxDirtyRegions) {
            this.dirtyRegions.shift();
        }
        this.dirtyRegions.push({ x, y, width, height });
    }

    markAllDirty() {
        this.dirtyRegions = [{ x: 0, y: 0, width: this.vexel.width, height: this.vexel.height }];
    }

    takeScreenshot(scale = 1) {
        return new Promise((resolve) => {
            const w = this.vexel.width * scale;
            const h = this.vexel.height * scale;
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.scale(scale, scale);

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, this.vexel.width, this.vexel.height);

            if (this.vexel.gridEnabled) {
                this.renderGrid(ctx);
            }

            ctx.save();
            ctx.translate(this.vexel.viewport.x, this.vexel.viewport.y);
            ctx.scale(this.vexel.viewport.zoom, this.vexel.viewport.zoom);
            ctx.rotate(this.vexel.viewport.rotation);

            for (const shape of this.vexel.shapes) {
                if (shape.visible !== false) {
                    shape.draw(ctx);
                }
            }

            ctx.restore();

            canvas.toBlob((blob) => resolve(blob), 'image/png');
        });
    }
}

if (typeof window !== 'undefined') {
    window.VexelRenderEngine = VexelRenderEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelRenderEngine;
}
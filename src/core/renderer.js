// src/core/renderer.js

class VexelRenderer {
    constructor(vexel) {
        this.vexel = vexel;
        this.backend = 'canvas2d';
        this.pixelRatio = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
        this.antialias = true;
        this.fps = 0;
        this.frameCount = 0;
        this.lastFPSTime = performance.now();
        this.dirty = true;
        this.dirtyRegions = [];
        this.useDirtyRegions = false;
        this.maxDirtyRegions = 10;
        this.webglRenderer = null;
        this.renderingEnabled = true;
        this.stats = {
            drawCalls: 0,
            shapesRendered: 0,
            framesRendered: 0,
            lastFrameTime: 0
        };
    }

    setBackend(backend) {
        const backends = ['canvas2d', 'webgl', 'webgl2'];
        if (!backends.includes(backend)) {
            console.warn(`Backend "${backend}" not supported. Using canvas2d.`);
            backend = 'canvas2d';
        }

        if (backend === 'webgl' || backend === 'webgl2') {
            if (this.webglRenderer) {
                this.backend = backend;
                return;
            }
            const initialized = this._initWebGL(backend);
            if (!initialized) {
                console.warn('WebGL initialization failed. Using canvas2d.');
                this.backend = 'canvas2d';
                return;
            }
        }

        this.backend = backend;
        this.dirty = true;
    }

    _initWebGL(backend) {
        if (typeof window === 'undefined') return false;
        if (this.webglRenderer) return true;

        const VexelWebGLRenderer = window.VexelWebGLRenderer;
        if (!VexelWebGLRenderer) return false;

        this.webglRenderer = new VexelWebGLRenderer(this.vexel);
        const ok = this.webglRenderer.init();
        if (ok) {
            this.backend = backend;
        }
        return ok;
    }

    render() {
        if (!this.renderingEnabled) return;

        const startTime = performance.now();

        this.frameCount++;
        const now = performance.now();
        if (now - this.lastFPSTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFPSTime = now;
        }

        if (this.backend === 'webgl' || this.backend === 'webgl2') {
            this._renderWebGL();
        } else {
            this._renderCanvas2D();
        }

        this.stats.framesRendered++;
        this.stats.lastFrameTime = performance.now() - startTime;
        this.dirty = false;
        this.dirtyRegions = [];
    }

    _renderCanvas2D() {
        const ctx = this.vexel.ctx;
        const overlayCtx = this.vexel.overlayCtx;
        const w = this.vexel.width;
        const h = this.vexel.height;

        ctx.clearRect(0, 0, w, h);
        overlayCtx.clearRect(0, 0, w, h);

        if (this.vexel.canvas && this.vexel.canvas.gridVisible) {
            this.vexel.canvas.drawGrid(ctx);
        }

        ctx.save();
        ctx.translate(this.vexel.viewport.x, this.vexel.viewport.y);
        ctx.scale(this.vexel.viewport.zoom, this.vexel.viewport.zoom);
        ctx.rotate(this.vexel.viewport.rotation);

        if (this.antialias) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
        }

        let shapesRendered = 0;

        if (this.vexel.layers && this.vexel.layers.layers && this.vexel.layers.layers.length > 0) {
            for (const layer of this.vexel.layers.getVisibleLayers()) {
                layer.draw(ctx);
                shapesRendered += layer.getShapeCount();
            }
        } else {
            for (const shape of this.vexel.shapes) {
                if (shape.visible !== false) {
                    shape.draw(ctx);
                    shapesRendered++;
                }
            }
        }

        ctx.restore();

        if (this.vexel.canvas && this.vexel.canvas.guidesVisible) {
            this.vexel.canvas.drawGuides(ctx);
        }

        if (this.vexel.canvas && this.vexel.canvas.rulersVisible) {
            this.vexel.canvas.drawRulers(ctx);
        }

        this._renderOverlay(overlayCtx);

        this.stats.shapesRendered = shapesRendered;
        this.stats.drawCalls = shapesRendered;
    }

    _renderWebGL() {
        if (!this.webglRenderer) return;

        this.webglRenderer.begin();

        const visibleShapes = this.vexel.canvas
            ? this.vexel.canvas.getVisibleShapes(this.vexel.shapes)
            : this.vexel.shapes.filter(s => s.visible !== false);

        for (const shape of visibleShapes) {
            this._renderShapeWebGL(shape);
        }

        this.webglRenderer.end();
        this.stats.shapesRendered = visibleShapes.length;
        this.stats.drawCalls = this.webglRenderer.drawCalls;
    }

    _renderShapeWebGL(shape) {
        if (!this.webglRenderer) return;

        switch (shape.type) {
            case 'rectangle': {
                let color = 0xFF5722FF;
                if (shape.fill && shape.fill !== 'transparent') {
                    const parsed = VexelColor ? VexelColor.parse(shape.fill) : null;
                    if (parsed) {
                        const a = Math.round((shape.opacity || 1) * 255);
                        color = (a << 24) | (parsed.b << 16) | (parsed.g << 8) | parsed.r;
                    }
                }
                this.webglRenderer.drawRect(
                    shape.x, shape.y,
                    shape.width * shape.scaleX,
                    shape.height * shape.scaleY,
                    color
                );
                break;
            }
            case 'ellipse': {
                let color = 0xFF5722FF;
                if (shape.fill && shape.fill !== 'transparent') {
                    const parsed = VexelColor ? VexelColor.parse(shape.fill) : null;
                    if (parsed) {
                        const a = Math.round((shape.opacity || 1) * 255);
                        color = (a << 24) | (parsed.b << 16) | (parsed.g << 8) | parsed.r;
                    }
                }
                this.webglRenderer.drawEllipse(
                    shape.x, shape.y,
                    shape.radiusX, shape.radiusY,
                    color
                );
                break;
            }
            case 'line': {
                let color = 0x000000FF;
                if (shape.stroke && shape.stroke !== 'none') {
                    const parsed = VexelColor ? VexelColor.parse(shape.stroke) : null;
                    if (parsed) {
                        const a = Math.round((shape.opacity || 1) * 255);
                        color = (a << 24) | (parsed.b << 16) | (parsed.g << 8) | parsed.r;
                    }
                }
                this.webglRenderer.drawLine(
                    shape.x1, shape.y1,
                    shape.x2, shape.y2,
                    color,
                    shape.strokeWidth || 1
                );
                break;
            }
            default: {
                break;
            }
        }
    }

    _renderOverlay(ctx) {
        const selected = this.vexel.selectedShapes;
        if (selected.length === 0) return;

        ctx.save();
        ctx.translate(this.vexel.viewport.x, this.vexel.viewport.y);
        ctx.scale(this.vexel.viewport.zoom, this.vexel.viewport.zoom);

        for (const shape of selected) {
            const bounds = shape.getBounds();
            const z = this.vexel.viewport.zoom;
            const handleSize = 7 / z;

            ctx.strokeStyle = '#4A90D9';
            ctx.lineWidth = 1.5 / z;
            ctx.setLineDash([6 / z, 3 / z]);
            ctx.strokeRect(
                bounds.x - 2 / z,
                bounds.y - 2 / z,
                bounds.width + 4 / z,
                bounds.height + 4 / z
            );
            ctx.setLineDash([]);

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
                ctx.fillRect(
                    h.x - handleSize / 2,
                    h.y - handleSize / 2,
                    handleSize,
                    handleSize
                );
                ctx.strokeRect(
                    h.x - handleSize / 2,
                    h.y - handleSize / 2,
                    handleSize,
                    handleSize
                );
            }
        }

        ctx.restore();

        if (this.vexel.selectTool && this.vexel.selectTool.marquee) {
            this.vexel.selectTool.drawMarquee(ctx);
        }

        if (this.vexel.selectTool && selected.length === 1) {
            this.vexel.selectTool.drawRotationHandle(ctx);
        }
    }

    setAntialias(enabled) {
        this.antialias = enabled;
        this.dirty = true;
    }

    setDirtyRegions(enabled) {
        this.useDirtyRegions = enabled;
    }

    markDirty(x, y, width, height) {
        this.dirty = true;
        if (x !== undefined) {
            this.dirtyRegions.push({ x, y, width, height });
            if (this.dirtyRegions.length > this.maxDirtyRegions) {
                this.dirtyRegions.shift();
            }
        }
    }

    markAllDirty() {
        this.dirty = true;
        this.dirtyRegions = [];
    }

    getFPS() {
        return this.fps;
    }

    getStats() {
        return {
            ...this.stats,
            backend: this.backend,
            fps: this.fps,
            pixelRatio: this.pixelRatio,
            antialias: this.antialias,
            dirty: this.dirty,
            totalShapes: this.vexel.shapes.length,
            selectedShapes: this.vexel.selectedShapes.length,
            viewportZoom: this.vexel.viewport.zoom,
            webgl: this.webglRenderer ? this.webglRenderer.getStats() : null
        };
    }

    takeScreenshot(scale = 1, format = 'image/png') {
        return new Promise((resolve) => {
            const w = Math.round(this.vexel.width * scale);
            const h = Math.round(this.vexel.height * scale);

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);

            ctx.save();
            ctx.scale(scale, scale);

            ctx.translate(this.vexel.viewport.x, this.vexel.viewport.y);
            ctx.scale(this.vexel.viewport.zoom, this.vexel.viewport.zoom);
            ctx.rotate(this.vexel.viewport.rotation);

            for (const shape of this.vexel.shapes) {
                if (shape.visible !== false) {
                    shape.draw(ctx);
                }
            }

            ctx.restore();

            canvas.toBlob((blob) => resolve(blob), format);
        });
    }

    enable() {
        this.renderingEnabled = true;
    }

    disable() {
        this.renderingEnabled = false;
    }

    destroy() {
        if (this.webglRenderer) {
            this.webglRenderer.destroy();
            this.webglRenderer = null;
        }
    }
}

if (typeof window !== 'undefined') {
    window.VexelRenderer = VexelRenderer;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelRenderer;
}
// src/core/worker.js

class VexelWorker {
    constructor(vexel) {
        this.vexel = vexel;
        this.worker = null;
        this.ready = false;
        this.tasks = new Map();
        this.taskId = 0;
        this.pendingTasks = [];
        this.maxWorkers = typeof navigator !== 'undefined'
            ? (navigator.hardwareConcurrency || 4)
            : 4;
    }

    init() {
        const workerCode = `
            self.tasks = {};
            self.taskId = 0;

            self.addEventListener('message', (e) => {
                const { id, type, data } = e.data;

                switch (type) {
                    case 'export-png':
                        self._handleExportPNG(id, data);
                        break;
                    case 'export-svg':
                        self._handleExportSVG(id, data);
                        break;
                    case 'export-json':
                        self._handleExportJSON(id, data);
                        break;
                    case 'process-image':
                        self._handleProcessImage(id, data);
                        break;
                    case 'boolean-operation':
                        self._handleBooleanOperation(id, data);
                        break;
                    case 'path-simplify':
                        self._handlePathSimplify(id, data);
                        break;
                    case 'path-smooth':
                        self._handlePathSmooth(id, data);
                        break;
                    case 'compute-bounds':
                        self._handleComputeBounds(id, data);
                        break;
                    case 'render-region':
                        self._handleRenderRegion(id, data);
                        break;
                    default:
                        self.postMessage({ id, error: 'Unknown task type: ' + type });
                }
            });

            self._handleExportPNG = function(id, data) {
                try {
                    const canvas = new OffscreenCanvas(data.width, data.height);
                    const ctx = canvas.getContext('2d');
                    ctx.scale(data.scale || 1, data.scale || 1);
                    ctx.fillStyle = data.background || '#ffffff';
                    ctx.fillRect(0, 0, data.width, data.height);
                    for (const shape of data.shapes) {
                        self._drawShape(ctx, shape);
                    }
                    canvas.convertToBlob({ type: 'image/png' }).then(blob => {
                        self.postMessage({ id, result: blob }, [blob]);
                    });
                } catch (e) {
                    self.postMessage({ id, error: e.message });
                }
            };

            self._handleExportSVG = function(id, data) {
                try {
                    let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + data.width + '" height="' + data.height + '">';
                    for (const shape of data.shapes) {
                        svg += self._shapeToSVG(shape);
                    }
                    svg += '</svg>';
                    self.postMessage({ id, result: svg });
                } catch (e) {
                    self.postMessage({ id, error: e.message });
                }
            };

            self._handleExportJSON = function(id, data) {
                try {
                    const json = JSON.stringify(data.shapes);
                    self.postMessage({ id, result: json });
                } catch (e) {
                    self.postMessage({ id, error: e.message });
                }
            };

            self._handleProcessImage = function(id, data) {
                try {
                    const img = new Image();
                    img.onload = function() {
                        const canvas = new OffscreenCanvas(img.width, img.height);
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);

                        if (data.filters) {
                            for (const filter of data.filters) {
                                switch (filter.type) {
                                    case 'grayscale':
                                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                                        const pixels = imageData.data;
                                        for (let i = 0; i < pixels.length; i += 4) {
                                            const avg = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
                                            pixels[i] = avg;
                                            pixels[i + 1] = avg;
                                            pixels[i + 2] = avg;
                                        }
                                        ctx.putImageData(imageData, 0, 0);
                                        break;
                                    case 'invert':
                                        const invData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                                        const invPixels = invData.data;
                                        for (let i = 0; i < invPixels.length; i += 4) {
                                            invPixels[i] = 255 - invPixels[i];
                                            invPixels[i + 1] = 255 - invPixels[i + 1];
                                            invPixels[i + 2] = 255 - invPixels[i + 2];
                                        }
                                        ctx.putImageData(invData, 0, 0);
                                        break;
                                    case 'brightness':
                                        const brightData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                                        const brightPixels = brightData.data;
                                        const val = filter.value || 0;
                                        for (let i = 0; i < brightPixels.length; i += 4) {
                                            brightPixels[i] = Math.min(255, Math.max(0, brightPixels[i] + val));
                                            brightPixels[i + 1] = Math.min(255, Math.max(0, brightPixels[i + 1] + val));
                                            brightPixels[i + 2] = Math.min(255, Math.max(0, brightPixels[i + 2] + val));
                                        }
                                        ctx.putImageData(brightData, 0, 0);
                                        break;
                                    case 'contrast':
                                        const contrastData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                                        const contrastPixels = contrastData.data;
                                        const factor = (259 * ((filter.value || 0) + 255)) / (255 * (259 - (filter.value || 0)));
                                        for (let i = 0; i < contrastPixels.length; i += 4) {
                                            contrastPixels[i] = Math.min(255, Math.max(0, factor * (contrastPixels[i] - 128) + 128));
                                            contrastPixels[i + 1] = Math.min(255, Math.max(0, factor * (contrastPixels[i + 1] - 128) + 128));
                                            contrastPixels[i + 2] = Math.min(255, Math.max(0, factor * (contrastPixels[i + 2] - 128) + 128));
                                        }
                                        ctx.putImageData(contrastData, 0, 0);
                                        break;
                                }
                            }
                        }

                        canvas.convertToBlob({ type: 'image/png' }).then(blob => {
                            self.postMessage({ id, result: blob }, [blob]);
                        });
                    };
                    img.src = data.src;
                } catch (e) {
                    self.postMessage({ id, error: e.message });
                }
            };

            self._handleBooleanOperation = function(id, data) {
                try {
                    const result = self._performBoolean(data.shapes, data.operation);
                    self.postMessage({ id, result });
                } catch (e) {
                    self.postMessage({ id, error: e.message });
                }
            };

            self._handlePathSimplify = function(id, data) {
                try {
                    const simplified = self._simplifyPoints(data.points, data.tolerance || 1);
                    self.postMessage({ id, result: simplified });
                } catch (e) {
                    self.postMessage({ id, error: e.message });
                }
            };

            self._handlePathSmooth = function(id, data) {
                try {
                    let points = data.points;
                    for (let iter = 0; iter < (data.iterations || 3); iter++) {
                        const smoothed = [points[0]];
                        for (let i = 1; i < points.length - 1; i++) {
                            smoothed.push({
                                x: (points[i - 1].x + points[i].x + points[i + 1].x) / 3,
                                y: (points[i - 1].y + points[i].y + points[i + 1].y) / 3
                            });
                        }
                        smoothed.push(points[points.length - 1]);
                        points = smoothed;
                    }
                    self.postMessage({ id, result: points });
                } catch (e) {
                    self.postMessage({ id, error: e.message });
                }
            };

            self._handleComputeBounds = function(id, data) {
                try {
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    for (const shape of data.shapes) {
                        const b = shape.bounds || shape;
                        minX = Math.min(minX, b.x);
                        minY = Math.min(minY, b.y);
                        maxX = Math.max(maxX, b.x + b.width);
                        maxY = Math.max(maxY, b.y + b.height);
                    }
                    self.postMessage({ id, result: { x: minX, y: minY, width: maxX - minX, height: maxY - minY } });
                } catch (e) {
                    self.postMessage({ id, error: e.message });
                }
            };

            self._handleRenderRegion = function(id, data) {
                try {
                    const canvas = new OffscreenCanvas(data.width, data.height);
                    const ctx = canvas.getContext('2d');
                    ctx.translate(-data.x, -data.y);
                    for (const shape of data.shapes) {
                        self._drawShape(ctx, shape);
                    }
                    canvas.convertToBlob({ type: 'image/png' }).then(blob => {
                        self.postMessage({ id, result: blob }, [blob]);
                    });
                } catch (e) {
                    self.postMessage({ id, error: e.message });
                }
            };

            self._drawShape = function(ctx, shape) {
                ctx.save();
                if (shape.opacity !== undefined) ctx.globalAlpha = shape.opacity;
                if (shape.rotation) {
                    const cx = shape.x + (shape.width || 0) / 2;
                    const cy = shape.y + (shape.height || 0) / 2;
                    ctx.translate(cx, cy);
                    ctx.rotate((shape.rotation * Math.PI) / 180);
                    ctx.translate(-cx, -cy);
                }
                switch (shape.type) {
                    case 'rectangle':
                        if (shape.fill !== 'transparent') {
                            ctx.fillStyle = shape.fill;
                            if (shape.cornerRadius) {
                                ctx.beginPath();
                                ctx.roundRect(shape.x, shape.y, shape.width, shape.height, shape.cornerRadius);
                                ctx.fill();
                            } else {
                                ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
                            }
                        }
                        if (shape.stroke !== 'none') {
                            ctx.strokeStyle = shape.stroke;
                            ctx.lineWidth = shape.strokeWidth || 1;
                            ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
                        }
                        break;
                    case 'ellipse':
                        if (shape.fill !== 'transparent') {
                            ctx.fillStyle = shape.fill;
                            ctx.beginPath();
                            ctx.ellipse(shape.x, shape.y, shape.radiusX, shape.radiusY, 0, 0, Math.PI * 2);
                            ctx.fill();
                        }
                        break;
                    case 'path':
                        if (shape.points && shape.points.length > 1) {
                            ctx.beginPath();
                            ctx.moveTo(shape.points[0].x, shape.points[0].y);
                            for (let i = 1; i < shape.points.length; i++) {
                                ctx.lineTo(shape.points[i].x, shape.points[i].y);
                            }
                            if (shape.closed) ctx.closePath();
                            if (shape.fill !== 'transparent') { ctx.fillStyle = shape.fill; ctx.fill(); }
                            if (shape.stroke !== 'none') { ctx.strokeStyle = shape.stroke; ctx.lineWidth = shape.strokeWidth || 1; ctx.stroke(); }
                        }
                        break;
                }
                ctx.restore();
            };

            self._performBoolean = function(shapes, operation) {
                const polygons = shapes.map(s => self._shapeToPoints(s));
                let result = polygons[0];
                for (let i = 1; i < polygons.length; i++) {
                    result = self._combinePolygons(result, polygons[i], operation);
                }
                return result;
            };

            self._shapeToPoints = function(shape) {
                if (shape.points) return shape.points;
                const b = shape.bounds || shape;
                return [
                    { x: b.x, y: b.y },
                    { x: b.x + b.width, y: b.y },
                    { x: b.x + b.width, y: b.y + b.height },
                    { x: b.x, y: b.y + b.height }
                ];
            };

            self._combinePolygons = function(polyA, polyB, operation) {
                const result = [];
                for (const p of polyA) {
                    const inside = self._pointInPolygon(p, polyB);
                    if ((operation === 'union' && !inside) || (operation === 'intersect' && inside) || (operation === 'subtract' && !inside)) {
                        result.push(p);
                    }
                }
                if (operation === 'intersect' || operation === 'union') {
                    for (const p of polyB) {
                        const inside = self._pointInPolygon(p, polyA);
                        if ((operation === 'intersect' && inside) || (operation === 'union' && !inside)) {
                            result.push(p);
                        }
                    }
                }
                return result;
            };

            self._pointInPolygon = function(point, polygon) {
                let inside = false;
                for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                    if ((polygon[i].y > point.y) !== (polygon[j].y > point.y) &&
                        point.x < ((polygon[j].x - polygon[i].x) * (point.y - polygon[i].y)) / (polygon[j].y - polygon[i].y) + polygon[i].x) {
                        inside = !inside;
                    }
                }
                return inside;
            };

            self._simplifyPoints = function(points, tolerance) {
                if (points.length <= 2) return points;
                let maxDist = 0, maxIdx = 0;
                const first = points[0], last = points[points.length - 1];
                for (let i = 1; i < points.length - 1; i++) {
                    const d = self._distToSegment(points[i], first, last);
                    if (d > maxDist) { maxDist = d; maxIdx = i; }
                }
                if (maxDist > tolerance) {
                    const left = self._simplifyPoints(points.slice(0, maxIdx + 1), tolerance);
                    const right = self._simplifyPoints(points.slice(maxIdx), tolerance);
                    return [...left.slice(0, -1), ...right];
                }
                return [first, last];
            };

            self._distToSegment = function(p, a, b) {
                const dx = b.x - a.x, dy = b.y - a.y;
                const lenSq = dx * dx + dy * dy;
                if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
                let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
                t = Math.max(0, Math.min(1, t));
                return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
            };

            self.postMessage({ type: 'ready' });
        `;

        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        this.worker = new Worker(url);
        URL.revokeObjectURL(url);

        this.worker.addEventListener('message', (e) => {
            const { id, result, error, type } = e.data;

            if (type === 'ready') {
                this.ready = true;
                this._processPending();
                return;
            }

            const task = this.tasks.get(id);
            if (!task) return;

            if (error) {
                task.reject(new Error(error));
            } else {
                task.resolve(result);
            }

            this.tasks.delete(id);
        });

        this.worker.addEventListener('error', (e) => {
            console.error('Vexel Worker error:', e);
            for (const [id, task] of this.tasks) {
                task.reject(new Error('Worker error'));
            }
            this.tasks.clear();
        });
    }

    _processPending() {
        for (const task of this.pendingTasks) {
            this._executeTask(task);
        }
        this.pendingTasks = [];
    }

    _executeTask(task) {
        if (!this.worker) return;
        this.worker.postMessage({
            id: task.id,
            type: task.type,
            data: task.data
        });
    }

    _runTask(type, data) {
        return new Promise((resolve, reject) => {
            const id = ++this.taskId;
            const task = { id, type, data, resolve, reject };
            this.tasks.set(id, task);

            if (this.ready) {
                this._executeTask(task);
            } else {
                this.pendingTasks.push(task);
            }
        });
    }

    exportPNG(shapes, width, height, options = {}) {
        return this._runTask('export-png', {
            shapes: shapes.map(s => s.serialize()),
            width,
            height,
            scale: options.scale || 1,
            background: options.background || '#ffffff'
        });
    }

    exportSVG(shapes, width, height) {
        return this._runTask('export-svg', {
            shapes: shapes.map(s => s.serialize()),
            width,
            height
        });
    }

    exportJSON(shapes) {
        return this._runTask('export-json', {
            shapes: shapes.map(s => s.serialize())
        });
    }

    processImage(src, filters = []) {
        return this._runTask('process-image', { src, filters });
    }

    booleanOperation(shapes, operation) {
        return this._runTask('boolean-operation', {
            shapes: shapes.map(s => s.serialize()),
            operation
        });
    }

    simplifyPath(points, tolerance = 1) {
        return this._runTask('path-simplify', { points, tolerance });
    }

    smoothPath(points, iterations = 3) {
        return this._runTask('path-smooth', { points, iterations });
    }

    computeBounds(shapes) {
        return this._runTask('compute-bounds', {
            shapes: shapes.map(s => ({
                bounds: s.getBounds()
            }))
        });
    }

    renderRegion(shapes, x, y, width, height) {
        return this._runTask('render-region', {
            shapes: shapes.map(s => s.serialize()),
            x, y, width, height
        });
    }

    destroy() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
        this.tasks.clear();
        this.pendingTasks = [];
        this.ready = false;
    }
}

if (typeof window !== 'undefined') {
    window.VexelWorker = VexelWorker;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelWorker;
}
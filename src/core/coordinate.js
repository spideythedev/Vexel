// src/core/coordinate.js

class VexelCoordinateSystem {
    constructor(vexel) {
        this.vexel = vexel;
        this.origin = { x: 0, y: 0 };
        this.scale = 1;
        this.rotation = 0;
        this.flipX = false;
        this.flipY = false;
    }

    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.vexel.viewport.x) / this.vexel.viewport.zoom,
            y: (screenY - this.vexel.viewport.y) / this.vexel.viewport.zoom
        };
    }

    worldToScreen(worldX, worldY) {
        return {
            x: worldX * this.vexel.viewport.zoom + this.vexel.viewport.x,
            y: worldY * this.vexel.viewport.zoom + this.vexel.viewport.y
        };
    }

    localToWorld(shape, localX, localY) {
        const cx = shape.x + (shape.width || 0) / 2;
        const cy = shape.y + (shape.height || 0) / 2;
        const angle = (shape.rotation || 0) * Math.PI / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const sx = shape.scaleX || 1;
        const sy = shape.scaleY || 1;

        const dx = localX * sx;
        const dy = localY * sy;

        return {
            x: cx + dx * cos - dy * sin,
            y: cy + dx * sin + dy * cos
        };
    }

    worldToLocal(shape, worldX, worldY) {
        const cx = shape.x + (shape.width || 0) / 2;
        const cy = shape.y + (shape.height || 0) / 2;
        const angle = -(shape.rotation || 0) * Math.PI / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const sx = shape.scaleX || 1;
        const sy = shape.scaleY || 1;

        const dx = worldX - cx;
        const dy = worldY - cy;

        const localX = (dx * cos - dy * sin) / sx;
        const localY = (dx * sin + dy * cos) / sy;

        return { x: localX, y: localY };
    }

    localToParent(childShape, parentShape, localX, localY) {
        const world = this.localToWorld(childShape, localX, localY);
        return this.worldToLocal(parentShape, world.x, world.y);
    }

    parentToLocal(parentShape, childShape, parentX, parentY) {
        const world = this.localToWorld(parentShape, parentX, parentY);
        return this.worldToLocal(childShape, world.x, world.y);
    }

    applyTransform(point, matrix) {
        return {
            x: matrix.a * point.x + matrix.c * point.y + matrix.e,
            y: matrix.b * point.x + matrix.d * point.y + matrix.f
        };
    }

    composeMatrix(translateX, translateY, rotation, scaleX, scaleY, skewX, skewY) {
        const cos = Math.cos(rotation || 0);
        const sin = Math.sin(rotation || 0);

        let a = (scaleX || 1) * cos;
        let b = (scaleX || 1) * sin;
        let c = -(scaleY || 1) * sin;
        let d = (scaleY || 1) * cos;

        if (skewX) {
            const tanX = Math.tan(skewX);
            c += a * tanX;
            d += b * tanX;
        }

        if (skewY) {
            const tanY = Math.tan(skewY);
            a += c * tanY;
            b += d * tanY;
        }

        return {
            a, b, c, d,
            e: translateX || 0,
            f: translateY || 0
        };
    }

    decomposeMatrix(matrix) {
        const a = matrix.a;
        const b = matrix.b;
        const c = matrix.c;
        const d = matrix.d;

        const scaleX = Math.sqrt(a * a + b * b);
        const scaleY = Math.sqrt(c * c + d * d);

        const rotation = Math.atan2(b, a);

        const skewX = Math.atan2(a * c + b * d, a * a + b * b);

        return {
            translateX: matrix.e,
            translateY: matrix.f,
            rotation,
            scaleX,
            scaleY,
            skewX,
            skewY: 0
        };
    }

    identityMatrix() {
        return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    }

    multiplyMatrices(m1, m2) {
        return {
            a: m1.a * m2.a + m1.c * m2.b,
            b: m1.b * m2.a + m1.d * m2.b,
            c: m1.a * m2.c + m1.c * m2.d,
            d: m1.b * m2.c + m1.d * m2.d,
            e: m1.a * m2.e + m1.c * m2.f + m1.e,
            f: m1.b * m2.e + m1.d * m2.f + m1.f
        };
    }

    invertMatrix(matrix) {
        const det = matrix.a * matrix.d - matrix.b * matrix.c;
        if (Math.abs(det) < 0.000001) return null;

        return {
            a: matrix.d / det,
            b: -matrix.b / det,
            c: -matrix.c / det,
            d: matrix.a / det,
            e: (matrix.c * matrix.f - matrix.d * matrix.e) / det,
            f: (matrix.b * matrix.e - matrix.a * matrix.f) / det
        };
    }

    distance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    angle(p1, p2) {
        return Math.atan2(p2.y - p1.y, p2.x - p1.x);
    }

    midpoint(p1, p2) {
        return {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
        };
    }

    polarToCartesian(cx, cy, radius, angle) {
        return {
            x: cx + radius * Math.cos(angle),
            y: cy + radius * Math.sin(angle)
        };
    }

    cartesianToPolar(cx, cy, px, py) {
        const dx = px - cx;
        const dy = py - cy;
        return {
            radius: Math.sqrt(dx * dx + dy * dy),
            angle: Math.atan2(dy, dx)
        };
    }

    normalizePoint(p) {
        const len = Math.sqrt(p.x * p.x + p.y * p.y);
        if (len === 0) return { x: 0, y: 0 };
        return { x: p.x / len, y: p.y / len };
    }

    perpendicularClockwise(p) {
        return { x: p.y, y: -p.x };
    }

    perpendicularCounterClockwise(p) {
        return { x: -p.y, y: p.x };
    }

    dotProduct(p1, p2) {
        return p1.x * p2.x + p1.y * p2.y;
    }

    crossProduct(p1, p2) {
        return p1.x * p2.y - p1.y * p2.x;
    }

    reflectPoint(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const lenSq = dx * dx + dy * dy;

        if (lenSq === 0) return { x: point.x, y: point.y };

        const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq;
        const projX = lineStart.x + t * dx;
        const projY = lineStart.y + t * dy;

        return {
            x: 2 * projX - point.x,
            y: 2 * projY - point.y
        };
    }

    lerp(p1, p2, t) {
        return {
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t
        };
    }

    clampPoint(point, bounds) {
        return {
            x: Math.max(bounds.x, Math.min(bounds.x + bounds.width, point.x)),
            y: Math.max(bounds.y, Math.min(bounds.y + bounds.height, point.y))
        };
    }

    roundPoint(point, precision = 0) {
        const factor = Math.pow(10, precision);
        return {
            x: Math.round(point.x * factor) / factor,
            y: Math.round(point.y * factor) / factor
        };
    }

    snapPoint(point, gridSize) {
        return {
            x: Math.round(point.x / gridSize) * gridSize,
            y: Math.round(point.y / gridSize) * gridSize
        };
    }

    alignPoint(point, target, axis) {
        switch (axis) {
            case 'x': return { x: target.x, y: point.y };
            case 'y': return { x: point.x, y: target.y };
            case 'both': return { x: target.x, y: target.y };
            default: return { ...point };
        }
    }

    distributeEvenly(points, axis, start, end) {
        if (points.length <= 1) return points;

        const result = [...points];
        const range = end - start;
        const step = range / (points.length - 1);

        for (let i = 0; i < points.length; i++) {
            const value = start + step * i;
            result[i] = axis === 'x'
                ? { x: value, y: points[i].y }
                : { x: points[i].x, y: value };
        }

        return result;
    }

    getTransformedBoundingBox(shape) {
        const bounds = shape.getBounds();
        const corners = [
            { x: bounds.x, y: bounds.y },
            { x: bounds.x + bounds.width, y: bounds.y },
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
            { x: bounds.x, y: bounds.y + bounds.height }
        ];

        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;
        const angle = (shape.rotation || 0) * Math.PI / 180;

        const transformed = corners.map(c => {
            const dx = c.x - cx;
            const dy = c.y - cy;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            return {
                x: cx + dx * cos - dy * sin,
                y: cy + dx * sin + dy * cos
            };
        });

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of transformed) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }

        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
}

if (typeof window !== 'undefined') {
    window.VexelCoordinateSystem = VexelCoordinateSystem;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelCoordinateSystem;
}
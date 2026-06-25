// src/utils/math.js

class VexelMath {
    static PI = Math.PI;
    static HALF_PI = Math.PI / 2;
    static TWO_PI = Math.PI * 2;
    static DEG_TO_RAD = Math.PI / 180;
    static RAD_TO_DEG = 180 / Math.PI;
    static EPSILON = 0.000001;

    static degToRad(degrees) {
        return degrees * VexelMath.DEG_TO_RAD;
    }

    static radToDeg(radians) {
        return radians * VexelMath.RAD_TO_DEG;
    }

    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    static lerp(a, b, t) {
        return a + (b - a) * t;
    }

    static lerp2D(p1, p2, t) {
        return {
            x: VexelMath.lerp(p1.x, p2.x, t),
            y: VexelMath.lerp(p1.y, p2.y, t)
        };
    }

    static distance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static distanceSquared(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return dx * dx + dy * dy;
    }

    static angle(p1, p2) {
        return Math.atan2(p2.y - p1.y, p2.x - p1.x);
    }

    static midpoint(p1, p2) {
        return {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
        };
    }

    static normalize(p) {
        const len = Math.sqrt(p.x * p.x + p.y * p.y);
        if (len === 0) return { x: 0, y: 0 };
        return { x: p.x / len, y: p.y / len };
    }

    static dot(p1, p2) {
        return p1.x * p2.x + p1.y * p2.y;
    }

    static cross(p1, p2) {
        return p1.x * p2.y - p1.y * p2.x;
    }

    static perpendicular(p) {
        return { x: -p.y, y: p.x };
    }

    static rotatePoint(point, center, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        return {
            x: center.x + dx * cos - dy * sin,
            y: center.y + dx * sin + dy * cos
        };
    }

    static scalePoint(point, center, sx, sy) {
        return {
            x: center.x + (point.x - center.x) * sx,
            y: center.y + (point.y - center.y) * (sy || sx)
        };
    }

    static reflectPoint(point, lineStart, lineEnd) {
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

    static roundTo(value, precision) {
        const factor = Math.pow(10, precision);
        return Math.round(value * factor) / factor;
    }

    static snapToGrid(value, gridSize) {
        return Math.round(value / gridSize) * gridSize;
    }

    static mapRange(value, inMin, inMax, outMin, outMax) {
        return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
    }

    static smoothStep(edge0, edge1, x) {
        const t = VexelMath.clamp((x - edge0) / (edge1 - edge0), 0, 1);
        return t * t * (3 - 2 * t);
    }

    static nearlyEqual(a, b, epsilon = VexelMath.EPSILON) {
        return Math.abs(a - b) < epsilon;
    }

    static pointNearlyEqual(p1, p2, epsilon = VexelMath.EPSILON) {
        return VexelMath.nearlyEqual(p1.x, p2.x, epsilon) && VexelMath.nearlyEqual(p1.y, p2.y, epsilon);
    }
}

class VexelMatrix {
    constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
        this.e = e;
        this.f = f;
    }

    static identity() {
        return new VexelMatrix(1, 0, 0, 1, 0, 0);
    }

    static translation(tx, ty) {
        return new VexelMatrix(1, 0, 0, 1, tx, ty);
    }

    static rotation(angle, cx = 0, cy = 0) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new VexelMatrix(
            cos, sin,
            -sin, cos,
            cx - cx * cos + cy * sin,
            cy - cx * sin - cy * cos
        );
    }

    static scale(sx, sy, cx = 0, cy = 0) {
        return new VexelMatrix(
            sx, 0,
            0, sy || sx,
            cx - cx * sx,
            cy - cy * (sy || sx)
        );
    }

    static skew(skewX, skewY, cx = 0, cy = 0) {
        const tanX = Math.tan(skewX);
        const tanY = Math.tan(skewY);
        return new VexelMatrix(
            1, tanY,
            tanX, 1,
            -cy * tanX,
            -cx * tanY
        );
    }

    clone() {
        return new VexelMatrix(this.a, this.b, this.c, this.d, this.e, this.f);
    }

    multiply(other) {
        return new VexelMatrix(
            this.a * other.a + this.c * other.b,
            this.b * other.a + this.d * other.b,
            this.a * other.c + this.c * other.d,
            this.b * other.c + this.d * other.d,
            this.a * other.e + this.c * other.f + this.e,
            this.b * other.e + this.d * other.f + this.f
        );
    }

    translate(tx, ty) {
        return this.multiply(VexelMatrix.translation(tx, ty));
    }

    rotate(angle, cx = 0, cy = 0) {
        return this.multiply(VexelMatrix.rotation(angle, cx, cy));
    }

    scale(sx, sy, cx = 0, cy = 0) {
        return this.multiply(VexelMatrix.scale(sx, sy, cx, cy));
    }

    skew(skewX, skewY, cx = 0, cy = 0) {
        return this.multiply(VexelMatrix.skew(skewX, skewY, cx, cy));
    }

    transformPoint(point) {
        return {
            x: this.a * point.x + this.c * point.y + this.e,
            y: this.b * point.x + this.d * point.y + this.f
        };
    }

    transformPoints(points) {
        return points.map(p => this.transformPoint(p));
    }

    inverse() {
        const det = this.a * this.d - this.b * this.c;
        if (det === 0) return null;

        return new VexelMatrix(
            this.d / det,
            -this.b / det,
            -this.c / det,
            this.a / det,
            (this.c * this.f - this.d * this.e) / det,
            (this.b * this.e - this.a * this.f) / det
        );
    }

    decompose() {
        return {
            translateX: this.e,
            translateY: this.f,
            rotation: Math.atan2(this.b, this.a),
            scaleX: Math.sqrt(this.a * this.a + this.b * this.b),
            scaleY: Math.sqrt(this.c * this.c + this.d * this.d),
            skewX: Math.atan2(this.a * this.c + this.b * this.d, this.a * this.a + this.b * this.b),
            skewY: 0
        };
    }

    toArray() {
        return [this.a, this.b, this.c, this.d, this.e, this.f];
    }

    toCSS() {
        return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
    }

    toString() {
        return `matrix(${this.a}, ${this.b}, ${this.c}, ${this.d}, ${this.e}, ${this.f})`;
    }

    equals(other) {
        return VexelMath.nearlyEqual(this.a, other.a) &&
            VexelMath.nearlyEqual(this.b, other.b) &&
            VexelMath.nearlyEqual(this.c, other.c) &&
            VexelMath.nearlyEqual(this.d, other.d) &&
            VexelMath.nearlyEqual(this.e, other.e) &&
            VexelMath.nearlyEqual(this.f, other.f);
    }
}

class VexelBounds {
    constructor(x = 0, y = 0, width = 0, height = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    static fromPoints(points) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of points) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
        return new VexelBounds(minX, minY, maxX - minX, maxY - minY);
    }

    static fromBounds(boundsArray) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const b of boundsArray) {
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
        }
        return new VexelBounds(minX, minY, maxX - minX, maxY - minY);
    }

    get centerX() { return this.x + this.width / 2; }
    get centerY() { return this.y + this.height / 2; }
    get left() { return this.x; }
    get right() { return this.x + this.width; }
    get top() { return this.y; }
    get bottom() { return this.y + this.height; }
    get center() { return { x: this.centerX, y: this.centerY }; }

    clone() {
        return new VexelBounds(this.x, this.y, this.width, this.height);
    }

    expand(amount) {
        return new VexelBounds(
            this.x - amount,
            this.y - amount,
            this.width + amount * 2,
            this.height + amount * 2
        );
    }

    contract(amount) {
        return this.expand(-amount);
    }

    contains(point) {
        return point.x >= this.x &&
            point.x <= this.x + this.width &&
            point.y >= this.y &&
            point.y <= this.y + this.height;
    }

    intersects(other) {
        return !(
            this.x + this.width < other.x ||
            other.x + other.width < this.x ||
            this.y + this.height < other.y ||
            other.y + other.height < this.y
        );
    }

    union(other) {
        const x = Math.min(this.x, other.x);
        const y = Math.min(this.y, other.y);
        const width = Math.max(this.x + this.width, other.x + other.width) - x;
        const height = Math.max(this.y + this.height, other.y + other.height) - y;
        return new VexelBounds(x, y, width, height);
    }

    intersection(other) {
        const x = Math.max(this.x, other.x);
        const y = Math.max(this.y, other.y);
        const width = Math.min(this.x + this.width, other.x + other.width) - x;
        const height = Math.min(this.y + this.height, other.y + other.height) - y;
        if (width < 0 || height < 0) return null;
        return new VexelBounds(x, y, width, height);
    }

    toObject() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }

    toString() {
        return `Bounds(x:${this.x}, y:${this.y}, w:${this.width}, h:${this.height})`;
    }
}

if (typeof window !== 'undefined') {
    window.VexelMath = VexelMath;
    window.VexelMatrix = VexelMatrix;
    window.VexelBounds = VexelBounds;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VexelMath, VexelMatrix, VexelBounds };
}
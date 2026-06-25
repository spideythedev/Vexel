// src/utils/geometry.js

class VexelGeometry {
    static pointInRectangle(px, py, rx, ry, rw, rh) {
        return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
    }

    static pointInEllipse(px, py, cx, cy, rx, ry) {
        if (rx <= 0 || ry <= 0) return false;
        const dx = (px - cx) / rx;
        const dy = (py - cy) / ry;
        return (dx * dx + dy * dy) <= 1;
    }

    static pointInPolygon(px, py, vertices) {
        let inside = false;
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            const xi = vertices[i].x;
            const yi = vertices[i].y;
            const xj = vertices[j].x;
            const yj = vertices[j].y;
            if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
                inside = !inside;
            }
        }
        return inside;
    }

    static rectangleIntersection(r1, r2) {
        return !(
            r1.x + r1.width < r2.x ||
            r2.x + r2.width < r1.x ||
            r1.y + r1.height < r2.y ||
            r2.y + r2.height < r1.y
        );
    }

    static rectangleUnion(r1, r2) {
        const x = Math.min(r1.x, r2.x);
        const y = Math.min(r1.y, r2.y);
        const width = Math.max(r1.x + r1.width, r2.x + r2.width) - x;
        const height = Math.max(r1.y + r1.height, r2.y + r2.height) - y;
        return { x, y, width, height };
    }

    static rectangleIntersectionBounds(r1, r2) {
        const x = Math.max(r1.x, r2.x);
        const y = Math.max(r1.y, r2.y);
        const width = Math.min(r1.x + r1.width, r2.x + r2.width) - x;
        const height = Math.min(r1.y + r1.height, r2.y + r2.height) - y;
        if (width <= 0 || height <= 0) return null;
        return { x, y, width, height };
    }

    static lineIntersection(p1, p2, p3, p4) {
        const d1x = p2.x - p1.x;
        const d1y = p2.y - p1.y;
        const d2x = p4.x - p3.x;
        const d2y = p4.y - p3.y;
        const cross = d1x * d2y - d1y * d2x;

        if (Math.abs(cross) < 0.000001) return null;

        const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / cross;
        const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / cross;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: p1.x + t * d1x,
                y: p1.y + t * d1y,
                t,
                u
            };
        }
        return null;
    }

    static lineIntersectsRectangle(x1, y1, x2, y2, rx, ry, rw, rh) {
        const edges = [
            { x: rx, y: ry, x2: rx + rw, y2: ry },
            { x: rx + rw, y: ry, x2: rx + rw, y2: ry + rh },
            { x: rx + rw, y: ry + rh, x2: rx, y2: ry + rh },
            { x: rx, y: ry + rh, x2: rx, y2: ry }
        ];

        for (const edge of edges) {
            const intersection = VexelGeometry.lineIntersection(
                { x: x1, y: y1 },
                { x: x2, y: y2 },
                { x: edge.x, y: edge.y },
                { x: edge.x2, y: edge.y2 }
            );
            if (intersection) return intersection;
        }

        return null;
    }

    static distanceToLine(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSquared = dx * dx + dy * dy;

        if (lengthSquared === 0) {
            return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        }

        let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t));

        const projX = x1 + t * dx;
        const projY = y1 + t * dy;

        return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    }

    static distanceToRectangle(px, py, rx, ry, rw, rh) {
        const cx = Math.max(rx, Math.min(px, rx + rw));
        const cy = Math.max(ry, Math.min(py, ry + rh));
        return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
    }

    static distanceToEllipse(px, py, cx, cy, rx, ry) {
        if (rx <= 0 || ry <= 0) return Infinity;

        const dx = (px - cx) / rx;
        const dy = (py - cy) / ry;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= 1) return 0;

        const angle = Math.atan2(dy, dx);
        const ex = cx + rx * Math.cos(angle);
        const ey = cy + ry * Math.sin(angle);

        return Math.sqrt((px - ex) ** 2 + (py - ey) ** 2);
    }

    static hitTestRectangle(px, py, rx, ry, rw, rh, strokeWidth = 0) {
        if (strokeWidth <= 0) {
            return VexelGeometry.pointInRectangle(px, py, rx, ry, rw, rh);
        }

        const inner = VexelGeometry.pointInRectangle(px, py, rx, ry, rw, rh);
        if (inner) {
            const innerCheck = VexelGeometry.pointInRectangle(
                px, py,
                rx + strokeWidth, ry + strokeWidth,
                rw - strokeWidth * 2, rh - strokeWidth * 2
            );
            return !innerCheck;
        }

        return false;
    }

    static hitTestEllipse(px, py, cx, cy, rx, ry, strokeWidth = 0) {
        if (strokeWidth <= 0) {
            return VexelGeometry.pointInEllipse(px, py, cx, cy, rx, ry);
        }

        const inner = VexelGeometry.pointInEllipse(px, py, cx, cy, rx, ry);
        if (inner) {
            const innerCheck = VexelGeometry.pointInEllipse(
                px, py, cx, cy,
                rx - strokeWidth, ry - strokeWidth
            );
            return !innerCheck;
        }

        return false;
    }

    static hitTestLine(px, py, x1, y1, x2, y2, threshold = 5) {
        return VexelGeometry.distanceToLine(px, py, x1, y1, x2, y2) <= threshold;
    }

    static hitTestPolygon(px, py, vertices, strokeWidth = 0) {
        if (strokeWidth <= 0) {
            return VexelGeometry.pointInPolygon(px, py, vertices);
        }

        const inner = VexelGeometry.pointInPolygon(px, py, vertices);
        if (inner) {
            const innerVertices = VexelGeometry.offsetPolygon(vertices, -strokeWidth);
            if (innerVertices) {
                return !VexelGeometry.pointInPolygon(px, py, innerVertices);
            }
        }

        for (let i = 0; i < vertices.length; i++) {
            const v1 = vertices[i];
            const v2 = vertices[(i + 1) % vertices.length];
            if (VexelGeometry.hitTestLine(px, py, v1.x, v1.y, v2.x, v2.y, strokeWidth)) {
                return true;
            }
        }

        return false;
    }

    static offsetPolygon(vertices, offset) {
        if (vertices.length < 3) return null;

        const result = [];
        for (let i = 0; i < vertices.length; i++) {
            const prev = vertices[(i - 1 + vertices.length) % vertices.length];
            const curr = vertices[i];
            const next = vertices[(i + 1) % vertices.length];

            const dx1 = curr.x - prev.x;
            const dy1 = curr.y - prev.y;
            const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1;
            const nx1 = -dy1 / len1;
            const ny1 = dx1 / len1;

            const dx2 = next.x - curr.x;
            const dy2 = next.y - curr.y;
            const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
            const nx2 = -dy2 / len2;
            const ny2 = dx2 / len2;

            const nx = (nx1 + nx2) / 2;
            const ny = (ny1 + ny2) / 2;
            const nLen = Math.sqrt(nx * nx + ny * ny) || 1;

            result.push({
                x: curr.x + (nx / nLen) * offset,
                y: curr.y + (ny / nLen) * offset
            });
        }

        return result;
    }

    static convexHull(points) {
        if (points.length <= 3) return [...points];

        const unique = [...new Map(points.map(p => [`${p.x},${p.y}`, p])).values()];
        if (unique.length <= 3) return unique;

        unique.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);

        const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

        const lower = [];
        for (const p of unique) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
                lower.pop();
            }
            lower.push(p);
        }

        const upper = [];
        for (let i = unique.length - 1; i >= 0; i--) {
            const p = unique[i];
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
                upper.pop();
            }
            upper.push(p);
        }

        upper.pop();
        lower.pop();

        return [...lower, ...upper];
    }

    static polygonArea(vertices) {
        let area = 0;
        for (let i = 0; i < vertices.length; i++) {
            const j = (i + 1) % vertices.length;
            area += vertices[i].x * vertices[j].y;
            area -= vertices[j].x * vertices[i].y;
        }
        return Math.abs(area) / 2;
    }

    static polygonCentroid(vertices) {
        let cx = 0, cy = 0;
        const area = VexelGeometry.polygonArea(vertices);

        if (area === 0) {
            const sumX = vertices.reduce((s, v) => s + v.x, 0);
            const sumY = vertices.reduce((s, v) => s + v.y, 0);
            return { x: sumX / vertices.length, y: sumY / vertices.length };
        }

        for (let i = 0; i < vertices.length; i++) {
            const j = (i + 1) % vertices.length;
            const cross = vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
            cx += (vertices[i].x + vertices[j].x) * cross;
            cy += (vertices[i].y + vertices[j].y) * cross;
        }

        const factor = 1 / (6 * area);
        return { x: cx * factor, y: cy * factor };
    }

    static polygonPerimeter(vertices) {
        let perimeter = 0;
        for (let i = 0; i < vertices.length; i++) {
            const j = (i + 1) % vertices.length;
            perimeter += Math.sqrt(
                (vertices[j].x - vertices[i].x) ** 2 +
                (vertices[j].y - vertices[i].y) ** 2
            );
        }
        return perimeter;
    }

    static simplifyPolygon(vertices, tolerance = 1) {
        if (vertices.length <= 2) return [...vertices];

        let maxDistance = 0;
        let maxIndex = 0;
        const first = vertices[0];
        const last = vertices[vertices.length - 1];

        for (let i = 1; i < vertices.length - 1; i++) {
            const distance = VexelGeometry.distanceToLine(
                vertices[i].x, vertices[i].y,
                first.x, first.y,
                last.x, last.y
            );
            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = i;
            }
        }

        if (maxDistance > tolerance) {
            const left = VexelGeometry.simplifyPolygon(vertices.slice(0, maxIndex + 1), tolerance);
            const right = VexelGeometry.simplifyPolygon(vertices.slice(maxIndex), tolerance);
            return [...left.slice(0, -1), ...right];
        }

        return [first, last];
    }

    static smoothPolygon(vertices, iterations = 3) {
        let result = [...vertices];
        for (let iter = 0; iter < iterations; iter++) {
            const smoothed = [result[0]];
            for (let i = 1; i < result.length - 1; i++) {
                smoothed.push({
                    x: (result[i - 1].x + result[i].x + result[i + 1].x) / 3,
                    y: (result[i - 1].y + result[i].y + result[i + 1].y) / 3
                });
            }
            smoothed.push(result[result.length - 1]);
            result = smoothed;
        }
        return result;
    }

    static boundingBox(points) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of points) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
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

    static rotatePoints(points, center, angle) {
        return points.map(p => VexelGeometry.rotatePoint(p, center, angle));
    }

    static scalePoints(points, center, sx, sy) {
        return points.map(p => ({
            x: center.x + (p.x - center.x) * sx,
            y: center.y + (p.y - center.y) * (sy || sx)
        }));
    }

    static translatePoints(points, dx, dy) {
        return points.map(p => ({ x: p.x + dx, y: p.y + dy }));
    }

    static regularPolygon(cx, cy, sides, radius, startAngle = -Math.PI / 2) {
        const points = [];
        for (let i = 0; i < sides; i++) {
            const angle = startAngle + (i * 2 * Math.PI) / sides;
            points.push({
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius
            });
        }
        return points;
    }

    static star(cx, cy, points, outerRadius, innerRadius, startAngle = -Math.PI / 2) {
        const vertices = [];
        for (let i = 0; i < points * 2; i++) {
            const angle = startAngle + (i * Math.PI) / points;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            vertices.push({
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius
            });
        }
        return vertices;
    }

    static roundedRectangle(x, y, w, h, r) {
        const maxR = Math.min(w, h) / 2;
        r = Math.min(r, maxR);

        if (r <= 0) {
            return [
                { x, y },
                { x: x + w, y },
                { x: x + w, y: y + h },
                { x, y: y + h }
            ];
        }

        const steps = Math.max(4, Math.ceil(r / 2));
        const points = [];

        for (let i = 0; i <= steps; i++) {
            const angle = (Math.PI / 2) * (i / steps);
            points.push({ x: x + w - r + r * Math.cos(angle), y: y + r - r * Math.sin(angle) });
        }
        for (let i = 0; i <= steps; i++) {
            const angle = (Math.PI / 2) * (i / steps) + Math.PI / 2;
            points.push({ x: x + w - r + r * Math.cos(angle), y: y + h - r + r * Math.sin(angle) });
        }
        for (let i = 0; i <= steps; i++) {
            const angle = (Math.PI / 2) * (i / steps) + Math.PI;
            points.push({ x: x + r + r * Math.cos(angle), y: y + h - r + r * Math.sin(angle) });
        }
        for (let i = 0; i <= steps; i++) {
            const angle = (Math.PI / 2) * (i / steps) + (3 * Math.PI) / 2;
            points.push({ x: x + r + r * Math.cos(angle), y: y + r + r * Math.sin(angle) });
        }

        return points;
    }
}

if (typeof window !== 'undefined') {
    window.VexelGeometry = VexelGeometry;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelGeometry;
}
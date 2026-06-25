// src/boolean/union.js

class VexelBoolean {
    static union(shapes) {
        if (!shapes || shapes.length === 0) return null;
        if (shapes.length === 1) return shapes[0].clone();

        const polygons = shapes.map(s => VexelBoolean._shapeToPolygon(s));
        let result = polygons[0];

        for (let i = 1; i < polygons.length; i++) {
            result = VexelBoolean._unionTwo(result, polygons[i]);
        }

        return VexelBoolean._polygonToShape(result, shapes[0]);
    }

    static subtract(baseShape, subtractShape) {
        const basePoly = VexelBoolean._shapeToPolygon(baseShape);
        const subPoly = VexelBoolean._shapeToPolygon(subtractShape);

        const result = VexelBoolean._subtractPolygons(basePoly, subPoly);
        return result.length > 0 ? VexelBoolean._polygonToShape(result[0], baseShape) : null;
    }

    static intersect(shapes) {
        if (!shapes || shapes.length === 0) return null;
        if (shapes.length === 1) return shapes[0].clone();

        const polygons = shapes.map(s => VexelBoolean._shapeToPolygon(s));
        let result = polygons[0];

        for (let i = 1; i < polygons.length; i++) {
            result = VexelBoolean._intersectTwo(result, polygons[i]);
            if (!result || result.length === 0) return null;
        }

        return VexelBoolean._polygonToShape(result, shapes[0]);
    }

    static exclude(shapeA, shapeB) {
        const intersection = VexelBoolean.intersect([shapeA, shapeB]);
        if (!intersection) return [shapeA.clone(), shapeB.clone()];

        const withoutA = VexelBoolean.subtract(shapeA, intersection);
        const withoutB = VexelBoolean.subtract(shapeB, intersection);

        const result = [];
        if (withoutA) result.push(withoutA);
        if (withoutB) result.push(withoutB);
        return result;
    }

    static divide(baseShape, dividerShape) {
        const intersection = VexelBoolean.intersect([baseShape, dividerShape]);
        if (!intersection) return [baseShape.clone()];

        const piece1 = intersection;
        const piece2 = VexelBoolean.subtract(baseShape, dividerShape);

        const result = [piece1];
        if (piece2) result.push(piece2);
        return result;
    }

    static _shapeToPolygon(shape) {
        const bounds = shape.getBounds();
        const points = [];

        if (shape.type === 'rectangle') {
            const x = bounds.x;
            const y = bounds.y;
            const w = bounds.width;
            const h = bounds.height;

            if (shape.cornerRadius && shape.cornerRadius > 0) {
                const r = shape.cornerRadius;
                const steps = 8;
                for (let i = 0; i < steps; i++) {
                    const angle = (Math.PI / 2) * (i / (steps - 1));
                    points.push({ x: x + w - r + r * Math.cos(angle), y: y + r - r * Math.sin(angle) });
                }
                for (let i = 0; i < steps; i++) {
                    const angle = (Math.PI / 2) * (i / (steps - 1)) + Math.PI / 2;
                    points.push({ x: x + w - r + r * Math.cos(angle), y: y + h - r + r * Math.sin(angle) });
                }
                for (let i = 0; i < steps; i++) {
                    const angle = (Math.PI / 2) * (i / (steps - 1)) + Math.PI;
                    points.push({ x: x + r + r * Math.cos(angle), y: y + h - r + r * Math.sin(angle) });
                }
                for (let i = 0; i < steps; i++) {
                    const angle = (Math.PI / 2) * (i / (steps - 1)) + (3 * Math.PI) / 2;
                    points.push({ x: x + r + r * Math.cos(angle), y: y + r + r * Math.sin(angle) });
                }
            } else {
                points.push({ x, y });
                points.push({ x: x + w, y });
                points.push({ x: x + w, y: y + h });
                points.push({ x, y: y + h });
            }
        } else if (shape.type === 'ellipse') {
            const cx = bounds.x + bounds.width / 2;
            const cy = bounds.y + bounds.height / 2;
            const rx = bounds.width / 2;
            const ry = bounds.height / 2;
            const steps = 64;
            for (let i = 0; i < steps; i++) {
                const angle = (i * 2 * Math.PI) / steps;
                points.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
            }
        } else if (shape.type === 'polygon') {
            for (let i = 0; i < shape.sides; i++) {
                const angle = (i * 2 * Math.PI) / shape.sides - Math.PI / 2;
                points.push({
                    x: shape.x + Math.cos(angle) * shape.radius,
                    y: shape.y + Math.sin(angle) * shape.radius
                });
            }
        } else {
            points.push({ x: bounds.x, y: bounds.y });
            points.push({ x: bounds.x + bounds.width, y: bounds.y });
            points.push({ x: bounds.x + bounds.width, y: bounds.y + bounds.height });
            points.push({ x: bounds.x, y: bounds.y + bounds.height });
        }

        return points;
    }

    static _unionTwo(polyA, polyB) {
        const combined = [...polyA];

        for (const point of polyB) {
            if (!VexelBoolean._isPointInsidePolygon(point, polyA)) {
                combined.push(point);
            }
        }

        return VexelBoolean._convexHull(combined);
    }

    static _subtractPolygons(polyA, polyB) {
        const result = [];
        for (const point of polyA) {
            if (!VexelBoolean._isPointInsidePolygon(point, polyB)) {
                result.push(point);
            }
        }

        if (result.length < 3) return [];

        const hull = VexelBoolean._convexHull(result);

        const clippedPoints = [];
        for (const point of hull) {
            if (!VexelBoolean._isPointInsidePolygon(point, polyB)) {
                clippedPoints.push(point);
            }
        }

        if (clippedPoints.length < 3) return [];

        for (let i = 0; i < polyB.length; i++) {
            const p1 = polyB[i];
            const p2 = polyB[(i + 1) % polyB.length];
            for (let j = 0; j < hull.length; j++) {
                const q1 = hull[j];
                const q2 = hull[(j + 1) % hull.length];
                const intersection = VexelBoolean._lineIntersection(p1, p2, q1, q2);
                if (intersection) {
                    clippedPoints.push(intersection);
                }
            }
        }

        return [VexelBoolean._convexHull(clippedPoints)];
    }

    static _intersectTwo(polyA, polyB) {
        const intersectionPoints = [];

        for (let i = 0; i < polyA.length; i++) {
            const p = polyA[i];
            if (VexelBoolean._isPointInsidePolygon(p, polyB)) {
                intersectionPoints.push(p);
            }
        }

        for (let i = 0; i < polyB.length; i++) {
            const p = polyB[i];
            if (VexelBoolean._isPointInsidePolygon(p, polyA)) {
                intersectionPoints.push(p);
            }
        }

        for (let i = 0; i < polyA.length; i++) {
            const p1 = polyA[i];
            const p2 = polyA[(i + 1) % polyA.length];
            for (let j = 0; j < polyB.length; j++) {
                const q1 = polyB[j];
                const q2 = polyB[(j + 1) % polyB.length];
                const intersection = VexelBoolean._lineIntersection(p1, p2, q1, q2);
                if (intersection) {
                    intersectionPoints.push(intersection);
                }
            }
        }

        if (intersectionPoints.length < 3) return [];

        return VexelBoolean._convexHull(intersectionPoints);
    }

    static _isPointInsidePolygon(point, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x;
            const yi = polygon[i].y;
            const xj = polygon[j].x;
            const yj = polygon[j].y;

            if ((yi > point.y) !== (yj > point.y) &&
                point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
                inside = !inside;
            }
        }
        return inside;
    }

    static _lineIntersection(p1, p2, p3, p4) {
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
                y: p1.y + t * d1y
            };
        }
        return null;
    }

    static _convexHull(points) {
        if (points.length <= 3) return points;

        points = [...new Set(points.map(p => `${p.x},${p.y}`))].map(s => {
            const [x, y] = s.split(',');
            return { x: parseFloat(x), y: parseFloat(y) };
        });

        if (points.length <= 3) return points;

        points.sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);

        const lower = [];
        for (const p of points) {
            while (lower.length >= 2 && VexelBoolean._cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
                lower.pop();
            }
            lower.push(p);
        }

        const upper = [];
        for (let i = points.length - 1; i >= 0; i--) {
            const p = points[i];
            while (upper.length >= 2 && VexelBoolean._cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
                upper.pop();
            }
            upper.push(p);
        }

        upper.pop();
        lower.pop();
        return [...lower, ...upper];
    }

    static _cross(o, a, b) {
        return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    }

    static _polygonToShape(polygon, template) {
        if (!polygon || polygon.length < 3) return null;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of polygon) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }

        const path = new VexelPath(polygon, {
            closed: true,
            fill: template.fill,
            stroke: template.stroke,
            strokeWidth: template.strokeWidth,
            opacity: template.opacity
        });

        return path;
    }
}

if (typeof window !== 'undefined') {
    window.VexelBoolean = VexelBoolean;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelBoolean;
}
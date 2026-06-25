// src/path-engine/bezier.js

class VexelBezier {
    static cubic(p0, p1, p2, p3, t) {
        const u = 1 - t;
        const tt = t * t;
        const uu = u * u;
        const uuu = uu * u;
        const ttt = tt * t;

        return {
            x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
            y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
        };
    }

    static cubicDerivative(p0, p1, p2, p3, t) {
        const u = 1 - t;
        const tt = t * t;
        const uu = u * u;

        return {
            x: 3 * uu * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * tt * (p3.x - p2.x),
            y: 3 * uu * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * tt * (p3.y - p2.y)
        };
    }

    static cubicTangent(p0, p1, p2, p3, t) {
        const d = VexelBezier.cubicDerivative(p0, p1, p2, p3, t);
        const len = Math.sqrt(d.x * d.x + d.y * d.y);
        if (len === 0) return { x: 0, y: 0 };
        return { x: d.x / len, y: d.y / len };
    }

    static cubicNormal(p0, p1, p2, p3, t) {
        const tangent = VexelBezier.cubicTangent(p0, p1, p2, p3, t);
        return { x: -tangent.y, y: tangent.x };
    }

    static cubicLength(p0, p1, p2, p3, segments = 100) {
        let length = 0;
        let prev = VexelBezier.cubic(p0, p1, p2, p3, 0);
        for (let i = 1; i <= segments; i++) {
            const curr = VexelBezier.cubic(p0, p1, p2, p3, i / segments);
            length += Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
            prev = curr;
        }
        return length;
    }

    static cubicPointAtDistance(p0, p1, p2, p3, distance, segments = 100) {
        let traveled = 0;
        let prev = VexelBezier.cubic(p0, p1, p2, p3, 0);
        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const curr = VexelBezier.cubic(p0, p1, p2, p3, t);
            const segLen = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
            if (traveled + segLen >= distance) {
                const remaining = distance - traveled;
                const fraction = segLen > 0 ? remaining / segLen : 0;
                const prevT = (i - 1) / segments;
                return VexelBezier.cubic(p0, p1, p2, p3, prevT + fraction * (1 / segments));
            }
            traveled += segLen;
            prev = curr;
        }
        return VexelBezier.cubic(p0, p1, p2, p3, 1);
    }

    static cubicBoundingBox(p0, p1, p2, p3) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const points = [p0, p1, p2, p3];
        for (const p of points) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
        for (let t = 0; t <= 1; t += 0.01) {
            const p = VexelBezier.cubic(p0, p1, p2, p3, t);
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    static cubicSplit(p0, p1, p2, p3, t) {
        const q0 = { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
        const q1 = { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
        const q2 = { x: p2.x + (p3.x - p2.x) * t, y: p2.y + (p3.y - p2.y) * t };
        const r0 = { x: q0.x + (q1.x - q0.x) * t, y: q0.y + (q1.y - q0.y) * t };
        const r1 = { x: q1.x + (q2.x - q1.x) * t, y: q1.y + (q2.y - q1.y) * t };
        const s = { x: r0.x + (r1.x - r0.x) * t, y: r0.y + (r1.y - r0.y) * t };

        return {
            left: { p0, p1: q0, p2: r0, p3: s },
            right: { p0: s, p1: r1, p2: q2, p3 }
        };
    }

    static cubicToPoints(p0, p1, p2, p3, segments = 50) {
        const points = [];
        for (let i = 0; i <= segments; i++) {
            points.push(VexelBezier.cubic(p0, p1, p2, p3, i / segments));
        }
        return points;
    }

    static cubicFromPoints(points) {
        if (points.length < 2) return null;
        if (points.length === 2) {
            const mid = {
                x: (points[0].x + points[1].x) / 2,
                y: (points[0].y + points[1].y) / 2
            };
            return {
                p0: points[0],
                p1: { x: (points[0].x + mid.x) / 2, y: (points[0].y + mid.y) / 2 },
                p2: { x: (mid.x + points[1].x) / 2, y: (mid.y + points[1].y) / 2 },
                p3: points[1]
            };
        }

        const result = [];
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p3 = points[i + 1];
            const p1 = { x: p0.x + (p3.x - p0.x) * 0.33, y: p0.y + (p3.y - p0.y) * 0.33 };
            const p2 = { x: p0.x + (p3.x - p0.x) * 0.66, y: p0.y + (p3.y - p0.y) * 0.66 };
            result.push({ p0, p1, p2, p3 });
        }
        return result;
    }

    static cubicOffset(p0, p1, p2, p3, distance, segments = 50) {
        const points = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const point = VexelBezier.cubic(p0, p1, p2, p3, t);
            const normal = VexelBezier.cubicNormal(p0, p1, p2, p3, t);
            points.push({
                x: point.x + normal.x * distance,
                y: point.y + normal.y * distance
            });
        }
        return points;
    }

    static quadratic(p0, p1, p2, t) {
        const u = 1 - t;
        return {
            x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
            y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
        };
    }

    static quadraticToCubic(p0, p1, p2) {
        return {
            p0,
            p1: { x: p0.x + (2 / 3) * (p1.x - p0.x), y: p0.y + (2 / 3) * (p1.y - p0.y) },
            p2: { x: p2.x + (2 / 3) * (p1.x - p2.x), y: p2.y + (2 / 3) * (p1.y - p2.y) },
            p3: p2
        };
    }

    static arcToCubic(cx, cy, rx, ry, startAngle, endAngle) {
        const curves = [];
        const angleDiff = endAngle - startAngle;
        const segments = Math.ceil(Math.abs(angleDiff) / (Math.PI / 2));

        for (let i = 0; i < segments; i++) {
            const a1 = startAngle + (angleDiff * i) / segments;
            const a2 = startAngle + (angleDiff * (i + 1)) / segments;
            const da = (a2 - a1) / 2;

            const p0 = {
                x: cx + rx * Math.cos(a1),
                y: cy + ry * Math.sin(a1)
            };
            const p3 = {
                x: cx + rx * Math.cos(a2),
                y: cy + ry * Math.sin(a2)
            };

            const alpha = Math.sin(da) * (Math.sqrt(4 + 3 * Math.tan(da) * Math.tan(da)) - 1) / 3;

            const p1 = {
                x: p0.x - alpha * rx * Math.sin(a1),
                y: p0.y + alpha * ry * Math.cos(a1)
            };
            const p2 = {
                x: p3.x + alpha * rx * Math.sin(a2),
                y: p3.y - alpha * ry * Math.cos(a2)
            };

            curves.push({ p0, p1, p2, p3 });
        }
        return curves;
    }

    static intersectCubicCubic(a0, a1, a2, a3, b0, b1, b2, b3) {
        const intersections = [];
        const steps = 100;

        let prevAx = a0.x, prevAy = a0.y;
        for (let i = 1; i <= steps; i++) {
            const ta = i / steps;
            const currA = VexelBezier.cubic(a0, a1, a2, a3, ta);

            let prevBx = b0.x, prevBy = b0.y;
            for (let j = 1; j <= steps; j++) {
                const tb = j / steps;
                const currB = VexelBezier.cubic(b0, b1, b2, b3, tb);

                const d1x = currA.x - prevAx;
                const d1y = currA.y - prevAy;
                const d2x = currB.x - prevBx;
                const d2y = currB.y - prevBy;

                const cross = d1x * d2y - d1y * d2x;
                if (Math.abs(cross) > 0.0001) {
                    const t = ((prevBx - prevAx) * d2y - (prevBy - prevAy) * d2x) / cross;
                    const u = ((prevBx - prevAx) * d1y - (prevBy - prevAy) * d1x) / cross;

                    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
                        intersections.push({
                            x: prevAx + t * d1x,
                            y: prevAy + t * d1y,
                            t: (i - 1 + t) / steps,
                            u: (j - 1 + u) / steps
                        });
                    }
                }

                prevBx = currB.x;
                prevBy = currB.y;
            }
            prevAx = currA.x;
            prevAy = currA.y;
        }

        return intersections;
    }

    static simplifyPath(points, tolerance = 1.0) {
        if (points.length <= 2) return points;

        let maxDistance = 0;
        let maxIndex = 0;
        const first = points[0];
        const last = points[points.length - 1];

        for (let i = 1; i < points.length - 1; i++) {
            const distance = VexelBezier._pointToLineDistance(points[i], first, last);
            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = i;
            }
        }

        if (maxDistance > tolerance) {
            const left = VexelBezier.simplifyPath(points.slice(0, maxIndex + 1), tolerance);
            const right = VexelBezier.simplifyPath(points.slice(maxIndex), tolerance);
            return [...left.slice(0, -1), ...right];
        }

        return [first, last];
    }

    static _pointToLineDistance(point, lineStart, lineEnd) {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const lengthSquared = dx * dx + dy * dy;

        if (lengthSquared === 0) {
            return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
        }

        let t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t));

        const projX = lineStart.x + t * dx;
        const projY = lineStart.y + t * dy;

        return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
    }

    static smoothPoints(points, iterations = 3) {
        let result = [...points];
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

    static normalizePath(points, totalPoints = 100) {
        if (points.length < 2) return points;
        let totalLength = 0;
        const lengths = [0];
        for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i - 1].x;
            const dy = points[i].y - points[i - 1].y;
            totalLength += Math.sqrt(dx * dx + dy * dy);
            lengths.push(totalLength);
        }

        const result = [points[0]];
        for (let i = 1; i < totalPoints - 1; i++) {
            const targetDist = (totalLength * i) / (totalPoints - 1);
            let segIndex = 0;
            while (segIndex < lengths.length - 1 && lengths[segIndex + 1] < targetDist) {
                segIndex++;
            }
            const segLen = lengths[segIndex + 1] - lengths[segIndex];
            const t = segLen > 0 ? (targetDist - lengths[segIndex]) / segLen : 0;
            result.push({
                x: points[segIndex].x + (points[segIndex + 1].x - points[segIndex].x) * t,
                y: points[segIndex].y + (points[segIndex + 1].y - points[segIndex].y) * t
            });
        }
        result.push(points[points.length - 1]);
        return result;
    }
}

if (typeof window !== 'undefined') {
    window.VexelBezier = VexelBezier;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelBezier;
}
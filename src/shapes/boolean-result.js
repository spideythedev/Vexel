// src/shapes/boolean-result.js

class VexelBooleanResult {
    constructor(resultShape, sourceShapes = [], operation = 'union') {
        this.type = 'boolean-result';
        this.id = `boolean_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.result = resultShape;
        this.sourceShapes = sourceShapes;
        this.operation = operation;
        this.x = resultShape.x || 0;
        this.y = resultShape.y || 0;
        this.width = resultShape.width || 0;
        this.height = resultShape.height || 0;
        this.rotation = 0;
        this.scaleX = 1;
        this.scaleY = 1;
        this.opacity = 1;
        this.visible = true;
        this.locked = false;
        this.fill = sourceShapes[0] ? sourceShapes[0].fill || '#000000' : '#000000';
        this.stroke = sourceShapes[0] ? sourceShapes[0].stroke || 'none' : 'none';
        this.strokeWidth = sourceShapes[0] ? sourceShapes[0].strokeWidth || 1 : 1;
        this.name = `Boolean ${operation}`;
        this._cachedBounds = null;
        this._dirty = true;
    }

    draw(ctx) {
        if (!this.visible || !this.result) return;

        ctx.save();
        ctx.globalAlpha = this.opacity;

        if (this.fill && this.fill !== 'transparent') {
            ctx.fillStyle = this.fill;
            this.result.draw(ctx);
            ctx.fill();
        }

        if (this.stroke && this.stroke !== 'none') {
            ctx.strokeStyle = this.stroke;
            ctx.lineWidth = this.strokeWidth;
            this.result.draw(ctx);
            ctx.stroke();
        }

        ctx.restore();
    }

    getBounds() {
        if (!this._dirty && this._cachedBounds) return this._cachedBounds;

        if (this.result) {
            const b = this.result.getBounds();
            this._cachedBounds = {
                x: b.x,
                y: b.y,
                width: b.width,
                height: b.height
            };
        } else {
            this._cachedBounds = { x: this.x, y: this.y, width: this.width, height: this.height };
        }

        this._dirty = false;
        return this._cachedBounds;
    }

    containsPoint(px, py) {
        if (!this.result || !this.result.points) return false;
        return VexelGeometry.pointInPolygon(px, py, this.result.points);
    }

    setFill(color) {
        this.fill = color;
    }

    setStroke(color, width) {
        this.stroke = color;
        if (width !== undefined) this.strokeWidth = width;
    }

    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, opacity));
    }

    updateResult(newResult) {
        this.result = newResult;
        this._dirty = true;
    }

    serialize() {
        return {
            type: this.type,
            id: this.id,
            operation: this.operation,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            rotation: this.rotation,
            scaleX: this.scaleX,
            scaleY: this.scaleY,
            opacity: this.opacity,
            visible: this.visible,
            fill: this.fill,
            stroke: this.stroke,
            strokeWidth: this.strokeWidth,
            name: this.name,
            sourceShapeIds: this.sourceShapes.map(s => s.id),
            resultShape: this.result ? this.result.serialize() : null
        };
    }

    static deserialize(data, shapeMap) {
        const sourceShapes = (data.sourceShapeIds || [])
            .map(id => shapeMap ? shapeMap.get(id) : null)
            .filter(Boolean);

        let resultShape = null;
        if (data.resultShape && data.resultShape.type === 'path') {
            resultShape = VexelPath.deserialize(data.resultShape);
        }

        const booleanResult = new VexelBooleanResult(resultShape, sourceShapes, data.operation);
        booleanResult.id = data.id;
        booleanResult.x = data.x;
        booleanResult.y = data.y;
        booleanResult.width = data.width;
        booleanResult.height = data.height;
        booleanResult.opacity = data.opacity;
        booleanResult.visible = data.visible;
        booleanResult.fill = data.fill;
        booleanResult.stroke = data.stroke;
        booleanResult.strokeWidth = data.strokeWidth;
        booleanResult.name = data.name;

        return booleanResult;
    }

    clone() {
        const resultClone = this.result ? this.result.clone() : null;
        return new VexelBooleanResult(resultClone, [...this.sourceShapes], this.operation);
    }

    toSVG() {
        if (!this.result) return '';
        return this.result.toSVG();
    }
}

class VexelBooleanEngine {
    constructor(vexel) {
        this.vexel = vexel;
    }

    union(shapes) {
        if (!shapes || shapes.length === 0) return null;
        if (shapes.length === 1) return shapes[0].clone();

        const polygons = shapes.map(s => this._shapeToPolygon(s));
        let result = polygons[0];

        for (let i = 1; i < polygons.length; i++) {
            result = this._unionPolygons(result, polygons[i]);
        }

        if (!result || result.length < 3) return null;

        const path = new VexelPath(result, {
            closed: true,
            fill: shapes[0].fill,
            stroke: shapes[0].stroke,
            strokeWidth: shapes[0].strokeWidth,
            opacity: shapes[0].opacity
        });

        return new VexelBooleanResult(path, shapes, 'union');
    }

    subtract(baseShape, subtractShape) {
        const basePoly = this._shapeToPolygon(baseShape);
        const subPoly = this._shapeToPolygon(subtractShape);

        const result = this._subtractPolygons(basePoly, subPoly);

        if (!result || result.length < 3) return null;

        const path = new VexelPath(result[0], {
            closed: true,
            fill: baseShape.fill,
            stroke: baseShape.stroke,
            strokeWidth: baseShape.strokeWidth,
            opacity: baseShape.opacity
        });

        return new VexelBooleanResult(path, [baseShape, subtractShape], 'subtract');
    }

    intersect(shapes) {
        if (!shapes || shapes.length === 0) return null;
        if (shapes.length === 1) return shapes[0].clone();

        const polygons = shapes.map(s => this._shapeToPolygon(s));
        let result = polygons[0];

        for (let i = 1; i < polygons.length; i++) {
            result = this._intersectPolygons(result, polygons[i]);
            if (!result || result.length < 3) return null;
        }

        const path = new VexelPath(result, {
            closed: true,
            fill: shapes[0].fill,
            stroke: shapes[0].stroke,
            strokeWidth: shapes[0].strokeWidth,
            opacity: shapes[0].opacity
        });

        return new VexelBooleanResult(path, shapes, 'intersect');
    }

    exclude(shapeA, shapeB) {
        const intersection = this.intersect([shapeA, shapeB]);
        if (!intersection || !intersection.result) return [shapeA.clone(), shapeB.clone()];

        const aMinusB = this.subtract(shapeA, shapeB);
        const bMinusA = this.subtract(shapeB, shapeA);

        const results = [];
        if (aMinusB) results.push(aMinusB);
        if (bMinusA) results.push(bMinusA);
        return results;
    }

    _shapeToPolygon(shape) {
        if (shape.type === 'path' || shape.type === 'boolean-result') {
            return shape.points || shape.result?.points || [];
        }

        const bounds = shape.getBounds();

        if (shape.type === 'rectangle' && shape.cornerRadius > 0) {
            return VexelGeometry.roundedRectangle(
                bounds.x, bounds.y,
                bounds.width, bounds.height,
                shape.cornerRadius
            );
        }

        if (shape.type === 'ellipse') {
            const cx = bounds.x + bounds.width / 2;
            const cy = bounds.y + bounds.height / 2;
            const rx = bounds.width / 2;
            const ry = bounds.height / 2;
            const points = [];
            const steps = 64;
            for (let i = 0; i < steps; i++) {
                const angle = (i * 2 * Math.PI) / steps;
                points.push({
                    x: cx + rx * Math.cos(angle),
                    y: cy + ry * Math.sin(angle)
                });
            }
            return points;
        }

        if (shape.type === 'polygon') {
            return VexelGeometry.regularPolygon(
                shape.x, shape.y,
                shape.sides,
                shape.radius
            );
        }

        return [
            { x: bounds.x, y: bounds.y },
            { x: bounds.x + bounds.width, y: bounds.y },
            { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
            { x: bounds.x, y: bounds.y + bounds.height }
        ];
    }

    _unionPolygons(polyA, polyB) {
        const combined = [...polyA];
        for (const point of polyB) {
            if (!VexelGeometry.pointInPolygon(point.x, point.y, polyA)) {
                combined.push(point);
            }
        }
        return VexelGeometry.convexHull(combined);
    }

    _subtractPolygons(polyA, polyB) {
        const result = [];
        for (const point of polyA) {
            if (!VexelGeometry.pointInPolygon(point.x, point.y, polyB)) {
                result.push(point);
            }
        }
        if (result.length < 3) return [];
        return [VexelGeometry.convexHull(result)];
    }

    _intersectPolygons(polyA, polyB) {
        const result = [];
        for (const point of polyA) {
            if (VexelGeometry.pointInPolygon(point.x, point.y, polyB)) {
                result.push(point);
            }
        }
        for (const point of polyB) {
            if (VexelGeometry.pointInPolygon(point.x, point.y, polyA)) {
                result.push(point);
            }
        }
        if (result.length < 3) return [];
        return VexelGeometry.convexHull(result);
    }
}

if (typeof window !== 'undefined') {
    window.VexelBooleanResult = VexelBooleanResult;
    window.VexelBooleanEngine = VexelBooleanEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VexelBooleanResult, VexelBooleanEngine };
}
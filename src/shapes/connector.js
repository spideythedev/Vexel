// src/shapes/connector.js

class VexelConnector {
    constructor(options = {}) {
        this.type = 'connector';
        this.id = options.id || `connector_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = options.name || 'Connector';
        this.startShape = options.startShape || null;
        this.endShape = options.endShape || null;
        this.startPoint = options.startPoint || null;
        this.endPoint = options.endPoint || null;
        this.startAnchor = options.startAnchor || 'auto';
        this.endAnchor = options.endAnchor || 'auto';
        this.style = options.style || 'straight';
        this.stroke = options.stroke || '#000000';
        this.strokeWidth = options.strokeWidth || 2;
        this.strokeDash = options.strokeDash || [];
        this.opacity = options.opacity !== undefined ? options.opacity : 1;
        this.visible = options.visible !== false;
        this.arrowStart = options.arrowStart || false;
        this.arrowEnd = options.arrowEnd || false;
        this.arrowSize = options.arrowSize || 10;
        this.cornerRadius = options.cornerRadius || 0;
        this.label = options.label || '';
        this.labelOffset = options.labelOffset || 10;
        this.waypoints = options.waypoints || [];
        this._cachedPath = null;
        this._dirty = true;
    }

    draw(ctx) {
        if (!this.visible) return;

        const start = this._getStartPoint();
        const end = this._getEndPoint();

        if (!start || !end) return;

        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.strokeStyle = this.stroke;
        ctx.lineWidth = this.strokeWidth;
        ctx.setLineDash(this.strokeDash);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        const path = this._buildPath(start, end);
        ctx.stroke();
        ctx.setLineDash([]);

        if (this.arrowStart) {
            this._drawArrow(ctx, start, this._getFirstDirection(path), false);
        }

        if (this.arrowEnd) {
            this._drawArrow(ctx, end, this._getLastDirection(path), true);
        }

        if (this.label) {
            const mid = this._getMidPoint(path);
            ctx.fillStyle = this.stroke;
            ctx.font = '12px -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.label, mid.x, mid.y - this.labelOffset);
        }

        ctx.restore();
    }

    _getStartPoint() {
        if (this.startPoint) return this.startPoint;
        if (this.startShape) {
            return this._getAnchorPoint(this.startShape, this.startAnchor, false);
        }
        return null;
    }

    _getEndPoint() {
        if (this.endPoint) return this.endPoint;
        if (this.endShape) {
            return this._getAnchorPoint(this.endShape, this.endAnchor, true);
        }
        return null;
    }

    _getAnchorPoint(shape, anchor, isEnd) {
        const bounds = shape.getBounds();
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;

        if (anchor === 'auto') {
            const start = isEnd ? this._getStartPoint() : this._getEndPoint();
            if (!start) return { x: cx, y: cy };

            const dx = start.x - cx;
            const dy = start.y - cy;

            if (Math.abs(dx) > Math.abs(dy)) {
                return dx > 0
                    ? { x: bounds.x + bounds.width, y: cy }
                    : { x: bounds.x, y: cy };
            } else {
                return dy > 0
                    ? { x: cx, y: bounds.y + bounds.height }
                    : { x: cx, y: bounds.y };
            }
        }

        switch (anchor) {
            case 'top': return { x: cx, y: bounds.y };
            case 'bottom': return { x: cx, y: bounds.y + bounds.height };
            case 'left': return { x: bounds.x, y: cy };
            case 'right': return { x: bounds.x + bounds.width, y: cy };
            case 'top-left': return { x: bounds.x, y: bounds.y };
            case 'top-right': return { x: bounds.x + bounds.width, y: bounds.y };
            case 'bottom-left': return { x: bounds.x, y: bounds.y + bounds.height };
            case 'bottom-right': return { x: bounds.x + bounds.width, y: bounds.y + bounds.height };
            case 'center': return { x: cx, y: cy };
            default: return { x: cx, y: cy };
        }
    }

    _buildPath(start, end) {
        const ctx = this._getContext();
        ctx.beginPath();

        if (this.style === 'straight') {
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
        } else if (this.style === 'step') {
            const midX = (start.x + end.x) / 2;
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(midX, start.y);
            ctx.lineTo(midX, end.y);
            ctx.lineTo(end.x, end.y);
        } else if (this.style === 'step-horizontal') {
            const midY = (start.y + end.y) / 2;
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(start.x, midY);
            ctx.lineTo(end.x, midY);
            ctx.lineTo(end.x, end.y);
        } else if (this.style === 'curve') {
            const cp1x = start.x + Math.abs(end.x - start.x) * 0.5;
            const cp1y = start.y;
            const cp2x = end.x - Math.abs(end.x - start.x) * 0.5;
            const cp2y = end.y;
            ctx.moveTo(start.x, start.y);
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, end.x, end.y);
        } else if (this.style === 'rounded') {
            const radius = Math.min(this.cornerRadius, Math.abs(end.x - start.x) / 2, Math.abs(end.y - start.y) / 2);
            const midX = (start.x + end.x) / 2;
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(midX - radius, start.y);
            ctx.arcTo(midX, start.y, midX, start.y + radius, radius);
            ctx.lineTo(midX, end.y - radius);
            ctx.arcTo(midX, end.y, midX + radius, end.y, radius);
            ctx.lineTo(end.x, end.y);
        }

        return { start, end };
    }

    _drawArrow(ctx, point, direction, isEnd) {
        const angle = Math.atan2(direction.y, direction.x);
        const size = this.arrowSize;
        const sign = isEnd ? -1 : 1;

        const tipX = point.x + Math.cos(angle) * size * sign;
        const tipY = point.y + Math.sin(angle) * size * sign;
        const leftX = tipX + Math.cos(angle + Math.PI * 0.8) * size;
        const leftY = tipY + Math.sin(angle + Math.PI * 0.8) * size;
        const rightX = tipX + Math.cos(angle - Math.PI * 0.8) * size;
        const rightY = tipY + Math.sin(angle - Math.PI * 0.8) * size;

        ctx.fillStyle = this.stroke;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(leftX, leftY);
        ctx.lineTo(rightX, rightY);
        ctx.closePath();
        ctx.fill();
    }

    _getFirstDirection(path) {
        return { x: path.end.x - path.start.x, y: path.end.y - path.start.y };
    }

    _getLastDirection(path) {
        return { x: path.start.x - path.end.x, y: path.start.y - path.end.y };
    }

    _getMidPoint(path) {
        return {
            x: (path.start.x + path.end.x) / 2,
            y: (path.start.y + path.end.y) / 2
        };
    }

    _getContext() {
        return this._ctx || this.vexel?.ctx || document.createElement('canvas').getContext('2d');
    }

    getBounds() {
        const start = this._getStartPoint();
        const end = this._getEndPoint();

        if (!start || !end) return { x: 0, y: 0, width: 0, height: 0 };

        return {
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
            width: Math.abs(end.x - start.x),
            height: Math.abs(end.y - start.y)
        };
    }

    containsPoint(px, py) {
        const start = this._getStartPoint();
        const end = this._getEndPoint();
        if (!start || !end) return false;

        const threshold = Math.max(this.strokeWidth + 5, 10);
        const dist = VexelGeometry.distanceToLine(px, py, start.x, start.y, end.x, end.y);
        return dist <= threshold;
    }

    setStartShape(shape, anchor = 'auto') {
        this.startShape = shape;
        this.startPoint = null;
        this.startAnchor = anchor;
        this._dirty = true;
    }

    setEndShape(shape, anchor = 'auto') {
        this.endShape = shape;
        this.endPoint = null;
        this.endAnchor = anchor;
        this._dirty = true;
    }

    setStartPoint(point) {
        this.startPoint = point;
        this.startShape = null;
        this._dirty = true;
    }

    setEndPoint(point) {
        this.endPoint = point;
        this.endShape = null;
        this._dirty = true;
    }

    addWaypoint(point) {
        this.waypoints.push(point);
        this._dirty = true;
    }

    removeWaypoint(index) {
        this.waypoints.splice(index, 1);
        this._dirty = true;
    }

    update() {
        this._dirty = true;
        if (this.startShape || this.endShape) {
            this._cachedPath = null;
        }
    }

    serialize() {
        return {
            type: this.type,
            id: this.id,
            name: this.name,
            startShapeId: this.startShape ? this.startShape.id : null,
            endShapeId: this.endShape ? this.endShape.id : null,
            startPoint: this.startPoint,
            endPoint: this.endPoint,
            startAnchor: this.startAnchor,
            endAnchor: this.endAnchor,
            style: this.style,
            stroke: this.stroke,
            strokeWidth: this.strokeWidth,
            strokeDash: this.strokeDash,
            opacity: this.opacity,
            visible: this.visible,
            arrowStart: this.arrowStart,
            arrowEnd: this.arrowEnd,
            arrowSize: this.arrowSize,
            cornerRadius: this.cornerRadius,
            label: this.label,
            labelOffset: this.labelOffset,
            waypoints: this.waypoints
        };
    }

    static deserialize(data, shapeMap) {
        const connector = new VexelConnector({
            id: data.id,
            name: data.name,
            startShape: shapeMap ? shapeMap.get(data.startShapeId) : null,
            endShape: shapeMap ? shapeMap.get(data.endShapeId) : null,
            startPoint: data.startPoint,
            endPoint: data.endPoint,
            startAnchor: data.startAnchor,
            endAnchor: data.endAnchor,
            style: data.style,
            stroke: data.stroke,
            strokeWidth: data.strokeWidth,
            strokeDash: data.strokeDash,
            opacity: data.opacity,
            visible: data.visible,
            arrowStart: data.arrowStart,
            arrowEnd: data.arrowEnd,
            arrowSize: data.arrowSize,
            cornerRadius: data.cornerRadius,
            label: data.label,
            labelOffset: data.labelOffset,
            waypoints: data.waypoints || []
        });
        return connector;
    }

    clone() {
        return VexelConnector.deserialize(this.serialize());
    }
}

if (typeof window !== 'undefined') {
    window.VexelConnector = VexelConnector;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelConnector;
}
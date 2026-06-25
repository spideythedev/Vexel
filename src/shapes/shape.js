// src/shapes/shape.js

class VexelShape {
    constructor(options = {}) {
        this.type = 'shape';
        this.id = options.id || this._generateId();
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.width = options.width || 0;
        this.height = options.height || 0;
        this.rotation = options.rotation || 0;
        this.scaleX = options.scaleX || 1;
        this.scaleY = options.scaleY || 1;
        this.opacity = options.opacity !== undefined ? options.opacity : 1;
        this.visible = options.visible !== false;
        this.locked = options.locked || false;
        this.name = options.name || '';
        this.fill = options.fill || 'transparent';
        this.fillOpacity = options.fillOpacity !== undefined ? options.fillOpacity : 1;
        this.stroke = options.stroke || 'none';
        this.strokeWidth = options.strokeWidth || 1;
        this.strokeOpacity = options.strokeOpacity !== undefined ? options.strokeOpacity : 1;
        this.strokeCap = options.strokeCap || 'butt';
        this.strokeJoin = options.strokeJoin || 'miter';
        this.strokeDash = options.strokeDash || [];
        this.strokeDashOffset = options.strokeDashOffset || 0;
        this.shadow = options.shadow || null;
        this.blur = options.blur || 0;
        this.blendMode = options.blendMode || 'normal';
        this.clipPath = options.clipPath || null;
        this.mask = options.mask || null;
        this.effects = options.effects || [];
        this.metadata = options.metadata || {};
        this._transform = {
            matrix: [1, 0, 0, 1, 0, 0],
            pivotX: 0,
            pivotY: 0
        };
    }

    _generateId() {
        return `${this.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    applyStyle(ctx) {
        ctx.globalAlpha = this.opacity;

        if (this.blendMode !== 'normal') {
            ctx.globalCompositeOperation = this.blendMode;
        }

        if (this.shadow) {
            ctx.shadowColor = this.shadow.color || 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = this.shadow.blur || 0;
            ctx.shadowOffsetX = this.shadow.offsetX || 0;
            ctx.shadowOffsetY = this.shadow.offsetY || 0;
        }

        if (this.blur > 0) {
            ctx.filter = `blur(${this.blur}px)`;
        }
    }

    resetStyle(ctx) {
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.filter = 'none';
    }

    applyFill(ctx) {
        if (this.fill === 'transparent' || this.fillOpacity === 0) return;

        ctx.fillStyle = this.fill;
        const originalAlpha = ctx.globalAlpha;
        ctx.globalAlpha = originalAlpha * this.fillOpacity;

        if (this.mask) {
            ctx.save();
            this.mask.applyPath(ctx);
            ctx.clip();
            ctx.fill();
            ctx.restore();
        } else {
            ctx.fill();
        }

        ctx.globalAlpha = originalAlpha;
    }

    applyStroke(ctx) {
        if (this.stroke === 'none' || this.strokeWidth === 0 || this.strokeOpacity === 0) return;

        ctx.strokeStyle = this.stroke;
        ctx.lineWidth = this.strokeWidth;
        ctx.lineCap = this.strokeCap;
        ctx.lineJoin = this.strokeJoin;
        ctx.setLineDash(this.strokeDash);
        ctx.lineDashOffset = this.strokeDashOffset;

        const originalAlpha = ctx.globalAlpha;
        ctx.globalAlpha = originalAlpha * this.strokeOpacity;
        ctx.stroke();
        ctx.globalAlpha = originalAlpha;

        ctx.setLineDash([]);
    }

    beginDraw(ctx) {
        ctx.save();
        this.applyStyle(ctx);

        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.scale(this.scaleX, this.scaleY);
        ctx.translate(-cx, -cy);
    }

    endDraw(ctx) {
        this.resetStyle(ctx);
        ctx.restore();
    }

    transform(tx, ty, sx, sy, rotation, ox, oy) {
        if (tx !== undefined) this.x += tx;
        if (ty !== undefined) this.y += ty;
        if (sx !== undefined) this.scaleX *= sx;
        if (sy !== undefined) this.scaleY *= sy;
        if (rotation !== undefined) this.rotation += rotation;

        const pivotX = ox !== undefined ? ox : this.x + this.width / 2;
        const pivotY = oy !== undefined ? oy : this.y + this.height / 2;

        const cos = Math.cos((rotation || 0) * Math.PI / 180);
        const sin = Math.sin((rotation || 0) * Math.PI / 180);

        const dx = this.x - pivotX;
        const dy = this.y - pivotY;

        this.x = pivotX + dx * cos - dy * sin;
        this.y = pivotY + dx * sin + dy * cos;
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    setSize(width, height) {
        this.width = width;
        this.height = height;
    }

    setRotation(angle) {
        this.rotation = angle % 360;
    }

    setScale(sx, sy) {
        this.scaleX = sx;
        this.scaleY = sy || sx;
    }

    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, opacity));
    }

    setFill(color) {
        this.fill = color;
    }

    setStroke(color, width) {
        this.stroke = color;
        if (width !== undefined) this.strokeWidth = width;
    }

    setShadow(color, blur, offsetX, offsetY) {
        this.shadow = {
            color: color || 'rgba(0,0,0,0.3)',
            blur: blur || 4,
            offsetX: offsetX || 0,
            offsetY: offsetY || 2
        };
    }

    removeShadow() {
        this.shadow = null;
    }

    setBlur(amount) {
        this.blur = Math.max(0, amount);
    }

    setBlendMode(mode) {
        const validModes = [
            'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
            'color-dodge', 'color-burn', 'hard-light', 'soft-light',
            'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'
        ];
        if (validModes.includes(mode)) {
            this.blendMode = mode;
        }
    }

    setClipPath(shape) {
        this.clipPath = shape;
    }

    removeClipPath() {
        this.clipPath = null;
    }

    setMask(shape) {
        this.mask = shape;
    }

    removeMask() {
        this.mask = null;
    }

    addEffect(effect) {
        this.effects.push(effect);
    }

    removeEffect(index) {
        this.effects.splice(index, 1);
    }

    clearEffects() {
        this.effects = [];
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width * this.scaleX,
            height: this.height * this.scaleY
        };
    }

    getCenter() {
        return {
            x: this.x + (this.width * this.scaleX) / 2,
            y: this.y + (this.height * this.scaleY) / 2
        };
    }

    containsPoint(px, py) {
        const bounds = this.getBounds();
        return (
            px >= bounds.x &&
            px <= bounds.x + bounds.width &&
            py >= bounds.y &&
            py <= bounds.y + bounds.height
        );
    }

    intersects(shape) {
        const a = this.getBounds();
        const b = shape.getBounds();
        return !(
            a.x + a.width < b.x ||
            b.x + b.width < a.x ||
            a.y + a.height < b.y ||
            b.y + b.height < a.y
        );
    }

    clone() {
        const data = this.serialize();
        return this.constructor.deserialize(data);
    }

    serialize() {
        return {
            type: this.type,
            id: this.id,
            x: this.x, y: this.y,
            width: this.width, height: this.height,
            rotation: this.rotation,
            scaleX: this.scaleX, scaleY: this.scaleY,
            opacity: this.opacity,
            visible: this.visible,
            locked: this.locked,
            name: this.name,
            fill: this.fill,
            fillOpacity: this.fillOpacity,
            stroke: this.stroke,
            strokeWidth: this.strokeWidth,
            strokeOpacity: this.strokeOpacity,
            strokeCap: this.strokeCap,
            strokeJoin: this.strokeJoin,
            strokeDash: this.strokeDash,
            strokeDashOffset: this.strokeDashOffset,
            shadow: this.shadow,
            blur: this.blur,
            blendMode: this.blendMode,
            effects: this.effects,
            metadata: this.metadata
        };
    }

    static deserialize(data) {
        return new VexelShape(data);
    }

    toJSON() {
        return JSON.stringify(this.serialize());
    }

    static fromJSON(json) {
        const data = typeof json === 'string' ? JSON.parse(json) : json;
        return VexelShape.deserialize(data);
    }
}

if (typeof window !== 'undefined') {
    window.VexelShape = VexelShape;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelShape;
}
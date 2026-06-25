// src/shapes/group.js

class VexelGroup {
    constructor(shapes = [], options = {}) {
        this.type = 'group';
        this.id = options.id || `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.shapes = shapes || [];
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
        this.name = options.name || 'Group';
        this.fill = options.fill || 'transparent';
        this.stroke = options.stroke || 'none';
        this.strokeWidth = options.strokeWidth || 1;
        this.blendMode = options.blendMode || 'normal';
        this.clipShapes = options.clipShapes || false;
        this.expanded = options.expanded !== false;
        this._cachedBounds = null;
        this._boundsDirty = true;
    }

    add(shape) {
        if (!this.shapes.includes(shape)) {
            this.shapes.push(shape);
            this._boundsDirty = true;
        }
        return this;
    }

    remove(shape) {
        const index = this.shapes.indexOf(shape);
        if (index > -1) {
            this.shapes.splice(index, 1);
            this._boundsDirty = true;
            return true;
        }
        return false;
    }

    removeAt(index) {
        if (index >= 0 && index < this.shapes.length) {
            this.shapes.splice(index, 1);
            this._boundsDirty = true;
            return true;
        }
        return false;
    }

    removeAll() {
        this.shapes = [];
        this._boundsDirty = true;
    }

    get(index) {
        return this.shapes[index] || null;
    }

    indexOf(shape) {
        return this.shapes.indexOf(shape);
    }

    contains(shape) {
        return this.shapes.includes(shape);
    }

    get length() {
        return this.shapes.length;
    }

    get count() {
        return this.shapes.length;
    }

    isEmpty() {
        return this.shapes.length === 0;
    }

    bringToFront(shape) {
        const index = this.shapes.indexOf(shape);
        if (index > -1) {
            this.shapes.splice(index, 1);
            this.shapes.push(shape);
            this._boundsDirty = true;
        }
    }

    sendToBack(shape) {
        const index = this.shapes.indexOf(shape);
        if (index > -1) {
            this.shapes.splice(index, 1);
            this.shapes.unshift(shape);
            this._boundsDirty = true;
        }
    }

    bringForward(shape) {
        const index = this.shapes.indexOf(shape);
        if (index < this.shapes.length - 1) {
            this.shapes.splice(index, 1);
            this.shapes.splice(index + 1, 0, shape);
            this._boundsDirty = true;
        }
    }

    sendBackward(shape) {
        const index = this.shapes.indexOf(shape);
        if (index > 0) {
            this.shapes.splice(index, 1);
            this.shapes.splice(index - 1, 0, shape);
            this._boundsDirty = true;
        }
    }

    draw(ctx) {
        if (!this.visible || this.opacity === 0 || this.shapes.length === 0) return;

        ctx.save();

        ctx.globalAlpha = (ctx.globalAlpha || 1) * this.opacity;

        if (this.blendMode !== 'normal') {
            ctx.globalCompositeOperation = this.blendMode;
        }

        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        ctx.translate(cx, cy);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.scale(this.scaleX, this.scaleY);
        ctx.translate(-cx, -cy);

        if (this.clipShapes) {
            ctx.save();
            for (const shape of this.shapes) {
                if (shape.visible !== false) {
                    shape.draw(ctx);
                }
            }
            ctx.clip();
        }

        for (const shape of this.shapes) {
            if (shape.visible !== false) {
                shape.draw(ctx);
            }
        }

        if (this.clipShapes) {
            ctx.restore();
        }

        if (this.stroke && this.stroke !== 'none') {
            const bounds = this.getBounds();
            ctx.strokeStyle = this.stroke;
            ctx.lineWidth = this.strokeWidth;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
            ctx.setLineDash([]);
        }

        ctx.restore();
    }

    getBounds() {
        if (!this._boundsDirty && this._cachedBounds) {
            return this._cachedBounds;
        }

        if (this.shapes.length === 0) {
            this._cachedBounds = { x: this.x, y: this.y, width: this.width, height: this.height };
            this._boundsDirty = false;
            return this._cachedBounds;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        for (const shape of this.shapes) {
            const b = shape.getBounds();
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
        }

        this._cachedBounds = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };

        this.x = minX;
        this.y = minY;
        this.width = maxX - minX;
        this.height = maxY - minY;
        this._boundsDirty = false;

        return this._cachedBounds;
    }

    getCenter() {
        const bounds = this.getBounds();
        return {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2
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

    setPosition(x, y) {
        const bounds = this.getBounds();
        const dx = x - bounds.x;
        const dy = y - bounds.y;

        for (const shape of this.shapes) {
            shape.x += dx;
            shape.y += dy;
        }

        this.x = x;
        this.y = y;
        this._boundsDirty = true;
    }

    setSize(width, height) {
        const bounds = this.getBounds();
        const sx = bounds.width > 0 ? width / bounds.width : 1;
        const sy = bounds.height > 0 ? height / bounds.height : 1;

        for (const shape of this.shapes) {
            shape.x = bounds.x + (shape.x - bounds.x) * sx;
            shape.y = bounds.y + (shape.y - bounds.y) * sy;
            if (shape.width) shape.width *= sx;
            if (shape.height) shape.height *= sy;
        }

        this._boundsDirty = true;
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

    translate(dx, dy) {
        for (const shape of this.shapes) {
            shape.x += dx;
            shape.y += dy;
        }
        this.x += dx;
        this.y += dy;
        this._boundsDirty = true;
    }

    ungroup() {
        return [...this.shapes];
    }

    clone() {
        const clonedShapes = this.shapes.map(s => s.clone());
        return new VexelGroup(clonedShapes, {
            x: this.x,
            y: this.y,
            rotation: this.rotation,
            scaleX: this.scaleX,
            scaleY: this.scaleY,
            opacity: this.opacity,
            visible: this.visible,
            locked: this.locked,
            name: `${this.name} (copy)`,
            blendMode: this.blendMode,
            clipShapes: this.clipShapes
        });
    }

    serialize() {
        return {
            type: this.type,
            id: this.id,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            rotation: this.rotation,
            scaleX: this.scaleX,
            scaleY: this.scaleY,
            opacity: this.opacity,
            visible: this.visible,
            locked: this.locked,
            name: this.name,
            fill: this.fill,
            stroke: this.stroke,
            strokeWidth: this.strokeWidth,
            blendMode: this.blendMode,
            clipShapes: this.clipShapes,
            shapes: this.shapes.map(s => s.serialize())
        };
    }

    static deserialize(data) {
        const shapes = [];
        const constructors = {
            rectangle: 'VexelRectangle',
            ellipse: 'VexelEllipse',
            polygon: 'VexelPolygon',
            line: 'VexelLine',
            path: 'VexelPath',
            text: 'VexelText',
            image: 'VexelImage',
            group: 'VexelGroup'
        };

        if (data.shapes) {
            for (const shapeData of data.shapes) {
                const className = constructors[shapeData.type];
                if (className && typeof window !== 'undefined' && window[className]) {
                    const Ctor = window[className];
                    if (Ctor.deserialize) {
                        shapes.push(Ctor.deserialize(shapeData));
                    }
                }
            }
        }

        return new VexelGroup(shapes, {
            id: data.id,
            x: data.x,
            y: data.y,
            rotation: data.rotation,
            scaleX: data.scaleX,
            scaleY: data.scaleY,
            opacity: data.opacity,
            visible: data.visible,
            locked: data.locked,
            name: data.name,
            blendMode: data.blendMode,
            clipShapes: data.clipShapes
        });
    }

    toSVG() {
        let svg = `<g id="${this.id}" transform="translate(${this.x} ${this.y}) rotate(${this.rotation}) scale(${this.scaleX} ${this.scaleY})" opacity="${this.opacity}">`;
        for (const shape of this.shapes) {
            if (shape.toSVG) {
                svg += shape.toSVG();
            }
        }
        svg += '</g>';
        return svg;
    }
}

class VexelSymbol {
    constructor(options = {}) {
        this.id = options.id || `symbol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = options.name || 'Symbol';
        this.shapes = options.shapes || [];
        this.instances = [];
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.width = options.width || 100;
        this.height = options.height || 100;
    }

    addShape(shape) {
        this.shapes.push(shape);
        this._syncInstances();
    }

    removeShape(shape) {
        const index = this.shapes.indexOf(shape);
        if (index > -1) {
            this.shapes.splice(index, 1);
            this._syncInstances();
        }
    }

    createInstance(x, y) {
        const group = new VexelGroup(this.shapes.map(s => s.clone()), {
            name: `${this.name} instance`,
            x: x || 0,
            y: y || 0
        });
        group._symbolId = this.id;
        this.instances.push(group);
        return group;
    }

    detach(instance) {
        const index = this.instances.indexOf(instance);
        if (index > -1) {
            this.instances.splice(index, 1);
            instance._symbolId = null;
        }
    }

    _syncInstances() {
        for (const instance of this.instances) {
            instance.shapes = this.shapes.map(s => s.clone());
        }
    }

    getBounds() {
        if (this.shapes.length === 0) {
            return { x: this.x, y: this.y, width: this.width, height: this.height };
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const shape of this.shapes) {
            const b = shape.getBounds();
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    serialize() {
        return {
            type: 'symbol',
            id: this.id,
            name: this.name,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            shapes: this.shapes.map(s => s.serialize()),
            instanceCount: this.instances.length
        };
    }

    static deserialize(data) {
        const shapes = [];
        const constructors = {
            rectangle: 'VexelRectangle',
            ellipse: 'VexelEllipse',
            polygon: 'VexelPolygon',
            line: 'VexelLine',
            path: 'VexelPath',
            text: 'VexelText',
            image: 'VexelImage'
        };

        if (data.shapes) {
            for (const shapeData of data.shapes) {
                const className = constructors[shapeData.type];
                if (className && typeof window !== 'undefined' && window[className]) {
                    const Ctor = window[className];
                    if (Ctor.deserialize) {
                        shapes.push(Ctor.deserialize(shapeData));
                    }
                }
            }
        }

        return new VexelSymbol({
            id: data.id,
            name: data.name,
            x: data.x,
            y: data.y,
            width: data.width,
            height: data.height,
            shapes
        });
    }
}

if (typeof window !== 'undefined') {
    window.VexelGroup = VexelGroup;
    window.VexelSymbol = VexelSymbol;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VexelGroup, VexelSymbol };
}
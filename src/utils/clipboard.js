// src/utils/clipboard.js

class VexelClipboardManager {
    constructor(vexel) {
        this.vexel = vexel;
        this.items = [];
        this.maxItems = 20;
        this.externalClipboardEnabled = true;
        this.includeStyles = true;
        this.offsetIncrement = { x: 20, y: 20 };
        this.currentOffset = { x: 0, y: 0 };
    }

    copy(shapes) {
        const shapeList = Array.isArray(shapes) ? shapes : [shapes];
        if (shapeList.length === 0) return null;

        const data = {
            shapes: shapeList.map(s => s.serialize()),
            count: shapeList.length,
            timestamp: Date.now()
        };

        this.items.push(data);
        if (this.items.length > this.maxItems) {
            this.items.shift();
        }

        this.currentOffset = { x: 0, y: 0 };

        if (this.externalClipboardEnabled && typeof navigator !== 'undefined') {
            try {
                const json = JSON.stringify(data.shapes);
                navigator.clipboard.writeText(json).catch(() => {});
            } catch (e) {}
        }

        return data;
    }

    cut(shapes) {
        const data = this.copy(shapes);
        if (!data) return null;

        const shapeList = Array.isArray(shapes) ? shapes : [shapes];
        this.vexel.history.startBatch('Cut Shapes');

        for (const shape of shapeList) {
            const index = this.vexel.shapes.indexOf(shape);
            if (index > -1) {
                this.vexel.shapes.splice(index, 1);
            }
            this.vexel.deselect(shape);
        }

        this.vexel.history.endBatch();
        this.vexel.dirty = true;
        return data;
    }

    paste(x, y) {
        if (this.items.length === 0) {
            return this._pasteFromExternalClipboard(x, y);
        }

        const lastItem = this.items[this.items.length - 1];
        const newShapes = [];
        const baseShape = lastItem.shapes[0];

        const offsetX = x !== undefined ? x - baseShape.x : this.currentOffset.x + this.offsetIncrement.x;
        const offsetY = y !== undefined ? y - baseShape.y : this.currentOffset.y + this.offsetIncrement.y;

        this.vexel.history.startBatch('Paste Shapes');

        for (const shapeData of lastItem.shapes) {
            const shape = this._deserializeShape(shapeData);
            if (!shape) continue;

            shape.id = this._generateId(shape.type);
            shape.x = shapeData.x + offsetX;
            shape.y = shapeData.y + offsetY;

            if (!this.includeStyles) {
                shape.fill = 'transparent';
                shape.stroke = '#000000';
                shape.strokeWidth = 1;
            }

            this.vexel.shapes.push(shape);
            newShapes.push(shape);
        }

        this.vexel.history.endBatch();

        this.vexel.deselectAll();
        for (const shape of newShapes) {
            this.vexel.select(shape);
        }

        if (x === undefined && y === undefined) {
            this.currentOffset.x += this.offsetIncrement.x;
            this.currentOffset.y += this.offsetIncrement.y;
        } else {
            this.currentOffset = { x: 0, y: 0 };
        }

        this.vexel.dirty = true;
        return newShapes;
    }

    pasteInPlace() {
        if (this.items.length === 0) return [];

        const lastItem = this.items[this.items.length - 1];
        const baseShape = lastItem.shapes[0];
        return this.paste(baseShape.x, baseShape.y);
    }

    pasteOver() {
        if (this.items.length === 0) return [];

        const lastItem = this.items[this.items.length - 1];
        const baseShape = lastItem.shapes[0];
        return this.paste(
            baseShape.x + (baseShape.width || 100) + 20,
            baseShape.y
        );
    }

    duplicate(shapes) {
        const shapeList = Array.isArray(shapes) ? shapes : [shapes];
        if (shapeList.length === 0) return [];

        this.vexel.history.startBatch('Duplicate Shapes');

        const newShapes = [];
        const offsetX = this.offsetIncrement.x;
        const offsetY = this.offsetIncrement.y;

        for (const shape of shapeList) {
            const cloned = shape.clone();
            cloned.id = this._generateId(shape.type);
            cloned.x += offsetX;
            cloned.y += offsetY;

            this.vexel.shapes.push(cloned);
            newShapes.push(cloned);
        }

        this.vexel.history.endBatch();

        this.vexel.deselectAll();
        for (const shape of newShapes) {
            this.vexel.select(shape);
        }

        this.vexel.dirty = true;
        return newShapes;
    }

    _pasteFromExternalClipboard(x, y) {
        return [];
    }

    _deserializeShape(data) {
        const ctors = {
            rectangle: VexelRectangle,
            ellipse: VexelEllipse,
            polygon: VexelPolygon,
            line: VexelLine,
            path: VexelPath,
            text: VexelText,
            image: VexelImage,
            group: VexelGroup,
            frame: VexelFrame,
            connector: VexelConnector
        };

        const Ctor = ctors[data.type];
        if (Ctor && Ctor.deserialize) {
            return Ctor.deserialize(data);
        }
        return null;
    }

    _generateId(type) {
        return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    hasContent() {
        return this.items.length > 0;
    }

    getItemCount() {
        return this.items.length;
    }

    getLastItem() {
        return this.items.length > 0 ? this.items[this.items.length - 1] : null;
    }

    clear() {
        this.items = [];
        this.currentOffset = { x: 0, y: 0 };
    }

    setMaxItems(max) {
        this.maxItems = Math.max(1, max);
    }

    setOffsetIncrement(dx, dy) {
        this.offsetIncrement = { x: dx, y: dy };
    }

    enableExternalClipboard() {
        this.externalClipboardEnabled = true;
    }

    disableExternalClipboard() {
        this.externalClipboardEnabled = false;
    }

    serialize() {
        return {
            items: this.items,
            currentOffset: this.currentOffset,
            maxItems: this.maxItems,
            includeStyles: this.includeStyles,
            offsetIncrement: this.offsetIncrement
        };
    }

    deserialize(data) {
        if (!data) return;
        this.items = data.items || [];
        this.currentOffset = data.currentOffset || { x: 0, y: 0 };
        this.maxItems = data.maxItems || 20;
        this.includeStyles = data.includeStyles !== false;
        this.offsetIncrement = data.offsetIncrement || { x: 20, y: 20 };
    }
}

if (typeof window !== 'undefined') {
    window.VexelClipboardManager = VexelClipboardManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelClipboardManager;
}
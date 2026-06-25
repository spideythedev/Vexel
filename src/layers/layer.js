// src/layers/layer.js

class VexelLayer {
    constructor(options = {}) {
        this.id = options.id || `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = options.name || 'Layer';
        this.visible = options.visible !== false;
        this.locked = options.locked || false;
        this.opacity = options.opacity !== undefined ? options.opacity : 1;
        this.blendMode = options.blendMode || 'normal';
        this.shapes = options.shapes || [];
        this.parent = options.parent || null;
        this.children = [];
        this.metadata = options.metadata || {};
        this.createdAt = options.createdAt || Date.now();
        this.updatedAt = Date.now();
        this.color = options.color || this._generateColor();
    }

    _generateColor() {
        const colors = ['#FF5722', '#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4', '#E91E63'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    addShape(shape) {
        if (!this.shapes.includes(shape)) {
            this.shapes.push(shape);
            this.updatedAt = Date.now();
        }
    }

    removeShape(shape) {
        const index = this.shapes.indexOf(shape);
        if (index > -1) {
            this.shapes.splice(index, 1);
            this.updatedAt = Date.now();
            return true;
        }
        return false;
    }

    hasShape(shape) {
        return this.shapes.includes(shape);
    }

    clearShapes() {
        this.shapes = [];
        this.updatedAt = Date.now();
    }

    setVisibility(visible) {
        this.visible = visible;
        this.updatedAt = Date.now();
    }

    toggleVisibility() {
        this.visible = !this.visible;
        this.updatedAt = Date.now();
    }

    setLocked(locked) {
        this.locked = locked;
        this.updatedAt = Date.now();
    }

    toggleLocked() {
        this.locked = !this.locked;
        this.updatedAt = Date.now();
    }

    setOpacity(opacity) {
        this.opacity = Math.max(0, Math.min(1, opacity));
        this.updatedAt = Date.now();
    }

    setBlendMode(mode) {
        this.blendMode = mode;
        this.updatedAt = Date.now();
    }

    setName(name) {
        this.name = name;
        this.updatedAt = Date.now();
    }

    getBounds() {
        if (this.shapes.length === 0) return null;

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

    getShapeCount() {
        return this.shapes.length;
    }

    isEmpty() {
        return this.shapes.length === 0;
    }

    draw(ctx) {
        if (!this.visible || this.opacity === 0) return;

        ctx.save();
        ctx.globalAlpha = this.opacity;

        if (this.blendMode !== 'normal') {
            ctx.globalCompositeOperation = this.blendMode;
        }

        for (const shape of this.shapes) {
            if (shape.visible !== false) {
                shape.draw(ctx);
            }
        }

        ctx.restore();
    }

    serialize() {
        return {
            id: this.id,
            name: this.name,
            visible: this.visible,
            locked: this.locked,
            opacity: this.opacity,
            blendMode: this.blendMode,
            color: this.color,
            shapeIds: this.shapes.map(s => s.id),
            metadata: this.metadata,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    static deserialize(data, shapeMap) {
        const layer = new VexelLayer({
            id: data.id,
            name: data.name,
            visible: data.visible,
            locked: data.locked,
            opacity: data.opacity,
            blendMode: data.blendMode,
            color: data.color,
            metadata: data.metadata,
            createdAt: data.createdAt
        });

        if (shapeMap && data.shapeIds) {
            layer.shapes = data.shapeIds
                .map(id => shapeMap.get(id))
                .filter(Boolean);
        }

        return layer;
    }

    clone() {
        return new VexelLayer({
            name: `${this.name} (copy)`,
            visible: this.visible,
            locked: this.locked,
            opacity: this.opacity,
            blendMode: this.blendMode,
            shapes: [...this.shapes]
        });
    }
}

class VexelLayerList {
    constructor(vexel) {
        this.vexel = vexel;
        this.layers = [];
        this.activeLayerId = null;
        this.listeners = [];
    }

    addLayer(options = {}) {
        const layer = new VexelLayer({
            name: options.name || `Layer ${this.layers.length + 1}`,
            ...options
        });

        this.layers.push(layer);

        if (!this.activeLayerId) {
            this.activeLayerId = layer.id;
        }

        this._notify('add', layer);
        return layer;
    }

    removeLayer(layerId) {
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index === -1) return false;

        const layer = this.layers[index];
        this.layers.splice(index, 1);

        if (this.activeLayerId === layerId) {
            this.activeLayerId = this.layers.length > 0 ? this.layers[this.layers.length - 1].id : null;
        }

        this._notify('remove', layer);
        return true;
    }

    getLayer(layerId) {
        return this.layers.find(l => l.id === layerId) || null;
    }

    getActiveLayer() {
        return this.getLayer(this.activeLayerId);
    }

    setActiveLayer(layerId) {
        if (this.getLayer(layerId)) {
            this.activeLayerId = layerId;
            this._notify('activeChange', this.getActiveLayer());
        }
    }

    moveLayer(layerId, newIndex) {
        const currentIndex = this.layers.findIndex(l => l.id === layerId);
        if (currentIndex === -1) return false;

        const layer = this.layers.splice(currentIndex, 1)[0];
        const clampedIndex = Math.max(0, Math.min(newIndex, this.layers.length));
        this.layers.splice(clampedIndex, 0, layer);

        this._notify('reorder', { layer, fromIndex: currentIndex, toIndex: clampedIndex });
        return true;
    }

    moveLayerUp(layerId) {
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index < this.layers.length - 1) {
            return this.moveLayer(layerId, index + 1);
        }
        return false;
    }

    moveLayerDown(layerId) {
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index > 0) {
            return this.moveLayer(layerId, index - 1);
        }
        return false;
    }

    moveToTop(layerId) {
        return this.moveLayer(layerId, this.layers.length - 1);
    }

    moveToBottom(layerId) {
        return this.moveLayer(layerId, 0);
    }

    duplicateLayer(layerId) {
        const layer = this.getLayer(layerId);
        if (!layer) return null;

        const cloned = layer.clone();
        cloned.name = `${layer.name} (copy)`;
        this.layers.push(cloned);
        this._notify('add', cloned);
        return cloned;
    }

    mergeDown(layerId) {
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index <= 0) return false;

        const upper = this.layers[index];
        const lower = this.layers[index - 1];

        for (const shape of upper.shapes) {
            lower.addShape(shape);
        }

        this.removeLayer(upper.id);
        this._notify('merge', { upper, lower });
        return true;
    }

    flatten() {
        const flatLayer = this.addLayer({ name: 'Flattened' });
        for (const layer of this.layers) {
            if (layer.id === flatLayer.id) continue;
            for (const shape of layer.shapes) {
                flatLayer.addShape(shape);
            }
        }

        this.layers = [flatLayer];
        this.activeLayerId = flatLayer.id;
        this._notify('flatten', flatLayer);
        return flatLayer;
    }

    getLayerIndex(layerId) {
        return this.layers.findIndex(l => l.id === layerId);
    }

    getLayerCount() {
        return this.layers.length;
    }

    getVisibleLayers() {
        return this.layers.filter(l => l.visible);
    }

    getLockedLayers() {
        return this.layers.filter(l => l.locked);
    }

    hideAll() {
        for (const layer of this.layers) {
            layer.visible = false;
        }
        this._notify('visibilityChange', null);
    }

    showAll() {
        for (const layer of this.layers) {
            layer.visible = true;
        }
        this._notify('visibilityChange', null);
    }

    lockAll() {
        for (const layer of this.layers) {
            layer.locked = true;
        }
    }

    unlockAll() {
        for (const layer of this.layers) {
            layer.locked = false;
        }
    }

    addShapeToLayer(shape, layerId) {
        const layer = this.getLayer(layerId || this.activeLayerId);
        if (layer) {
            layer.addShape(shape);
            return true;
        }
        return false;
    }

    addShapeToActiveLayer(shape) {
        return this.addShapeToLayer(shape, this.activeLayerId);
    }

    getShapesForLayer(layerId) {
        const layer = this.getLayer(layerId);
        return layer ? [...layer.shapes] : [];
    }

    drawAll(ctx) {
        for (const layer of this.layers) {
            layer.draw(ctx);
        }
    }

    serialize() {
        return this.layers.map(l => l.serialize());
    }

    deserialize(data, shapeMap) {
        this.layers = [];
        for (const layerData of data) {
            const layer = VexelLayer.deserialize(layerData, shapeMap);
            this.layers.push(layer);
        }
        if (this.layers.length > 0) {
            this.activeLayerId = this.layers[this.layers.length - 1].id;
        }
    }

    on(event, callback) {
        this.listeners.push({ event, callback });
    }

    off(event, callback) {
        this.listeners = this.listeners.filter(
            l => !(l.event === event && l.callback === callback)
        );
    }

    _notify(event, data) {
        for (const listener of this.listeners) {
            if (listener.event === event || listener.event === '*') {
                listener.callback(event, data);
            }
        }
    }
}

if (typeof window !== 'undefined') {
    window.VexelLayer = VexelLayer;
    window.VexelLayerList = VexelLayerList;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VexelLayer, VexelLayerList };
}
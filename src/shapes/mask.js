// src/shapes/mask.js

class VexelMask {
    constructor(options = {}) {
        this.id = options.id || `mask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.type = options.type || 'clip';
        this.shape = options.shape || null;
        this.inverted = options.inverted || false;
        this.visible = options.visible !== false;
        this.opacity = options.opacity !== undefined ? options.opacity : 1;
        this.feather = options.feather || 0;
        this.expansion = options.expansion || 0;
    }

    apply(ctx, targetShape) {
        if (!this.shape || !this.visible) return;

        ctx.save();

        this.shape.draw(ctx);

        if (this.type === 'clip') {
            ctx.clip(this.inverted ? 'evenodd' : 'nonzero');
        } else if (this.type === 'alpha') {
            ctx.globalCompositeOperation = this.inverted ? 'destination-out' : 'destination-in';
            ctx.fillStyle = `rgba(0,0,0,${this.opacity})`;
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }

        if (this.feather > 0 && this.type === 'clip') {
            ctx.filter = `blur(${this.feather}px)`;
        }

        if (this.expansion !== 0) {
            const bounds = this.shape.getBounds();
            const cx = bounds.x + bounds.width / 2;
            const cy = bounds.y + bounds.height / 2;
            const sx = (bounds.width + this.expansion * 2) / bounds.width;
            const sy = (bounds.height + this.expansion * 2) / bounds.height;
            ctx.translate(cx, cy);
            ctx.scale(sx, sy);
            ctx.translate(-cx, -cy);
        }

        ctx.restore();
    }

    remove() {
        this.shape = null;
    }

    setShape(shape) {
        this.shape = shape;
    }

    setInverted(inverted) {
        this.inverted = inverted;
    }

    toggleInverted() {
        this.inverted = !this.inverted;
    }

    setType(type) {
        const validTypes = ['clip', 'alpha'];
        if (validTypes.includes(type)) {
            this.type = type;
        }
    }

    setFeather(feather) {
        this.feather = Math.max(0, feather);
    }

    setExpansion(expansion) {
        this.expansion = expansion;
    }

    serialize() {
        return {
            id: this.id,
            type: this.type,
            inverted: this.inverted,
            visible: this.visible,
            opacity: this.opacity,
            feather: this.feather,
            expansion: this.expansion,
            shapeId: this.shape ? this.shape.id : null
        };
    }

    static deserialize(data, shapeMap) {
        const mask = new VexelMask({
            id: data.id,
            type: data.type,
            inverted: data.inverted,
            visible: data.visible,
            opacity: data.opacity,
            feather: data.feather,
            expansion: data.expansion
        });

        if (data.shapeId && shapeMap) {
            mask.shape = shapeMap.get(data.shapeId) || null;
        }

        return mask;
    }

    clone() {
        return new VexelMask({
            type: this.type,
            shape: this.shape ? this.shape.clone() : null,
            inverted: this.inverted,
            visible: this.visible,
            opacity: this.opacity,
            feather: this.feather,
            expansion: this.expansion
        });
    }
}

class VexelMaskManager {
    constructor() {
        this.masks = [];
        this.enabled = true;
    }

    addMask(mask) {
        this.masks.push(mask);
        return mask;
    }

    createMask(shape, options = {}) {
        const mask = new VexelMask({
            shape,
            ...options
        });
        this.masks.push(mask);
        return mask;
    }

    removeMask(maskOrId) {
        const id = typeof maskOrId === 'string' ? maskOrId : maskOrId.id;
        const index = this.masks.findIndex(m => m.id === id);
        if (index > -1) {
            this.masks.splice(index, 1);
            return true;
        }
        return false;
    }

    clearMasks() {
        this.masks = [];
    }

    getMask(id) {
        return this.masks.find(m => m.id === id) || null;
    }

    getMasks() {
        return [...this.masks];
    }

    getVisibleMasks() {
        return this.masks.filter(m => m.visible);
    }

    getCount() {
        return this.masks.length;
    }

    applyAll(ctx, targetShape) {
        if (!this.enabled || this.masks.length === 0) return;

        for (const mask of this.getVisibleMasks()) {
            mask.apply(ctx, targetShape);
        }
    }

    enable() { this.enabled = true; }
    disable() { this.enabled = false; }

    serialize() {
        return this.masks.map(m => m.serialize());
    }

    deserialize(data, shapeMap) {
        this.masks = [];
        for (const maskData of data) {
            const mask = VexelMask.deserialize(maskData, shapeMap);
            if (mask) this.masks.push(mask);
        }
    }
}

class VexelBlendMode {
    static modes = [
        'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
        'color-dodge', 'color-burn', 'hard-light', 'soft-light',
        'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
        'source-over', 'source-in', 'source-out', 'source-atop',
        'destination-over', 'destination-in', 'destination-out', 'destination-atop',
        'xor', 'copy'
    ];

    static isValid(mode) {
        return VexelBlendMode.modes.includes(mode);
    }

    static apply(ctx, mode) {
        if (!mode || mode === 'normal' || mode === 'source-over') {
            return;
        }

        const mapping = {
            'multiply': 'multiply',
            'screen': 'screen',
            'overlay': 'overlay',
            'darken': 'darken',
            'lighten': 'lighten',
            'color-dodge': 'color-dodge',
            'color-burn': 'color-burn',
            'hard-light': 'hard-light',
            'soft-light': 'soft-light',
            'difference': 'difference',
            'exclusion': 'exclusion',
            'hue': 'hue',
            'saturation': 'saturation',
            'color': 'color',
            'luminosity': 'luminosity',
            'source-over': 'source-over',
            'source-in': 'source-in',
            'source-out': 'source-out',
            'source-atop': 'source-atop',
            'destination-over': 'destination-over',
            'destination-in': 'destination-in',
            'destination-out': 'destination-out',
            'destination-atop': 'destination-atop',
            'xor': 'xor',
            'copy': 'copy'
        };

        const canvasMode = mapping[mode];
        if (canvasMode) {
            ctx.globalCompositeOperation = canvasMode;
        }
    }

    static getPreview(mode, foregroundColor = '#FF5722', backgroundColor = '#FFFFFF') {
        const canvas = document.createElement('canvas');
        canvas.width = 60;
        canvas.height = 60;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, 60, 60);

        ctx.fillStyle = foregroundColor;
        ctx.fillRect(15, 15, 30, 30);

        VexelBlendMode.apply(ctx, mode);
        ctx.fillRect(25, 25, 30, 30);

        return canvas.toDataURL();
    }
}

if (typeof window !== 'undefined') {
    window.VexelMask = VexelMask;
    window.VexelMaskManager = VexelMaskManager;
    window.VexelBlendMode = VexelBlendMode;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VexelMask, VexelMaskManager, VexelBlendMode };
}
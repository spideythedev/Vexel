// src/shapes/slice.js

class VexelSlice {
    constructor(options = {}) {
        this.type = 'slice';
        this.id = options.id || `slice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = options.name || 'Slice';
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.width = options.width || 100;
        this.height = options.height || 100;
        this.visible = options.visible !== false;
        this.exportSettings = {
            format: options.format || 'png',
            scale: options.scale || 1,
            quality: options.quality || 100,
            background: options.background || 'transparent',
            suffix: options.suffix || '',
            prefix: options.prefix || ''
        };
    }

    draw(ctx) {
        if (!this.visible) return;

        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#FF5722';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        ctx.fillStyle = 'rgba(255, 87, 34, 0.05)';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.fillStyle = '#FF5722';
        ctx.font = '10px -apple-system, sans-serif';
        const label = `${this.name} (${Math.round(this.width)}×${Math.round(this.height)})`;
        const textWidth = ctx.measureText(label).width;

        ctx.fillStyle = '#FF5722';
        ctx.fillRect(this.x + this.width - textWidth - 16, this.y + this.height - 20, textWidth + 12, 16);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, this.x + this.width - textWidth - 10, this.y + this.height - 8);

        ctx.setLineDash([]);
        ctx.restore();
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    containsPoint(px, py) {
        return px >= this.x && px <= this.x + this.width && py >= this.y && py <= this.y + this.height;
    }

    setExportFormat(format) {
        const validFormats = ['png', 'jpg', 'webp', 'svg', 'pdf'];
        if (validFormats.includes(format)) {
            this.exportSettings.format = format;
        }
    }

    setExportScale(scale) {
        const validScales = [0.5, 1, 1.5, 2, 3, 4];
        if (validScales.includes(scale) || (scale >= 0.1 && scale <= 10)) {
            this.exportSettings.scale = scale;
        }
    }

    setExportQuality(quality) {
        this.exportSettings.quality = Math.max(0, Math.min(100, quality));
    }

    setExportBackground(background) {
        this.exportSettings.background = background;
    }

    setExportSuffix(suffix) {
        this.exportSettings.suffix = suffix;
    }

    setExportPrefix(prefix) {
        this.exportSettings.prefix = prefix;
    }

    getExportFilename(baseName) {
        const { prefix, suffix, format, scale } = this.exportSettings;
        let filename = baseName || this.name.toLowerCase().replace(/\s+/g, '-');

        if (prefix) filename = `${prefix}-${filename}`;
        if (suffix) filename = `${filename}-${suffix}`;
        if (scale > 1) filename = `${filename}@${scale}x`;

        return `${filename}.${format}`;
    }

    async export(vexel, options = {}) {
        const { format, scale, quality, background } = this.exportSettings;
        const exportOptions = { ...options, scale, quality, background };

        switch (format) {
            case 'png':
                return new VexelPNGExport(vexel).export({
                    ...exportOptions,
                    region: { x: this.x, y: this.y, width: this.width, height: this.height }
                });
            case 'jpg':
                return new VexelPNGExport(vexel).export({
                    ...exportOptions,
                    format: 'image/jpeg',
                    region: { x: this.x, y: this.y, width: this.width, height: this.height }
                });
            case 'svg':
                const svg = new VexelSVGExport(vexel).export({
                    ...exportOptions,
                    viewBox: `${this.x} ${this.y} ${this.width} ${this.height}`
                });
                return new Blob([svg], { type: 'image/svg+xml' });
            case 'pdf':
                const pdf = new VexelPDFExport(vexel).export({
                    ...exportOptions,
                    width: this.width,
                    height: this.height
                });
                return new Blob([pdf], { type: 'application/pdf' });
            default:
                return null;
        }
    }

    async download(vexel, baseName) {
        const blob = await this.export(vexel);
        if (!blob) return;

        const filename = this.getExportFilename(baseName);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    serialize() {
        return {
            type: this.type,
            id: this.id,
            name: this.name,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            visible: this.visible,
            exportSettings: { ...this.exportSettings }
        };
    }

    static deserialize(data) {
        return new VexelSlice({
            id: data.id,
            name: data.name,
            x: data.x,
            y: data.y,
            width: data.width,
            height: data.height,
            visible: data.visible,
            format: data.exportSettings?.format,
            scale: data.exportSettings?.scale,
            quality: data.exportSettings?.quality,
            background: data.exportSettings?.background,
            suffix: data.exportSettings?.suffix,
            prefix: data.exportSettings?.prefix
        });
    }

    clone() {
        return VexelSlice.deserialize(this.serialize());
    }
}

class VexelSliceManager {
    constructor(vexel) {
        this.vexel = vexel;
        this.slices = [];
    }

    addSlice(options = {}) {
        const slice = new VexelSlice(options);
        this.slices.push(slice);
        return slice;
    }

    createSliceFromShape(shape, options = {}) {
        const bounds = shape.getBounds();
        return this.addSlice({
            name: options.name || `${shape.name || shape.type} slice`,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            ...options
        });
    }

    createSliceFromSelection(options = {}) {
        if (this.vexel.selectedShapes.length === 0) return null;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const shape of this.vexel.selectedShapes) {
            const b = shape.getBounds();
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
        }

        return this.addSlice({
            name: options.name || 'Selection slice',
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            ...options
        });
    }

    removeSlice(sliceOrId) {
        const id = typeof sliceOrId === 'string' ? sliceOrId : sliceOrId.id;
        const index = this.slices.findIndex(s => s.id === id);
        if (index > -1) {
            this.slices.splice(index, 1);
            return true;
        }
        return false;
    }

    getSlice(id) {
        return this.slices.find(s => s.id === id) || null;
    }

    getAllSlices() {
        return [...this.slices];
    }

    clearSlices() {
        this.slices = [];
    }

    drawAll(ctx) {
        for (const slice of this.slices) {
            slice.draw(ctx);
        }
    }

    async exportAll(baseName = 'export') {
        const results = [];
        for (const slice of this.slices) {
            const blob = await slice.export(this.vexel);
            results.push({
                slice: slice.name,
                filename: slice.getExportFilename(baseName),
                blob,
                success: !!blob
            });
        }
        return results;
    }

    async downloadAll(baseName = 'export') {
        for (const slice of this.slices) {
            await slice.download(this.vexel, baseName);
        }
    }

    serialize() {
        return this.slices.map(s => s.serialize());
    }

    deserialize(data) {
        this.slices = [];
        for (const sliceData of data) {
            this.slices.push(VexelSlice.deserialize(sliceData));
        }
    }
}

if (typeof window !== 'undefined') {
    window.VexelSlice = VexelSlice;
    window.VexelSliceManager = VexelSliceManager;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VexelSlice, VexelSliceManager };
}
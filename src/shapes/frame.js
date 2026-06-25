// src/shapes/frame.js

class VexelFrame {
    constructor(options = {}) {
        this.type = 'frame';
        this.id = options.id || `frame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = options.name || 'Frame';
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.width = options.width || 375;
        this.height = options.height || 812;
        this.rotation = options.rotation || 0;
        this.scaleX = options.scaleX || 1;
        this.scaleY = options.scaleY || 1;
        this.opacity = options.opacity !== undefined ? options.opacity : 1;
        this.visible = options.visible !== false;
        this.locked = options.locked || false;
        this.fill = options.fill || '#ffffff';
        this.stroke = options.stroke || 'none';
        this.strokeWidth = options.strokeWidth || 1;
        this.cornerRadius = options.cornerRadius || 0;
        this.clipsContent = options.clipsContent !== false;
        this.shapes = options.shapes || [];
        this.presets = {
            'iPhone 15': { width: 393, height: 852 },
            'iPhone 15 Pro': { width: 393, height: 852 },
            'iPhone SE': { width: 375, height: 667 },
            'iPad': { width: 810, height: 1080 },
            'iPad Pro': { width: 1024, height: 1366 },
            'MacBook': { width: 1440, height: 900 },
            'Desktop': { width: 1440, height: 1024 },
            'Desktop HD': { width: 1920, height: 1080 },
            'Watch': { width: 198, height: 242 },
            'A4': { width: 595, height: 842 },
            'A3': { width: 842, height: 1191 },
            'Letter': { width: 612, height: 792 },
            'Business Card': { width: 252, height: 144 },
            'Instagram Post': { width: 1080, height: 1080 },
            'Instagram Story': { width: 1080, height: 1920 },
            'Facebook Post': { width: 1200, height: 630 },
            'Twitter Post': { width: 1200, height: 675 },
            'YouTube Thumbnail': { width: 1280, height: 720 },
            'LinkedIn Post': { width: 1200, height: 627 }
        };
        this.layoutMode = options.layoutMode || 'free';
        this.layoutGap = options.layoutGap || 16;
        this.layoutPadding = options.layoutPadding || 16;
        this.layoutDirection = options.layoutDirection || 'vertical';
        this.layoutAlign = options.layoutAlign || 'start';
        this.constraints = options.constraints || {};
        this._cachedBounds = null;
        this._dirty = true;
    }

    static preset(name, options = {}) {
        const frame = new VexelFrame({ name, ...options });
        const size = frame.presets[name];
        if (size) {
            frame.width = size.width;
            frame.height = size.height;
        }
        return frame;
    }

    static getPresets() {
        const frame = new VexelFrame();
        return Object.keys(frame.presets).map(name => ({
            name,
            width: frame.presets[name].width,
            height: frame.presets[name].height
        }));
    }

    add(shape) {
        if (!this.shapes.includes(shape)) {
            this.shapes.push(shape);
            this._dirty = true;
        }
        return this;
    }

    remove(shape) {
        const index = this.shapes.indexOf(shape);
        if (index > -1) {
            this.shapes.splice(index, 1);
            this._dirty = true;
            return true;
        }
        return false;
    }

    draw(ctx) {
        if (!this.visible) return;

        ctx.save();

        ctx.globalAlpha = this.opacity;

        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.scale(this.scaleX, this.scaleY);
        ctx.translate(-cx, -cy);

        if (this.fill && this.fill !== 'transparent') {
            ctx.fillStyle = this.fill;
            if (this.cornerRadius > 0) {
                ctx.beginPath();
                ctx.roundRect(this.x, this.y, this.width, this.height, this.cornerRadius);
                ctx.fill();
            } else {
                ctx.fillRect(this.x, this.y, this.width, this.height);
            }
        }

        if (this.clipsContent && this.shapes.length > 0) {
            ctx.save();
            if (this.cornerRadius > 0) {
                ctx.beginPath();
                ctx.roundRect(this.x, this.y, this.width, this.height, this.cornerRadius);
            } else {
                ctx.beginPath();
                ctx.rect(this.x, this.y, this.width, this.height);
            }
            ctx.clip();
        }

        for (const shape of this.shapes) {
            if (shape.visible !== false) {
                shape.draw(ctx);
            }
        }

        if (this.clipsContent && this.shapes.length > 0) {
            ctx.restore();
        }

        if (this.stroke && this.stroke !== 'none') {
            ctx.strokeStyle = this.stroke;
            ctx.lineWidth = this.strokeWidth;
            if (this.cornerRadius > 0) {
                ctx.beginPath();
                ctx.roundRect(this.x, this.y, this.width, this.height, this.cornerRadius);
                ctx.stroke();
            } else {
                ctx.strokeRect(this.x, this.y, this.width, this.height);
            }
        }

        ctx.restore();
    }

    getBounds() {
        if (!this._dirty && this._cachedBounds) return this._cachedBounds;
        this._cachedBounds = {
            x: this.x,
            y: this.y,
            width: this.width * this.scaleX,
            height: this.height * this.scaleY
        };
        this._dirty = false;
        return this._cachedBounds;
    }

    containsPoint(px, py) {
        const b = this.getBounds();
        return px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height;
    }

    autoLayout() {
        if (this.layoutMode === 'free' || this.shapes.length === 0) return;

        const visible = this.shapes.filter(s => s.visible !== false);
        if (visible.length === 0) return;

        const padding = this.layoutPadding;
        const gap = this.layoutGap;
        let offsetX = this.x + padding;
        let offsetY = this.y + padding;
        let rowHeight = 0;
        const maxWidth = this.width - padding * 2;

        for (const shape of visible) {
            const bounds = shape.getBounds();

            if (this.layoutDirection === 'horizontal') {
                if (offsetX + bounds.width > this.x + maxWidth && offsetX > this.x + padding) {
                    offsetX = this.x + padding;
                    offsetY += rowHeight + gap;
                    rowHeight = 0;
                }
                shape.x = offsetX;
                shape.y = this.layoutAlign === 'center'
                    ? offsetY + (this._getRowHeight(visible) - bounds.height) / 2
                    : this.layoutAlign === 'end'
                        ? offsetY + this._getRowHeight(visible) - bounds.height
                        : offsetY;
                offsetX += bounds.width + gap;
                rowHeight = Math.max(rowHeight, bounds.height);
            } else {
                shape.x = this.layoutAlign === 'center'
                    ? this.x + (this.width - bounds.width) / 2
                    : this.layoutAlign === 'end'
                        ? this.x + this.width - bounds.width - padding
                        : offsetX;
                shape.y = offsetY;
                offsetY += bounds.height + gap;
            }
        }

        this._dirty = true;
    }

    _getRowHeight(shapes) {
        return Math.max(...shapes.map(s => s.getBounds().height));
    }

    setLayout(mode, direction, align, gap, padding) {
        this.layoutMode = mode;
        if (direction) this.layoutDirection = direction;
        if (align) this.layoutAlign = align;
        if (gap !== undefined) this.layoutGap = gap;
        if (padding !== undefined) this.layoutPadding = padding;
        if (mode !== 'free') this.autoLayout();
    }

    setConstraint(shapeId, constraint) {
        this.constraints[shapeId] = constraint;
    }

    applyConstraints() {
        for (const [shapeId, constraint] of Object.entries(this.constraints)) {
            const shape = this.shapes.find(s => s.id === shapeId);
            if (!shape) continue;

            const bounds = shape.getBounds();
            const frameBounds = this.getBounds();

            if (constraint.horizontal === 'stretch') {
                shape.x = frameBounds.x + (constraint.left || 0);
                if (shape.width) {
                    shape.width = frameBounds.width - (constraint.left || 0) - (constraint.right || 0);
                }
            } else if (constraint.horizontal === 'center') {
                shape.x = frameBounds.x + frameBounds.width / 2 - bounds.width / 2;
            } else if (constraint.horizontal === 'right') {
                shape.x = frameBounds.x + frameBounds.width - bounds.width - (constraint.right || 0);
            }

            if (constraint.vertical === 'stretch') {
                shape.y = frameBounds.y + (constraint.top || 0);
                if (shape.height) {
                    shape.height = frameBounds.height - (constraint.top || 0) - (constraint.bottom || 0);
                }
            } else if (constraint.vertical === 'center') {
                shape.y = frameBounds.y + frameBounds.height / 2 - bounds.height / 2;
            } else if (constraint.vertical === 'bottom') {
                shape.y = frameBounds.y + frameBounds.height - bounds.height - (constraint.bottom || 0);
            }
        }
    }

    flatten() {
        const flattened = [];
        for (const shape of this.shapes) {
            flattened.push(shape.clone());
        }
        return flattened;
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
            rotation: this.rotation,
            scaleX: this.scaleX,
            scaleY: this.scaleY,
            opacity: this.opacity,
            visible: this.visible,
            locked: this.locked,
            fill: this.fill,
            stroke: this.stroke,
            strokeWidth: this.strokeWidth,
            cornerRadius: this.cornerRadius,
            clipsContent: this.clipsContent,
            layoutMode: this.layoutMode,
            layoutGap: this.layoutGap,
            layoutPadding: this.layoutPadding,
            layoutDirection: this.layoutDirection,
            layoutAlign: this.layoutAlign,
            constraints: this.constraints,
            shapes: this.shapes.map(s => s.serialize())
        };
    }

    static deserialize(data) {
        const shapes = [];
        if (data.shapes) {
            const ctors = {
                rectangle: VexelRectangle,
                ellipse: VexelEllipse,
                polygon: VexelPolygon,
                line: VexelLine,
                path: VexelPath,
                text: VexelText,
                image: VexelImage,
                group: VexelGroup,
                frame: VexelFrame
            };
            for (const s of data.shapes) {
                const Ctor = ctors[s.type];
                if (Ctor && Ctor.deserialize) shapes.push(Ctor.deserialize(s));
            }
        }

        return new VexelFrame({
            id: data.id,
            name: data.name,
            x: data.x,
            y: data.y,
            width: data.width,
            height: data.height,
            rotation: data.rotation,
            scaleX: data.scaleX,
            scaleY: data.scaleY,
            opacity: data.opacity,
            visible: data.visible,
            locked: data.locked,
            fill: data.fill,
            stroke: data.stroke,
            strokeWidth: data.strokeWidth,
            cornerRadius: data.cornerRadius,
            clipsContent: data.clipsContent,
            layoutMode: data.layoutMode,
            layoutGap: data.layoutGap,
            layoutPadding: data.layoutPadding,
            layoutDirection: data.layoutDirection,
            layoutAlign: data.layoutAlign,
            constraints: data.constraints,
            shapes
        });
    }

    clone() {
        return VexelFrame.deserialize(this.serialize());
    }

    toSVG() {
        let svg = `<g id="${this.id}" transform="translate(${this.x} ${this.y}) rotate(${this.rotation}) scale(${this.scaleX} ${this.scaleY})">`;
        if (this.fill !== 'transparent') {
            svg += `<rect width="${this.width}" height="${this.height}" fill="${this.fill}" rx="${this.cornerRadius}"/>`;
        }
        if (this.clipsContent) {
            svg += `<clipPath id="clip_${this.id}"><rect width="${this.width}" height="${this.height}" rx="${this.cornerRadius}"/></clipPath>`;
            svg += `<g clip-path="url(#clip_${this.id})">`;
        }
        for (const shape of this.shapes) {
            if (shape.toSVG) svg += shape.toSVG();
        }
        if (this.clipsContent) svg += '</g>';
        if (this.stroke !== 'none') {
            svg += `<rect width="${this.width}" height="${this.height}" fill="none" stroke="${this.stroke}" stroke-width="${this.strokeWidth}" rx="${this.cornerRadius}"/>`;
        }
        svg += '</g>';
        return svg;
    }
}

if (typeof window !== 'undefined') {
    window.VexelFrame = VexelFrame;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelFrame;
}
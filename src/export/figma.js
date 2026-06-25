// src/export/figma.js

class VexelFigmaExport {
    constructor(vexel) {
        this.vexel = vexel;
    }

    export(options = {}) {
        const {
            pretty = true,
            includeMetadata = true,
            pageName = 'Vexel Export'
        } = options;

        const document = {
            name: pageName,
            type: 'DOCUMENT',
            children: [
                {
                    name: 'Page 1',
                    type: 'CANVAS',
                    children: [
                        this._exportFrame(options)
                    ]
                }
            ]
        };

        if (includeMetadata) {
            document.children[0].children[0].documentation = {
                exportedFrom: 'Vexel',
                exportedAt: new Date().toISOString(),
                version: '1.0.0',
                author: 'FlamicsLLC'
            };
        }

        return JSON.stringify(document, null, pretty ? 2 : 0);
    }

    _exportFrame(options) {
        const bounds = this._getDocumentBounds();

        return {
            name: options.frameName || 'Vexel Export',
            type: 'FRAME',
            blendMode: 'PASS_THROUGH',
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            backgroundColor: {
                r: 1,
                g: 1,
                b: 1,
                a: 1
            },
            children: this.vexel.shapes.map(s => this._convertShape(s)),
            clipsContent: true
        };
    }

    _convertShape(shape) {
        const converters = {
            rectangle: this._convertRectangle.bind(this),
            ellipse: this._convertEllipse.bind(this),
            polygon: this._convertPolygon.bind(this),
            line: this._convertLine.bind(this),
            path: this._convertPath.bind(this),
            text: this._convertText.bind(this),
            group: this._convertGroup.bind(this)
        };

        const converter = converters[shape.type];
        if (converter) return converter(shape);
        return this._convertDefault(shape);
    }

    _getDocumentBounds() {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        if (this.vexel.shapes.length === 0) {
            return { x: 0, y: 0, width: this.vexel.width, height: this.vexel.height };
        }

        for (const shape of this.vexel.shapes) {
            const b = shape.getBounds();
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    _convertBase(shape) {
        return {
            id: shape.id,
            name: shape.name || shape.type,
            visible: shape.visible !== false,
            opacity: shape.opacity || 1,
            x: shape.x,
            y: shape.y,
            rotation: shape.rotation || 0,
            blendMode: this._convertBlendMode(shape.blendMode || 'NORMAL'),
            effects: [],
            constraints: { vertical: 'MIN', horizontal: 'MIN' }
        };
    }

    _convertRectangle(shape) {
        const node = this._convertBase(shape);
        node.type = 'RECTANGLE';
        node.width = shape.width * (shape.scaleX || 1);
        node.height = shape.height * (shape.scaleY || 1);

        if (shape.cornerRadius && shape.cornerRadius > 0) {
            node.cornerRadius = shape.cornerRadius;
        }

        if (shape.fill && shape.fill !== 'transparent') {
            node.fills = [this._convertFill(shape.fill, shape.fillOpacity)];
        }

        if (shape.stroke && shape.stroke !== 'none') {
            node.strokes = [this._convertStroke(shape)];
            node.strokeWeight = shape.strokeWidth || 1;
        }

        if (shape.shadow) {
            node.effects.push(this._convertShadow(shape.shadow));
        }

        if (shape.blur && shape.blur > 0) {
            node.effects.push(this._convertBlur(shape.blur));
        }

        return node;
    }

    _convertEllipse(shape) {
        const node = this._convertBase(shape);
        node.type = 'ELLIPSE';

        const arcData = {
            startingAngle: 0,
            endingAngle: 2 * Math.PI,
            innerRadius: 0
        };

        node.arcData = arcData;

        if (shape.fill && shape.fill !== 'transparent') {
            node.fills = [this._convertFill(shape.fill, shape.fillOpacity)];
        }

        if (shape.stroke && shape.stroke !== 'none') {
            node.strokes = [this._convertStroke(shape)];
            node.strokeWeight = shape.strokeWidth || 1;
        }

        return node;
    }

    _convertPolygon(shape) {
        const node = this._convertBase(shape);
        node.type = 'POLYGON';
        node.pointCount = shape.sides;

        if (shape.fill && shape.fill !== 'transparent') {
            node.fills = [this._convertFill(shape.fill, shape.fillOpacity)];
        }

        return node;
    }

    _convertLine(shape) {
        const node = this._convertBase(shape);
        node.type = 'LINE';

        if (shape.stroke && shape.stroke !== 'none') {
            node.strokes = [this._convertStroke(shape)];
            node.strokeWeight = shape.strokeWidth || 1;
        }

        return node;
    }

    _convertPath(shape) {
        const node = this._convertBase(shape);
        node.type = 'VECTOR';

        const segments = [];
        for (let i = 0; i < shape.points.length; i++) {
            segments.push({
                start: i,
                end: (i + 1) % shape.points.length,
                tangentStart: { x: 0, y: 0 },
                tangentEnd: { x: 0, y: 0 }
            });
        }

        node.vectorNetwork = {
            vertices: shape.points.map(p => ({ x: p.x, y: p.y, strokeCap: 'NONE', strokeJoin: 'MITER' })),
            segments
        };

        if (shape.fill && shape.fill !== 'transparent') {
            node.fills = [this._convertFill(shape.fill, shape.fillOpacity)];
        }

        return node;
    }

    _convertText(shape) {
        const node = this._convertBase(shape);
        node.type = 'TEXT';
        node.characters = shape.content;
        node.fontSize = shape.fontSize || 16;
        node.fontName = {
            family: shape.fontFamily || 'Inter',
            style: shape.fontWeight || 'Regular'
        };
        node.textAlignHorizontal = (shape.align || 'LEFT').toUpperCase();
        node.lineHeight = { value: (shape.lineHeight || 1.4) * 100, unit: 'PERCENT' };

        if (shape.fill && shape.fill !== 'transparent') {
            node.fills = [this._convertFill(shape.fill, shape.fillOpacity)];
        }

        return node;
    }

    _convertGroup(shape) {
        const node = this._convertBase(shape);
        node.type = 'GROUP';
        node.children = shape.shapes.map(s => this._convertShape(s));

        if (shape.clipShapes) {
            node.clipsContent = true;
        }

        return node;
    }

    _convertDefault(shape) {
        return this._convertBase(shape);
    }

    _convertFill(fill, opacity = 1) {
        if (typeof fill === 'string') {
            const color = this._colorToFigma(fill);
            color.a = opacity;
            return { type: 'SOLID', color, opacity };
        }

        if (fill && fill.type === 'linearGradient') {
            return {
                type: 'GRADIENT_LINEAR',
                gradientStops: fill.stops.map(s => ({
                    position: s.offset,
                    color: this._colorToFigma(s.color)
                })),
                gradientTransform: [[1, 0, 0], [0, 1, 0]]
            };
        }

        if (fill && fill.type === 'radialGradient') {
            return {
                type: 'GRADIENT_RADIAL',
                gradientStops: fill.stops.map(s => ({
                    position: s.offset,
                    color: this._colorToFigma(s.color)
                })),
                gradientTransform: [[1, 0, 0], [0, 1, 0]]
            };
        }

        return { type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } };
    }

    _convertStroke(shape) {
        const color = this._colorToFigma(shape.stroke || '#000000');
        return {
            type: 'SOLID',
            color,
            opacity: shape.strokeOpacity || 1
        };
    }

    _convertShadow(shadow) {
        return {
            type: 'DROP_SHADOW',
            visible: true,
            color: this._colorToFigma(shadow.color || 'rgba(0,0,0,0.3)'),
            offset: { x: shadow.offsetX || 0, y: shadow.offsetY || 2 },
            radius: shadow.blur || 4,
            spread: shadow.spread || 0
        };
    }

    _convertBlur(blur) {
        return {
            type: 'LAYER_BLUR',
            visible: true,
            radius: blur
        };
    }

    _convertBlendMode(mode) {
        const mapping = {
            'normal': 'NORMAL',
            'multiply': 'MULTIPLY',
            'screen': 'SCREEN',
            'overlay': 'OVERLAY',
            'darken': 'DARKEN',
            'lighten': 'LIGHTEN',
            'color-dodge': 'COLOR_DODGE',
            'color-burn': 'COLOR_BURN',
            'hard-light': 'HARD_LIGHT',
            'soft-light': 'SOFT_LIGHT',
            'difference': 'DIFFERENCE',
            'exclusion': 'EXCLUSION'
        };
        return mapping[mode] || 'NORMAL';
    }

    _colorToFigma(colorString) {
        if (!colorString || colorString === 'transparent') {
            return { r: 0, g: 0, b: 0, a: 0 };
        }

        const color = VexelColor ? VexelColor.parse(colorString) : null;
        if (color) {
            return {
                r: color.r / 255,
                g: color.g / 255,
                b: color.b / 255,
                a: color.a || 1
            };
        }

        return { r: 0, g: 0, b: 0, a: 1 };
    }

    download(filename = 'vexel-figma.json', options = {}) {
        const json = this.export(options);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

class VexelSketchExport {
    constructor(vexel) {
        this.vexel = vexel;
    }

    export(options = {}) {
        const {
            pretty = true,
            pageName = 'Vexel Export'
        } = options;

        const bounds = this._getDocumentBounds();

        const document = {
            _class: 'document',
            do_objectID: this._generateId(),
            pages: [
                {
                    _class: 'page',
                    do_objectID: this._generateId(),
                    name: pageName,
                    layers: this.vexel.shapes.map(s => this._convertLayer(s)),
                    frame: {
                        _class: 'rect',
                        x: bounds.x,
                        y: bounds.y,
                        width: bounds.width,
                        height: bounds.height
                    }
                }
            ]
        };

        return JSON.stringify(document, null, pretty ? 2 : 0);
    }

    _getDocumentBounds() {
        if (this.vexel.shapes.length === 0) {
            return { x: 0, y: 0, width: this.vexel.width, height: this.vexel.height };
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const shape of this.vexel.shapes) {
            const b = shape.getBounds();
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    _convertLayer(shape) {
        const base = {
            _class: this._getSketchClass(shape.type),
            do_objectID: shape.id,
            name: shape.name || shape.type,
            isVisible: shape.visible !== false,
            isLocked: shape.locked || false,
            opacity: shape.opacity || 1,
            rotation: shape.rotation || 0,
            frame: {
                _class: 'rect',
                x: shape.x,
                y: shape.y,
                width: shape.width || 0,
                height: shape.height || 0
            }
        };

        if (shape.fill && shape.fill !== 'transparent') {
            base.style = {
                _class: 'style',
                fills: [this._convertFill(shape.fill)]
            };
        }

        if (shape.type === 'group' && shape.shapes) {
            base.layers = shape.shapes.map(s => this._convertLayer(s));
        }

        return base;
    }

    _getSketchClass(type) {
        const mapping = {
            rectangle: 'rectangle',
            ellipse: 'oval',
            polygon: 'polygon',
            line: 'line',
            path: 'shapePath',
            text: 'text',
            group: 'group',
            image: 'bitmap'
        };
        return mapping[type] || 'shapeGroup';
    }

    _convertFill(fill) {
        if (typeof fill === 'string') {
            const color = VexelColor ? VexelColor.parse(fill) : null;
            if (color) {
                return {
                    _class: 'fill',
                    isEnabled: true,
                    fillType: 0,
                    color: {
                        _class: 'color',
                        red: color.r / 255,
                        green: color.g / 255,
                        blue: color.b / 255,
                        alpha: color.a || 1
                    }
                };
            }
        }
        return null;
    }

    _generateId() {
        return `${Date.now().toString(16)}${Math.random().toString(36).substr(2, 10)}`;
    }
}

if (typeof window !== 'undefined') {
    window.VexelFigmaExport = VexelFigmaExport;
    window.VexelSketchExport = VexelSketchExport;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VexelFigmaExport, VexelSketchExport };
}
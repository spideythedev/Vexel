// src/export/lottie.js

class VexelLottieExport {
    constructor(vexel) {
        this.vexel = vexel;
        this.frameRate = 60;
        this.width = vexel.width;
        this.height = vexel.height;
    }

    export(options = {}) {
        const {
            frameRate = 60,
            duration = 3,
            includeMetadata = true,
            pretty = true,
            name = 'Vexel Animation'
        } = options;

        this.frameRate = frameRate;
        const totalFrames = Math.ceil(duration * frameRate);

        const animation = {
            v: '5.7.4',
            fr: frameRate,
            ip: 0,
            op: totalFrames,
            w: this.width,
            h: this.height,
            nm: name,
            ddd: 0,
            assets: [],
            layers: [],
            markers: []
        };

        if (includeMetadata) {
            animation.meta = {
                g: 'Vexel Lottie Exporter',
                a: 'FlamicsLLC',
                k: '',
                d: `Exported at ${new Date().toISOString()}`,
                tc: ''
            };
        }

        for (let i = this.vexel.shapes.length - 1; i >= 0; i--) {
            const layer = this._convertShapeToLayer(this.vexel.shapes[i], i);
            if (layer) {
                animation.layers.push(layer);
            }
        }

        return JSON.stringify(animation, null, pretty ? 2 : 0);
    }

    _convertShapeToLayer(shape, index) {
        const converters = {
            rectangle: this._convertRectangle.bind(this),
            ellipse: this._convertEllipse.bind(this),
            polygon: this._convertPolygon.bind(this),
            path: this._convertPath.bind(this),
            group: this._convertGroup.bind(this)
        };

        const converter = converters[shape.type];
        if (!converter) return null;

        const layer = {
            ddd: 0,
            ind: index + 1,
            ty: 4,
            nm: shape.name || shape.type,
            sr: 1,
            ks: {
                o: { a: 0, k: (shape.opacity || 1) * 100 },
                r: { a: 0, k: shape.rotation || 0 },
                p: { a: 0, k: [shape.x || 0, shape.y || 0, 0] },
                a: { a: 0, k: [0, 0, 0] },
                s: { a: 0, k: [(shape.scaleX || 1) * 100, (shape.scaleY || 1) * 100, 100] }
            },
            ao: 0,
            shapes: [],
            ip: 0,
            op: Math.ceil(3 * this.frameRate),
            st: 0,
            bm: 0
        };

        const shapeContent = converter(shape);
        if (shapeContent) {
            if (Array.isArray(shapeContent)) {
                layer.shapes = shapeContent;
            } else {
                layer.shapes = [shapeContent];
            }
        }

        if (shape.visible === false) {
            layer.ks.o.k = 0;
        }

        return layer;
    }

    _convertRectangle(shape) {
        const position = [shape.x + shape.width / 2, shape.y + shape.height / 2];
        const size = [shape.width, shape.height];
        const roundness = shape.cornerRadius || 0;

        const content = {
            ty: 'rc',
            d: 1,
            s: { a: 0, k: size },
            p: { a: 0, k: position },
            r: { a: 0, k: roundness },
            nm: 'Rectangle'
        };

        const shapes = [content];

        if (shape.fill && shape.fill !== 'transparent') {
            shapes.push(this._convertFill(shape.fill, shape.fillOpacity));
        }

        if (shape.stroke && shape.stroke !== 'none') {
            shapes.push(this._convertStroke(shape));
        }

        return shapes;
    }

    _convertEllipse(shape) {
        const position = [shape.x, shape.y];
        const size = [shape.radiusX * 2, shape.radiusY * 2];

        const content = {
            ty: 'el',
            d: 1,
            s: { a: 0, k: size },
            p: { a: 0, k: position },
            nm: 'Ellipse'
        };

        const shapes = [content];

        if (shape.fill && shape.fill !== 'transparent') {
            shapes.push(this._convertFill(shape.fill, shape.fillOpacity));
        }

        if (shape.stroke && shape.stroke !== 'none') {
            shapes.push(this._convertStroke(shape));
        }

        return shapes;
    }

    _convertPolygon(shape) {
        const points = [];
        for (let i = 0; i < shape.sides; i++) {
            const angle = (i * 2 * Math.PI) / shape.sides - Math.PI / 2;
            points.push({
                x: Math.cos(angle) * shape.radius,
                y: Math.sin(angle) * shape.radius
            });
        }

        const inTangents = [];
        const outTangents = [];
        let closed = true;

        for (let i = 0; i < points.length; i++) {
            inTangents.push([0, 0]);
            outTangents.push([0, 0]);
        }

        const vertices = points.map(p => [p.x, p.y]);
        const position = [shape.x, shape.y];

        const content = {
            ty: 'sh',
            ks: {
                a: 0,
                k: {
                    c: closed,
                    i: inTangents,
                    o: outTangents,
                    v: vertices
                }
            },
            nm: 'Polygon'
        };

        const shapes = [content];

        if (shape.fill && shape.fill !== 'transparent') {
            shapes.push(this._convertFill(shape.fill, shape.fillOpacity));
        }

        if (shape.stroke && shape.stroke !== 'none') {
            shapes.push(this._convertStroke(shape));
        }

        return shapes;
    }

    _convertPath(shape) {
        if (!shape.points || shape.points.length < 2) return null;

        const vertices = shape.points.map(p => [p.x, p.y]);
        const inTangents = [];
        const outTangents = [];

        for (let i = 0; i < shape.points.length; i++) {
            inTangents.push([0, 0]);
            outTangents.push([0, 0]);
        }

        const content = {
            ty: 'sh',
            ks: {
                a: 0,
                k: {
                    c: shape.closed || false,
                    i: inTangents,
                    o: outTangents,
                    v: vertices
                }
            },
            nm: 'Path'
        };

        const shapes = [content];

        if (shape.fill && shape.fill !== 'transparent') {
            shapes.push(this._convertFill(shape.fill, shape.fillOpacity));
        }

        if (shape.stroke && shape.stroke !== 'none') {
            shapes.push(this._convertStroke(shape));
        }

        return shapes;
    }

    _convertGroup(shape) {
        const shapes = [];

        if (shape.shapes) {
            for (const child of shape.shapes) {
                const childShapes = this._convertShapeToLayer(child, 0);
                if (childShapes && childShapes.shapes) {
                    shapes.push(...childShapes.shapes);
                }
            }
        }

        if (shape.fill && shape.fill !== 'transparent') {
            shapes.push(this._convertFill(shape.fill, shape.fillOpacity));
        }

        if (shape.stroke && shape.stroke !== 'none') {
            shapes.push(this._convertStroke(shape));
        }

        return shapes;
    }

    _convertFill(fill, opacity = 1) {
        let color = { r: 1, g: 1, b: 1, a: 1 };

        if (typeof fill === 'string') {
            const parsed = VexelColor ? VexelColor.parse(fill) : null;
            if (parsed) {
                color = {
                    r: parsed.r / 255,
                    g: parsed.g / 255,
                    b: parsed.b / 255,
                    a: (parsed.a || 1) * opacity
                };
            }
        }

        return {
            ty: 'fl',
            c: { a: 0, k: [color.r, color.g, color.b, 1] },
            o: { a: 0, k: color.a * 100 },
            r: 1,
            nm: 'Fill'
        };
    }

    _convertStroke(shape) {
        let color = { r: 0, g: 0, b: 0, a: 1 };
        const strokeColor = shape.stroke || '#000000';

        if (typeof strokeColor === 'string') {
            const parsed = VexelColor ? VexelColor.parse(strokeColor) : null;
            if (parsed) {
                color = {
                    r: parsed.r / 255,
                    g: parsed.g / 255,
                    b: parsed.b / 255,
                    a: (parsed.a || 1) * (shape.strokeOpacity || 1)
                };
            }
        }

        const strokeObj = {
            ty: 'st',
            c: { a: 0, k: [color.r, color.g, color.b, 1] },
            o: { a: 0, k: color.a * 100 },
            w: { a: 0, k: shape.strokeWidth || 1 },
            lc: this._convertLineCap(shape.strokeCap || 'butt'),
            lj: this._convertLineJoin(shape.strokeJoin || 'miter'),
            ml: shape.miterLimit || 10,
            nm: 'Stroke'
        };

        if (shape.strokeDash && shape.strokeDash.length > 0) {
            strokeObj.d = shape.strokeDash.map(n => ({ n: 'd', v: { a: 0, k: n } }));
        }

        return strokeObj;
    }

    _convertLineCap(cap) {
        const mapping = { butt: 1, round: 2, square: 3 };
        return mapping[cap] || 1;
    }

    _convertLineJoin(join) {
        const mapping = { miter: 1, round: 2, bevel: 3 };
        return mapping[join] || 1;
    }

    download(filename = 'vexel-animation.json', options = {}) {
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

if (typeof window !== 'undefined') {
    window.VexelLottieExport = VexelLottieExport;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelLottieExport;
}
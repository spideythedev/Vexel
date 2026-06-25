// src/export/eps.js

class VexelEPSExport {
    constructor(vexel) {
        this.vexel = vexel;
    }

    export(options = {}) {
        const {
            includeMetadata = true,
            embedFonts = false,
            colorSpace = 'RGB',
            resolution = 72,
            bleed = 0
        } = options;

        const bounds = this._getDocumentBounds();
        const width = bounds.width + bleed * 2;
        const height = bounds.height + bleed * 2;
        const offsetX = bounds.x - bleed;
        const offsetY = bounds.y - bleed;

        let eps = '';

        eps += '%!PS-Adobe-3.0 EPSF-3.0\n';
        eps += `%%BoundingBox: 0 0 ${Math.ceil(width)} ${Math.ceil(height)}\n`;

        if (includeMetadata) {
            eps += `%%Title: Vexel Export\n`;
            eps += `%%Creator: Vexel Vector Graphics Engine\n`;
            eps += `%%Producer: FlamicsLLC\n`;
            eps += `%%CreationDate: ${new Date().toISOString()}\n`;
            eps += `%%For: Vexel User\n`;
            eps += '%%LanguageLevel: 3\n';
        }

        eps += `%%Pages: 1\n`;
        eps += `%%DocumentData: Clean7Bit\n`;
        eps += `%%Orientation: Portrait\n`;
        eps += '%%EndComments\n\n';

        eps += '%%BeginProlog\n';
        eps += '/c { curveto } bind def\n';
        eps += '/l { lineto } bind def\n';
        eps += '/m { moveto } bind def\n';
        eps += '/h { closepath } bind def\n';
        eps += '/rg { setrgbcolor } bind def\n';
        eps += '/rf { setrgbcolor fill } bind def\n';
        eps += '/rs { setrgbcolor stroke } bind def\n';
        eps += '/sw { setlinewidth } bind def\n';
        eps += '/sc { setlinecap } bind def\n';
        eps += '/sj { setlinejoin } bind def\n';
        eps += '/sd { setdash } bind def\n';
        eps += '/gs { gsave } bind def\n';
        eps += '/gr { grestore } bind def\n';
        eps += '/tr { translate } bind def\n';
        eps += '/sca { scale } bind def\n';
        eps += '/rot { rotate } bind def\n';
        eps += '/op { setopacityalpha } bind def\n';
        eps += '%%EndProlog\n\n';

        eps += '%%Page: 1 1\n';
        eps += 'gs\n';

        if (bleed > 0) {
            eps += `${bleed} ${bleed} tr\n`;
        }

        for (const shape of this.vexel.shapes) {
            if (shape.visible !== false) {
                eps += this._convertShape(shape, offsetX, offsetY);
            }
        }

        eps += 'gr\n';
        eps += 'showpage\n';
        eps += '%%EOF\n';

        return eps;
    }

    _convertShape(shape, offsetX, offsetY) {
        const converters = {
            rectangle: this._convertRectangle.bind(this),
            ellipse: this._convertEllipse.bind(this),
            polygon: this._convertPolygon.bind(this),
            line: this._convertLine.bind(this),
            path: this._convertPath.bind(this),
            group: this._convertGroup.bind(this)
        };

        const converter = converters[shape.type];
        if (converter) {
            return converter(shape, offsetX, offsetY);
        }
        return '';
    }

    _convertRectangle(shape, offsetX, offsetY) {
        let eps = '';

        const x = shape.x - offsetX;
        const y = shape.y - offsetY;
        const w = shape.width * (shape.scaleX || 1);
        const h = shape.height * (shape.scaleY || 1);
        const r = shape.cornerRadius || 0;

        eps += 'gs\n';

        if (shape.rotation) {
            const cx = x + w / 2;
            const cy = y + h / 2;
            eps += `${cx} ${cy} tr\n`;
            eps += `${shape.rotation} rot\n`;
            eps += `${-cx} ${-cy} tr\n`;
        }

        if (shape.opacity !== undefined && shape.opacity < 1) {
            eps += `${shape.opacity} op\n`;
        }

        if (r > 0) {
            eps += `newpath\n`;
            eps += `${x + r} ${y} m\n`;
            eps += `${x + w - r} ${y} l\n`;
            eps += `${x + w} ${y} ${x + w} ${y + r} ${x + w - r} ${y + r} c\n`;
            eps += `${x + w} ${y + h - r} l\n`;
            eps += `${x + w} ${y + h} ${x + w - r} ${y + h} ${x + w - r} ${y + h - r} c\n`;
            eps += `${x + r} ${y + h} l\n`;
            eps += `${x} ${y + h} ${x} ${y + h - r} ${x + r} ${y + h - r} c\n`;
            eps += `${x} ${y + r} l\n`;
            eps += `${x} ${y} ${x + r} ${y} ${x + r} ${y + r} c\n`;
        } else {
            eps += `newpath\n`;
            eps += `${x} ${y} m\n`;
            eps += `${x + w} ${y} l\n`;
            eps += `${x + w} ${y + h} l\n`;
            eps += `${x} ${y + h} l\n`;
            eps += 'h\n';
        }

        if (shape.fill && shape.fill !== 'transparent') {
            const color = this._colorToEPS(shape.fill);
            eps += `${color.r} ${color.g} ${color.b} rf\n`;
        }

        if (shape.stroke && shape.stroke !== 'none') {
            const color = this._colorToEPS(shape.stroke);
            eps += `${shape.strokeWidth || 1} sw\n`;
            eps += `${this._capToEPS(shape.strokeCap || 'butt')} sc\n`;
            eps += `${this._joinToEPS(shape.strokeJoin || 'miter')} sj\n`;
            eps += `${color.r} ${color.g} ${color.b} rs\n`;
        }

        eps += 'gr\n';

        return eps;
    }

    _convertEllipse(shape, offsetX, offsetY) {
        let eps = '';

        const cx = shape.x - offsetX;
        const cy = shape.y - offsetY;
        const rx = shape.radiusX;
        const ry = shape.radiusY;

        eps += 'gs\n';

        if (shape.rotation) {
            eps += `${cx} ${cy} tr\n`;
            eps += `${shape.rotation} rot\n`;
            eps += `${-cx} ${-cy} tr\n`;
        }

        if (shape.opacity !== undefined && shape.opacity < 1) {
            eps += `${shape.opacity} op\n`;
        }

        eps += `newpath\n`;
        eps += `${cx} ${cy} ${rx} ${ry} 0 360 ellipse\n`;

        if (shape.fill && shape.fill !== 'transparent') {
            const color = this._colorToEPS(shape.fill);
            eps += `${color.r} ${color.g} ${color.b} rf\n`;
        }

        if (shape.stroke && shape.stroke !== 'none') {
            const color = this._colorToEPS(shape.stroke);
            eps += `${shape.strokeWidth || 1} sw\n`;
            eps += `${color.r} ${color.g} ${color.b} rs\n`;
        }

        eps += 'gr\n';

        return eps;
    }

    _convertPolygon(shape, offsetX, offsetY) {
        let eps = '';

        const cx = shape.x - offsetX;
        const cy = shape.y - offsetY;

        eps += 'gs\n';

        if (shape.rotation) {
            eps += `${cx} ${cy} tr\n`;
            eps += `${shape.rotation} rot\n`;
            eps += `${-cx} ${-cy} tr\n`;
        }

        eps += `newpath\n`;

        const points = [];
        for (let i = 0; i < shape.sides; i++) {
            const angle = (i * 2 * Math.PI) / shape.sides - Math.PI / 2;
            points.push({
                x: cx + Math.cos(angle) * shape.radius,
                y: cy + Math.sin(angle) * shape.radius
            });
        }

        eps += `${points[0].x} ${points[0].y} m\n`;
        for (let i = 1; i < points.length; i++) {
            eps += `${points[i].x} ${points[i].y} l\n`;
        }
        eps += 'h\n';

        if (shape.fill && shape.fill !== 'transparent') {
            const color = this._colorToEPS(shape.fill);
            eps += `${color.r} ${color.g} ${color.b} rf\n`;
        }

        if (shape.stroke && shape.stroke !== 'none') {
            const color = this._colorToEPS(shape.stroke);
            eps += `${shape.strokeWidth || 1} sw\n`;
            eps += `${color.r} ${color.g} ${color.b} rs\n`;
        }

        eps += 'gr\n';

        return eps;
    }

    _convertLine(shape, offsetX, offsetY) {
        let eps = '';

        const x1 = shape.x1 - offsetX;
        const y1 = shape.y1 - offsetY;
        const x2 = shape.x2 - offsetX;
        const y2 = shape.y2 - offsetY;

        eps += 'gs\n';

        if (shape.opacity !== undefined && shape.opacity < 1) {
            eps += `${shape.opacity} op\n`;
        }

        eps += `newpath\n`;
        eps += `${x1} ${y1} m\n`;
        eps += `${x2} ${y2} l\n`;

        if (shape.stroke && shape.stroke !== 'none') {
            const color = this._colorToEPS(shape.stroke);
            eps += `${shape.strokeWidth || 1} sw\n`;
            eps += `${this._capToEPS(shape.strokeCap || 'butt')} sc\n`;
            eps += `${color.r} ${color.g} ${color.b} rs\n`;
        }

        eps += 'gr\n';

        return eps;
    }

    _convertPath(shape, offsetX, offsetY) {
        if (!shape.points || shape.points.length < 2) return '';

        let eps = 'gs\n';

        if (shape.opacity !== undefined && shape.opacity < 1) {
            eps += `${shape.opacity} op\n`;
        }

        eps += 'newpath\n';

        const firstPoint = shape.points[0];
        eps += `${firstPoint.x - offsetX} ${firstPoint.y - offsetY} m\n`;

        for (let i = 1; i < shape.points.length; i++) {
            const p = shape.points[i];
            eps += `${p.x - offsetX} ${p.y - offsetY} l\n`;
        }

        if (shape.closed) {
            eps += 'h\n';
        }

        if (shape.fill && shape.fill !== 'transparent') {
            const color = this._colorToEPS(shape.fill);
            eps += `${color.r} ${color.g} ${color.b} rf\n`;
        }

        if (shape.stroke && shape.stroke !== 'none') {
            const color = this._colorToEPS(shape.stroke);
            eps += `${shape.strokeWidth || 1} sw\n`;
            eps += `${color.r} ${color.g} ${color.b} rs\n`;
        }

        eps += 'gr\n';

        return eps;
    }

    _convertGroup(shape, offsetX, offsetY) {
        let eps = 'gs\n';

        if (shape.opacity !== undefined && shape.opacity < 1) {
            eps += `${shape.opacity} op\n`;
        }

        if (shape.rotation) {
            const cx = shape.x + (shape.width || 0) / 2 - offsetX;
            const cy = shape.y + (shape.height || 0) / 2 - offsetY;
            eps += `${cx} ${cy} tr\n`;
            eps += `${shape.rotation} rot\n`;
            eps += `${-cx} ${-cy} tr\n`;
        }

        if (shape.shapes) {
            for (const child of shape.shapes) {
                eps += this._convertShape(child, offsetX, offsetY);
            }
        }

        eps += 'gr\n';

        return eps;
    }

    _colorToEPS(colorString) {
        if (!colorString || colorString === 'transparent' || colorString === 'none') {
            return { r: 0, g: 0, b: 0 };
        }

        const color = VexelColor ? VexelColor.parse(colorString) : null;
        if (color) {
            return {
                r: (color.r / 255).toFixed(4),
                g: (color.g / 255).toFixed(4),
                b: (color.b / 255).toFixed(4)
            };
        }

        return { r: 0, g: 0, b: 0 };
    }

    _capToEPS(cap) {
        const mapping = { butt: 0, round: 1, square: 2 };
        return mapping[cap] || 0;
    }

    _joinToEPS(join) {
        const mapping = { miter: 0, round: 1, bevel: 2 };
        return mapping[join] || 0;
    }

    _getDocumentBounds() {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        if (this.vexel.shapes.length === 0) {
            return { x: 0, y: 0, width: this.vexel.width, height: this.vexel.height };
        }

        for (const shape of this.vexel.shapes) {
            if (shape.visible === false) continue;
            const b = shape.getBounds();
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
        }

        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    download(filename = 'vexel-export.eps', options = {}) {
        const eps = this.export(options);
        const blob = new Blob([eps], { type: 'application/postscript' });
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
    window.VexelEPSExport = VexelEPSExport;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelEPSExport;
}
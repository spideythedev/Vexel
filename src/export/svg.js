// src/export/svg.js

class VexelSVGExport {
    constructor(vexel) {
        this.vexel = vexel;
    }

    export(options = {}) {
        const {
            optimize = true,
            pretty = true,
            includeStyles = true,
            includeMetadata = true,
            scale = 1,
            background = null
        } = options;

        const indent = pretty ? '\n' : '';
        const tab = pretty ? '  ' : '';

        let svg = `<?xml version="1.0" encoding="UTF-8"?>${indent}`;
        svg += `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${this.vexel.width * scale}" height="${this.vexel.height * scale}" viewBox="0 0 ${this.vexel.width} ${this.vexel.height}">${indent}`;

        if (includeMetadata) {
            svg += `${tab}<metadata>${indent}`;
            svg += `${tab}${tab}<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">${indent}`;
            svg += `${tab}${tab}${tab}<rdf:Description>${indent}`;
            svg += `${tab}${tab}${tab}${tab}<dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Vexel Export</dc:title>${indent}`;
            svg += `${tab}${tab}${tab}${tab}<dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">FlamicsLLC</dc:creator>${indent}`;
            svg += `${tab}${tab}${tab}${tab}<dc:date xmlns:dc="http://purl.org/dc/elements/1.1/">${new Date().toISOString()}</dc:date>${indent}`;
            svg += `${tab}${tab}${tab}</rdf:Description>${indent}`;
            svg += `${tab}${tab}</rdf:RDF>${indent}`;
            svg += `${tab}</metadata>${indent}`;
        }

        if (includeStyles) {
            svg += `${tab}<defs>${indent}`;
            svg += this._exportGradients(tab + tab, indent);
            svg += this._exportPatterns(tab + tab, indent);
            svg += this._exportFilters(tab + tab, indent);
            svg += this._exportClipPaths(tab + tab, indent);
            svg += this._exportMasks(tab + tab, indent);
            svg += `${tab}</defs>${indent}`;
        }

        if (background) {
            svg += `${tab}<rect width="100%" height="100%" fill="${background}"/>${indent}`;
        }

        if (scale !== 1) {
            svg += `${tab}<g transform="scale(${scale})">${indent}`;
        }

        for (const shape of this.vexel.shapes) {
            if (shape.visible !== false) {
                svg += this._shapeToSVG(shape, tab + (scale !== 1 ? tab : ''), indent);
            }
        }

        if (scale !== 1) {
            svg += `${tab}</g>${indent}`;
        }

        svg += '</svg>';

        if (optimize) {
            svg = this._optimize(svg);
        }

        return svg;
    }

    _shapeToSVG(shape, tab, indent) {
        const opacity = shape.opacity !== 1 ? ` opacity="${shape.opacity}"` : '';
        const transform = this._getTransform(shape);
        const transformAttr = transform ? ` transform="${transform}"` : '';
        const visibility = shape.visible === false ? ' visibility="hidden"' : '';

        let svg = '';

        switch (shape.type) {
            case 'rectangle': {
                const rx = shape.cornerRadius || 0;
                svg += `${tab}<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}"`;
                if (rx > 0) svg += ` rx="${rx}" ry="${rx}"`;
                svg += this._styleAttributes(shape);
                svg += `${opacity}${transformAttr}${visibility}/>${indent}`;
                break;
            }

            case 'ellipse': {
                const cx = shape.x;
                const cy = shape.y;
                svg += `${tab}<ellipse cx="${cx}" cy="${cy}" rx="${shape.radiusX}" ry="${shape.radiusY}"`;
                svg += this._styleAttributes(shape);
                svg += `${opacity}${transformAttr}${visibility}/>${indent}`;
                break;
            }

            case 'polygon': {
                let points = '';
                for (let i = 0; i < shape.sides; i++) {
                    const angle = (i * 2 * Math.PI) / shape.sides - Math.PI / 2;
                    const px = shape.x + Math.cos(angle) * shape.radius;
                    const py = shape.y + Math.sin(angle) * shape.radius;
                    points += `${px},${py} `;
                }
                svg += `${tab}<polygon points="${points.trim()}"`;
                svg += this._styleAttributes(shape);
                svg += `${opacity}${transformAttr}${visibility}/>${indent}`;
                break;
            }

            case 'line': {
                svg += `${tab}<line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}"`;
                svg += this._styleAttributes(shape);
                if (shape.lineCap !== 'butt') svg += ` stroke-linecap="${shape.lineCap}"`;
                if (shape.lineDash && shape.lineDash.length > 0) svg += ` stroke-dasharray="${shape.lineDash.join(',')}"`;
                svg += `${opacity}${transformAttr}${visibility}/>${indent}`;
                break;
            }

            case 'path': {
                let d = `M ${shape.points[0].x} ${shape.points[0].y}`;
                for (let i = 1; i < shape.points.length; i++) {
                    d += ` L ${shape.points[i].x} ${shape.points[i].y}`;
                }
                if (shape.closed) d += ' Z';
                svg += `${tab}<path d="${d}"`;
                svg += this._styleAttributes(shape);
                svg += `${opacity}${transformAttr}${visibility}/>${indent}`;
                break;
            }

            case 'text': {
                svg += `${tab}<text x="${shape.x}" y="${shape.y}"`;
                svg += ` font-size="${shape.fontSize}" font-family="${shape.fontFamily}"`;
                if (shape.fontWeight !== 'normal') svg += ` font-weight="${shape.fontWeight}"`;
                if (shape.fontStyle !== 'normal') svg += ` font-style="${shape.fontStyle}"`;
                svg += this._styleAttributes(shape);
                svg += ` text-anchor="${shape.align || 'start'}"`;
                svg += `${opacity}${transformAttr}${visibility}>`;
                svg += this._escapeXML(shape.content);
                svg += `</text>${indent}`;
                break;
            }

            case 'image': {
                svg += `${tab}<image href="${shape.src}" x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}"`;
                svg += `${opacity}${transformAttr}${visibility}/>${indent}`;
                break;
            }

            case 'group': {
                svg += `${tab}<g${transformAttr}${opacity}${visibility}>${indent}`;
                for (const child of shape.shapes) {
                    svg += this._shapeToSVG(child, tab + '  ', indent);
                }
                svg += `${tab}</g>${indent}`;
                break;
            }
        }

        return svg;
    }

    _styleAttributes(shape) {
        let attrs = '';

        if (shape.fill && shape.fill !== 'transparent' && shape.fill !== 'none') {
            if (typeof shape.fill === 'object' && shape.fill.type) {
                const gradientId = this._getGradientId(shape);
                attrs += ` fill="url(#${gradientId})"`;
            } else {
                attrs += ` fill="${shape.fill}"`;
            }
            if (shape.fillOpacity !== undefined && shape.fillOpacity < 1) {
                attrs += ` fill-opacity="${shape.fillOpacity}"`;
            }
        } else {
            attrs += ` fill="none"`;
        }

        if (shape.stroke && shape.stroke !== 'none') {
            attrs += ` stroke="${shape.stroke}"`;
            attrs += ` stroke-width="${shape.strokeWidth || 1}"`;
            if (shape.strokeOpacity !== undefined && shape.strokeOpacity < 1) {
                attrs += ` stroke-opacity="${shape.strokeOpacity}"`;
            }
            if (shape.strokeCap && shape.strokeCap !== 'butt') {
                attrs += ` stroke-linecap="${shape.strokeCap}"`;
            }
            if (shape.strokeJoin && shape.strokeJoin !== 'miter') {
                attrs += ` stroke-linejoin="${shape.strokeJoin}"`;
            }
        }

        if (shape.blendMode && shape.blendMode !== 'normal') {
            attrs += ` style="mix-blend-mode:${shape.blendMode}"`;
        }

        if (shape.shadow) {
            attrs += ` filter="url(#shadow_${shape.id})"`;
        }

        if (shape.blur && shape.blur > 0) {
            attrs += ` filter="url(#blur_${shape.id})"`;
        }

        return attrs;
    }

    _getTransform(shape) {
        const transforms = [];

        if (shape.rotation && shape.rotation !== 0) {
            const cx = shape.x + (shape.width || 0) / 2;
            const cy = shape.y + (shape.height || 0) / 2;
            transforms.push(`rotate(${shape.rotation} ${cx} ${cy})`);
        }

        if ((shape.scaleX && shape.scaleX !== 1) || (shape.scaleY && shape.scaleY !== 1)) {
            const cx = shape.x + (shape.width || 0) / 2;
            const cy = shape.y + (shape.height || 0) / 2;
            transforms.push(`translate(${cx} ${cy}) scale(${shape.scaleX || 1} ${shape.scaleY || 1}) translate(${-cx} ${-cy})`);
        }

        return transforms.join(' ');
    }

    _getGradientId(shape) {
        return `grad_${shape.id}`;
    }

    _exportGradients(tab, indent) {
        let svg = '';
        const exported = new Set();

        for (const shape of this.vexel.shapes) {
            if (shape.fill && typeof shape.fill === 'object') {
                const id = this._getGradientId(shape);

                if (exported.has(id)) continue;
                exported.add(id);

                if (shape.fill.type === 'linearGradient') {
                    svg += `${tab}<linearGradient id="${id}" x1="${shape.fill.x1 || 0}" y1="${shape.fill.y1 || 0}" x2="${shape.fill.x2 || 1}" y2="${shape.fill.y2 || 1}">${indent}`;
                    for (const stop of shape.fill.stops) {
                        svg += `${tab}  <stop offset="${stop.offset}" stop-color="${stop.color}" stop-opacity="${stop.opacity !== undefined ? stop.opacity : 1}"/>${indent}`;
                    }
                    svg += `${tab}</linearGradient>${indent}`;
                } else if (shape.fill.type === 'radialGradient') {
                    svg += `${tab}<radialGradient id="${id}" cx="${shape.fill.cx || '50%'}" cy="${shape.fill.cy || '50%'}" r="${shape.fill.r || '50%'}">${indent}`;
                    for (const stop of shape.fill.stops) {
                        svg += `${tab}  <stop offset="${stop.offset}" stop-color="${stop.color}" stop-opacity="${stop.opacity !== undefined ? stop.opacity : 1}"/>${indent}`;
                    }
                    svg += `${tab}</radialGradient>${indent}`;
                }
            }
        }

        return svg;
    }

    _exportPatterns(tab, indent) {
        return '';
    }

    _exportFilters(tab, indent) {
        let svg = '';

        for (const shape of this.vexel.shapes) {
            if (shape.shadow) {
                svg += `${tab}<filter id="shadow_${shape.id}" x="-20%" y="-20%" width="140%" height="140%">${indent}`;
                svg += `${tab}  <feDropShadow dx="${shape.shadow.offsetX || 0}" dy="${shape.shadow.offsetY || 2}" stdDeviation="${(shape.shadow.blur || 4) / 2}" flood-color="${shape.shadow.color || 'rgba(0,0,0,0.3)'}"/>${indent}`;
                svg += `${tab}</filter>${indent}`;
            }

            if (shape.blur && shape.blur > 0) {
                svg += `${tab}<filter id="blur_${shape.id}">${indent}`;
                svg += `${tab}  <feGaussianBlur stdDeviation="${shape.blur}"/>${indent}`;
                svg += `${tab}</filter>${indent}`;
            }
        }

        return svg;
    }

    _exportClipPaths(tab, indent) {
        return '';
    }

    _exportMasks(tab, indent) {
        return '';
    }

    _escapeXML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    _optimize(svg) {
        return svg
            .replace(/>\s+</g, '><')
            .replace(/\s+/g, ' ')
            .replace(/\s*\/>/g, '/>')
            .trim();
    }

    download(filename = 'vexel-export.svg', options = {}) {
        const svg = this.export(options);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
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
    window.VexelSVGExport = VexelSVGExport;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelSVGExport;
}
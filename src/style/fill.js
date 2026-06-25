// src/style/fill.js

class VexelFill {
    static solid(color) {
        return {
            type: 'solid',
            color: color
        };
    }

    static linearGradient(x1, y1, x2, y2, stops) {
        return {
            type: 'linearGradient',
            x1, y1, x2, y2,
            stops: stops.map(s => ({
                offset: s.offset,
                color: s.color,
                opacity: s.opacity !== undefined ? s.opacity : 1
            }))
        };
    }

    static radialGradient(cx, cy, r, stops) {
        return {
            type: 'radialGradient',
            cx, cy, r,
            stops: stops.map(s => ({
                offset: s.offset,
                color: s.color,
                opacity: s.opacity !== undefined ? s.opacity : 1
            }))
        };
    }

    static conicalGradient(cx, cy, startAngle, stops) {
        return {
            type: 'conicalGradient',
            cx, cy, startAngle: startAngle || 0,
            stops: stops.map(s => ({
                offset: s.offset,
                color: s.color,
                opacity: s.opacity !== undefined ? s.opacity : 1
            }))
        };
    }

    static pattern(image, repeat = 'repeat') {
        return {
            type: 'pattern',
            image,
            repeat
        };
    }

    static noise(baseColor, opacity = 0.1, scale = 1) {
        return {
            type: 'noise',
            baseColor,
            opacity,
            scale
        };
    }

    static imageFill(src, fit = 'cover') {
        return {
            type: 'image',
            src,
            fit
        };
    }

    static apply(ctx, fill, bounds) {
        if (!fill) return false;

        switch (fill.type) {
            case 'solid':
                ctx.fillStyle = fill.color;
                return true;

            case 'linearGradient': {
                const gradient = ctx.createLinearGradient(
                    fill.x1 !== undefined ? fill.x1 : bounds.x,
                    fill.y1 !== undefined ? fill.y1 : bounds.y,
                    fill.x2 !== undefined ? fill.x2 : bounds.x + bounds.width,
                    fill.y2 !== undefined ? fill.y2 : bounds.y + bounds.height
                );
                for (const stop of fill.stops) {
                    gradient.addColorStop(stop.offset, VexelFill._colorWithOpacity(stop.color, stop.opacity));
                }
                ctx.fillStyle = gradient;
                return true;
            }

            case 'radialGradient': {
                const cx = fill.cx !== undefined ? fill.cx : bounds.x + bounds.width / 2;
                const cy = fill.cy !== undefined ? fill.cy : bounds.y + bounds.height / 2;
                const r = fill.r !== undefined ? fill.r : Math.max(bounds.width, bounds.height) / 2;
                const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
                for (const stop of fill.stops) {
                    gradient.addColorStop(stop.offset, VexelFill._colorWithOpacity(stop.color, stop.opacity));
                }
                ctx.fillStyle = gradient;
                return true;
            }

            case 'conicalGradient': {
                const cx = fill.cx !== undefined ? fill.cx : bounds.x + bounds.width / 2;
                const cy = fill.cy !== undefined ? fill.cy : bounds.y + bounds.height / 2;
                const gradient = VexelFill._createConicalGradient(ctx, cx, cy, fill.startAngle || 0, fill.stops);
                ctx.fillStyle = gradient;
                return true;
            }

            case 'pattern': {
                if (fill.image) {
                    const pattern = ctx.createPattern(fill.image, fill.repeat || 'repeat');
                    ctx.fillStyle = pattern;
                    return true;
                }
                return false;
            }

            case 'noise': {
                ctx.fillStyle = fill.baseColor || '#000000';
                ctx.globalAlpha = fill.opacity || 0.1;
                return true;
            }

            case 'image': {
                return false;
            }

            default:
                return false;
        }
    }

    static _colorWithOpacity(color, opacity) {
        if (opacity >= 1 || opacity === undefined) return color;

        if (color.startsWith('rgba')) {
            return color.replace(/[\d.]+\)$/, `${opacity})`);
        }

        if (color.startsWith('rgb')) {
            return color.replace('rgb', 'rgba').replace(')', `, ${opacity})`);
        }

        if (color.startsWith('#')) {
            const hex = color.replace('#', '');
            let r, g, b;

            if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
            } else {
                r = parseInt(hex.substring(0, 2), 16);
                g = parseInt(hex.substring(2, 4), 16);
                b = parseInt(hex.substring(4, 6), 16);
            }

            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }

        return color;
    }

    static _createConicalGradient(ctx, cx, cy, startAngle, stops) {
        const size = 512;
        const offCanvas = document.createElement('canvas');
        offCanvas.width = size;
        offCanvas.height = size;
        const offCtx = offCanvas.getContext('2d');

        const sortedStops = [...stops].sort((a, b) => a.offset - b.offset);

        for (let i = 0; i < sortedStops.length; i++) {
            const current = sortedStops[i];
            const next = sortedStops[(i + 1) % sortedStops.length];
            const startOffset = current.offset;
            let endOffset = next.offset;

            if (endOffset <= startOffset) {
                endOffset += 1;
            }

            const startAngleRad = (startOffset * 2 * Math.PI) + startAngle;
            const endAngleRad = (endOffset * 2 * Math.PI) + startAngle;

            offCtx.beginPath();
            offCtx.moveTo(size / 2, size / 2);
            offCtx.arc(size / 2, size / 2, size, startAngleRad, endAngleRad);
            offCtx.closePath();

            const gradient = offCtx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size);
            gradient.addColorStop(0, VexelFill._colorWithOpacity(current.color, current.opacity));
            gradient.addColorStop(1, VexelFill._colorWithOpacity(next.color, next.opacity));

            offCtx.fillStyle = gradient;
            offCtx.fill();
        }

        const pattern = ctx.createPattern(offCanvas, 'no-repeat');
        const matrix = new DOMMatrix();
        matrix.translateSelf(cx - size / 2, cy - size / 2);
        pattern.setTransform(matrix);

        return pattern;
    }

    static toSVG(fill, bounds) {
        if (!fill) return '';

        switch (fill.type) {
            case 'solid':
                return fill.color;

            case 'linearGradient': {
                const id = `grad_${Math.random().toString(36).substr(2, 9)}`;
                let svg = `<linearGradient id="${id}" x1="${fill.x1 || bounds.x}" y1="${fill.y1 || bounds.y}" x2="${fill.x2 || bounds.x + bounds.width}" y2="${fill.y2 || bounds.y + bounds.height}">`;
                for (const stop of fill.stops) {
                    svg += `<stop offset="${stop.offset}" stop-color="${stop.color}" stop-opacity="${stop.opacity !== undefined ? stop.opacity : 1}"/>`;
                }
                svg += '</linearGradient>';
                return `url(#${id})`;
            }

            case 'radialGradient': {
                const id = `grad_${Math.random().toString(36).substr(2, 9)}`;
                const cx = fill.cx || bounds.x + bounds.width / 2;
                const cy = fill.cy || bounds.y + bounds.height / 2;
                const r = fill.r || Math.max(bounds.width, bounds.height) / 2;
                let svg = `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">`;
                for (const stop of fill.stops) {
                    svg += `<stop offset="${stop.offset}" stop-color="${stop.color}" stop-opacity="${stop.opacity !== undefined ? stop.opacity : 1}"/>`;
                }
                svg += '</radialGradient>';
                return `url(#${id})`;
            }

            default:
                return fill.color || 'transparent';
        }
    }

    static parse(colorString) {
        if (!colorString || colorString === 'transparent' || colorString === 'none') {
            return null;
        }

        if (colorString.startsWith('linear-gradient')) {
            const match = colorString.match(/linear-gradient\(([^)]+)\)/);
            if (match) {
                const parts = match[1].split(',').map(s => s.trim());
                const stops = [];
                for (const part of parts) {
                    const colorMatch = part.match(/(#[a-fA-F0-9]{3,8}|rgba?\([^)]+\))/);
                    if (colorMatch) {
                        stops.push({ offset: stops.length / Math.max(1, parts.length - 1), color: colorMatch[1] });
                    }
                }
                if (stops.length >= 2) {
                    return VexelFill.linearGradient(0, 0, 1, 1, stops);
                }
            }
        }

        if (colorString.startsWith('radial-gradient')) {
            const match = colorString.match(/radial-gradient\(([^)]+)\)/);
            if (match) {
                const parts = match[1].split(',').map(s => s.trim());
                const stops = [];
                for (const part of parts) {
                    const colorMatch = part.match(/(#[a-fA-F0-9]{3,8}|rgba?\([^)]+\))/);
                    if (colorMatch) {
                        stops.push({ offset: stops.length / Math.max(1, parts.length - 1), color: colorMatch[1] });
                    }
                }
                if (stops.length >= 2) {
                    return VexelFill.radialGradient(0.5, 0.5, 0.5, stops);
                }
            }
        }

        return VexelFill.solid(colorString);
    }
}

if (typeof window !== 'undefined') {
    window.VexelFill = VexelFill;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelFill;
}
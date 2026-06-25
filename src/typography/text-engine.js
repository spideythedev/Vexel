// src/typography/text-engine.js

class VexelTextEngine {
    constructor(vexel) {
        this.vexel = vexel;
        this.fonts = new Map();
        this.defaultFont = 'sans-serif';
        this.defaultSize = 16;
        this.defaultWeight = 'normal';
        this.defaultStyle = 'normal';
        this.defaultColor = '#000000';
        this.defaultAlign = 'left';
        this.defaultLineHeight = 1.4;
        this.defaultLetterSpacing = 0;
        this.loadedFonts = {};
    }

    async loadFont(name, url, options = {}) {
        if (this.fonts.has(name)) return this.fonts.get(name);

        const font = new FontFace(name, `url(${url})`, {
            weight: options.weight || 'normal',
            style: options.style || 'normal',
            display: options.display || 'swap'
        });

        try {
            const loaded = await font.load();
            document.fonts.add(loaded);
            this.fonts.set(name, loaded);
            return loaded;
        } catch (e) {
            console.error(`Failed to load font: ${name}`, e);
            return null;
        }
    }

    loadSystemFont(name) {
        if (this.fonts.has(name)) return this.fonts.get(name);
        this.fonts.set(name, { family: name, system: true });
        return this.fonts.get(name);
    }

    getFont(name) {
        return this.fonts.get(name) || this.defaultFont;
    }

    createText(x, y, content, options = {}) {
        return new VexelText(x, y, content, {
            fontSize: options.fontSize || this.defaultSize,
            fontFamily: options.fontFamily || this.defaultFont,
            fontWeight: options.fontWeight || this.defaultWeight,
            fontStyle: options.fontStyle || this.defaultStyle,
            fill: options.fill || this.defaultColor,
            align: options.align || this.defaultAlign,
            lineHeight: options.lineHeight || this.defaultLineHeight,
            letterSpacing: options.letterSpacing || this.defaultLetterSpacing,
            opacity: options.opacity,
            visible: options.visible,
            rotation: options.rotation,
            id: options.id
        });
    }

    measureText(content, options = {}) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const fontSize = options.fontSize || this.defaultSize;
        const fontFamily = options.fontFamily || this.defaultFont;
        const fontWeight = options.fontWeight || this.defaultWeight;
        const fontStyle = options.fontStyle || this.defaultStyle;
        const lineHeight = options.lineHeight || this.defaultLineHeight;
        const letterSpacing = options.letterSpacing || this.defaultLetterSpacing;

        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.letterSpacing = `${letterSpacing}px`;

        const lines = content.split('\n');
        let maxWidth = 0;

        for (const line of lines) {
            const metrics = ctx.measureText(line);
            maxWidth = Math.max(maxWidth, metrics.width);
        }

        return {
            width: maxWidth,
            height: lines.length * fontSize * lineHeight,
            lines: lines.length,
            fontSize,
            lineHeight,
            fontFamily,
            fontWeight,
            fontStyle
        };
    }

    fitTextToWidth(content, maxWidth, options = {}) {
        const fontSize = options.fontSize || this.defaultSize;
        const fontFamily = options.fontFamily || this.defaultFont;
        const fontWeight = options.fontWeight || this.defaultWeight;
        const fontStyle = options.fontStyle || this.defaultStyle;
        const letterSpacing = options.letterSpacing || this.defaultLetterSpacing;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.letterSpacing = `${letterSpacing}px`;

        const words = content.split(' ');
        const lines = [];
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }

        return lines.join('\n');
    }

    fitTextToShape(content, shape, options = {}) {
        const bounds = shape.getBounds();
        const padding = options.padding || 8;
        const maxWidth = bounds.width - padding * 2;
        const maxHeight = bounds.height - padding * 2;

        const fontSize = options.fontSize || this.defaultSize;
        const fontFamily = options.fontFamily || this.defaultFont;
        const lineHeight = options.lineHeight || this.defaultLineHeight;
        const fontWeight = options.fontWeight || this.defaultWeight;
        const fontStyle = options.fontStyle || this.defaultStyle;
        const letterSpacing = options.letterSpacing || this.defaultLetterSpacing;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        let bestSize = fontSize;
        let fittedText = '';

        for (let size = fontSize; size >= 4; size--) {
            ctx.font = `${fontStyle} ${fontWeight} ${size}px ${fontFamily}`;
            ctx.letterSpacing = `${letterSpacing}px`;

            const words = content.split(' ');
            const lines = [];
            let currentLine = '';

            for (const word of words) {
                const testLine = currentLine ? `${currentLine} ${word}` : word;
                const metrics = ctx.measureText(testLine);

                if (metrics.width > maxWidth && currentLine) {
                    lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }

            if (currentLine) lines.push(currentLine);

            const totalHeight = lines.length * size * lineHeight;

            if (totalHeight <= maxHeight) {
                bestSize = size;
                fittedText = lines.join('\n');
                break;
            }
        }

        return {
            text: fittedText,
            fontSize: bestSize,
            lines: fittedText.split('\n').length
        };
    }

    createTextOnPath(text, pathPoints, options = {}) {
        const fontSize = options.fontSize || this.defaultSize;
        const fontFamily = options.fontFamily || this.defaultFont;
        const fontWeight = options.fontWeight || this.defaultWeight;
        const fill = options.fill || this.defaultColor;
        const offset = options.offset || 0;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

        const result = [];
        let charOffset = offset;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const metrics = ctx.measureText(char);
            const charWidth = metrics.width;

            const point = this._getPointOnPath(pathPoints, charOffset);
            const nextPoint = this._getPointOnPath(pathPoints, charOffset + charWidth);

            if (point) {
                const angle = nextPoint
                    ? Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x)
                    : 0;

                result.push({
                    char,
                    x: point.x,
                    y: point.y,
                    rotation: angle * (180 / Math.PI),
                    fontSize,
                    fontFamily,
                    fontWeight,
                    fill
                });
            }

            charOffset += charWidth;
        }

        return result;
    }

    _getPointOnPath(points, distance) {
        if (points.length < 2) return points[0] || null;

        let traveled = 0;
        for (let i = 1; i < points.length; i++) {
            const segLen = VexelMath.distance(points[i - 1], points[i]);
            if (traveled + segLen >= distance) {
                const t = segLen > 0 ? (distance - traveled) / segLen : 0;
                return VexelMath.lerp2D(points[i - 1], points[i], t);
            }
            traveled += segLen;
        }

        return points[points.length - 1];
    }

    createRichText(x, y, segments, options = {}) {
        const fontSize = options.fontSize || this.defaultSize;
        const fontFamily = options.fontFamily || this.defaultFont;
        const lineHeight = options.lineHeight || this.defaultLineHeight;
        const letterSpacing = options.letterSpacing || this.defaultLetterSpacing;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        let cursorX = x;
        let cursorY = y;
        const shapes = [];

        for (const segment of segments) {
            const segFontSize = segment.fontSize || fontSize;
            const segFontFamily = segment.fontFamily || fontFamily;
            const segFontWeight = segment.fontWeight || this.defaultWeight;
            const segFontStyle = segment.fontStyle || this.defaultStyle;
            const segFill = segment.fill || this.defaultColor;

            ctx.font = `${segFontStyle} ${segFontWeight} ${segFontSize}px ${segFontFamily}`;
            ctx.letterSpacing = `${letterSpacing}px`;

            const words = segment.text.split(' ');
            for (const word of words) {
                const metrics = ctx.measureText(word + ' ');
                const wordWidth = metrics.width;

                shapes.push(new VexelText(cursorX, cursorY, word, {
                    fontSize: segFontSize,
                    fontFamily: segFontFamily,
                    fontWeight: segFontWeight,
                    fontStyle: segFontStyle,
                    fill: segFill,
                    align: 'left',
                    letterSpacing
                }));

                cursorX += wordWidth;
            }

            cursorY += segFontSize * lineHeight;
            cursorX = x;
        }

        return shapes;
    }

    createVerticalText(x, y, content, options = {}) {
        const fontSize = options.fontSize || this.defaultSize;
        const fontFamily = options.fontFamily || this.defaultFont;
        const fontWeight = options.fontWeight || this.defaultWeight;
        const fill = options.fill || this.defaultColor;
        const spacing = options.spacing || 0;

        const shapes = [];
        let currentY = y;

        for (const char of content) {
            shapes.push(new VexelText(x, currentY, char, {
                fontSize,
                fontFamily,
                fontWeight,
                fill,
                align: 'center'
            }));
            currentY += fontSize + spacing;
        }

        return shapes;
    }

    getAvailableFonts() {
        const fonts = [];
        for (const [name, font] of this.fonts) {
            fonts.push({
                name,
                system: font.system || false,
                loaded: font.system ? true : (font.status === 'loaded')
            });
        }
        return fonts;
    }

    getSystemFonts() {
        const systemFonts = [
            'Arial', 'Helvetica', 'Times New Roman', 'Georgia',
            'Courier New', 'Verdana', 'Trebuchet MS', 'Impact',
            'Comic Sans MS', 'Palatino', 'Garamond', 'Bookman'
        ];

        return systemFonts.filter(font => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.font = `12px "${font}"`;
            const metrics = ctx.measureText('Test');
            return metrics.width > 0;
        });
    }
}

if (typeof window !== 'undefined') {
    window.VexelTextEngine = VexelTextEngine;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelTextEngine;
}
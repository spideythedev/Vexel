// src/shapes/text.js

class VexelTextStyle {
    constructor(options = {}) {
        this.fontFamily = options.fontFamily || 'Inter, -apple-system, sans-serif';
        this.fontSize = options.fontSize || 16;
        this.fontWeight = options.fontWeight || 'normal';
        this.fontStyle = options.fontStyle || 'normal';
        this.letterSpacing = options.letterSpacing || 0;
        this.lineHeight = options.lineHeight || 1.4;
        this.textAlign = options.textAlign || 'left';
        this.textDecoration = options.textDecoration || 'none';
        this.textTransform = options.textTransform || 'none';
        this.paragraphSpacing = options.paragraphSpacing || 0;
        this.textIndent = options.textIndent || 0;
        this.wordSpacing = options.wordSpacing || 0;
    }

    apply(ctx) {
        ctx.font = `${this.fontStyle} ${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
        ctx.textAlign = this.textAlign;
        ctx.textBaseline = 'alphabetic';
        ctx.letterSpacing = `${this.letterSpacing}px`;
        ctx.wordSpacing = `${this.wordSpacing}px`;
    }

    measure(ctx, text) {
        this.apply(ctx);
        const metrics = ctx.measureText(text);
        return {
            width: metrics.width,
            height: this.fontSize * this.lineHeight,
            fontSize: this.fontSize,
            lineHeight: this.lineHeight,
            actualBoundingBoxAscent: metrics.actualBoundingBoxAscent,
            actualBoundingBoxDescent: metrics.actualBoundingBoxDescent
        };
    }

    toCSS() {
        return `${this.fontStyle} ${this.fontWeight} ${this.fontSize}px/${this.lineHeight} ${this.fontFamily}`;
    }

    clone() {
        return new VexelTextStyle({
            fontFamily: this.fontFamily,
            fontSize: this.fontSize,
            fontWeight: this.fontWeight,
            fontStyle: this.fontStyle,
            letterSpacing: this.letterSpacing,
            lineHeight: this.lineHeight,
            textAlign: this.textAlign,
            textDecoration: this.textDecoration,
            textTransform: this.textTransform,
            paragraphSpacing: this.paragraphSpacing,
            textIndent: this.textIndent,
            wordSpacing: this.wordSpacing
        });
    }
}

class VexelTextRun {
    constructor(content, style = {}) {
        this.content = content || '';
        this.style = style instanceof VexelTextStyle ? style : new VexelTextStyle(style);
    }

    getWidth(ctx) {
        return this.style.measure(ctx, this.content).width;
    }

    clone() {
        return new VexelTextRun(this.content, this.style.clone());
    }
}

class VexelRichText {
    constructor(runs = []) {
        this.runs = runs;
    }

    addRun(content, style) {
        this.runs.push(new VexelTextRun(content, style));
    }

    getPlainText() {
        return this.runs.map(r => r.content).join('');
    }

    getWidth(ctx) {
        let totalWidth = 0;
        for (const run of this.runs) {
            totalWidth += run.getWidth(ctx);
        }
        return totalWidth;
    }

    draw(ctx, x, y) {
        let cursorX = x;
        for (const run of this.runs) {
            run.style.apply(ctx);
            ctx.fillText(run.content, cursorX, y);
            cursorX += run.getWidth(ctx);
        }
    }

    clone() {
        return new VexelRichText(this.runs.map(r => r.clone()));
    }
}

class VexelText {
    constructor(x, y, content, options = {}) {
        this.type = 'text';
        this.id = options.id || `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.x = x || 0;
        this.y = y || 0;
        this.content = content || '';
        this.fontSize = options.fontSize || 16;
        this.fontFamily = options.fontFamily || 'Inter, -apple-system, sans-serif';
        this.fontWeight = options.fontWeight || 'normal';
        this.fontStyle = options.fontStyle || 'normal';
        this.fill = options.fill || '#000000';
        this.opacity = options.opacity !== undefined ? options.opacity : 1;
        this.visible = options.visible !== false;
        this.locked = options.locked || false;
        this.rotation = options.rotation || 0;
        this.scaleX = options.scaleX || 1;
        this.scaleY = options.scaleY || 1;
        this.align = options.align || 'left';
        this.lineHeight = options.lineHeight || 1.4;
        this.letterSpacing = options.letterSpacing || 0;
        this.maxWidth = options.maxWidth || Infinity;
        this.autoResize = options.autoResize || false;
        this.richText = options.richText || null;
        this.name = options.name || 'Text';
        this.textDecoration = options.textDecoration || 'none';
        this.textTransform = options.textTransform || 'none';
        this._cachedBounds = null;
        this._dirty = true;
    }

    draw(ctx) {
        if (!this.visible || !this.content) return;

        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.fill;
        ctx.font = `${this.fontStyle} ${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
        ctx.textAlign = this.align;
        ctx.textBaseline = 'top';
        ctx.letterSpacing = `${this.letterSpacing}px`;

        if (this.textDecoration === 'underline') {
            ctx.textDecoration = 'underline';
        } else if (this.textDecoration === 'line-through') {
            ctx.textDecoration = 'line-through';
        }

        const cx = this.x + this.getBounds().width / 2;
        const cy = this.y + this.getBounds().height / 2;
        ctx.translate(cx, cy);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.scale(this.scaleX, this.scaleY);
        ctx.translate(-cx, -cy);

        let displayContent = this.content;
        if (this.textTransform === 'uppercase') displayContent = displayContent.toUpperCase();
        if (this.textTransform === 'lowercase') displayContent = displayContent.toLowerCase();
        if (this.textTransform === 'capitalize') {
            displayContent = displayContent.replace(/\b\w/g, c => c.toUpperCase());
        }

        if (this.richText) {
            this.richText.draw(ctx, this.x, this.y);
        } else if (this.maxWidth && this.maxWidth < Infinity) {
            const lines = this._wrapText(ctx, displayContent, this.maxWidth);
            let yOffset = this.y;
            for (const line of lines) {
                let xOffset = this.x;
                if (this.align === 'center') xOffset = this.x + this.maxWidth / 2;
                if (this.align === 'right') xOffset = this.x + this.maxWidth;
                ctx.fillText(line, xOffset, yOffset);
                yOffset += this.fontSize * this.lineHeight;
            }
        } else {
            const lines = displayContent.split('\n');
            let yOffset = this.y;
            for (const line of lines) {
                let xOffset = this.x;
                if (this.align === 'center') {
                    const metrics = ctx.measureText(line);
                    xOffset = this.x - metrics.width / 2;
                }
                if (this.align === 'right') {
                    const metrics = ctx.measureText(line);
                    xOffset = this.x - metrics.width;
                }
                ctx.fillText(line, xOffset, yOffset);
                yOffset += this.fontSize * this.lineHeight;
            }
        }

        ctx.restore();
    }

    _wrapText(ctx, text, maxWidth) {
        const words = text.split(' ');
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

        return lines;
    }

    getBounds() {
        if (!this._dirty && this._cachedBounds) return this._cachedBounds;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = `${this.fontStyle} ${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
        ctx.letterSpacing = `${this.letterSpacing}px`;

        const lines = this.maxWidth && this.maxWidth < Infinity
            ? this._wrapText(ctx, this.content, this.maxWidth)
            : this.content.split('\n');

        let maxWidth = 0;
        for (const line of lines) {
            const metrics = ctx.measureText(line);
            maxWidth = Math.max(maxWidth, metrics.width);
        }

        const totalHeight = lines.length * this.fontSize * this.lineHeight;

        this._cachedBounds = {
            x: this.align === 'center' ? this.x - maxWidth / 2 : this.align === 'right' ? this.x - maxWidth : this.x,
            y: this.y,
            width: maxWidth,
            height: totalHeight
        };

        this._dirty = false;
        return this._cachedBounds;
    }

    containsPoint(px, py) {
        const b = this.getBounds();
        return px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height;
    }

    setText(content) {
        this.content = content;
        this._dirty = true;
    }

    setFontSize(size) {
        this.fontSize = size;
        this._dirty = true;
    }

    setFontFamily(family) {
        this.fontFamily = family;
        this._dirty = true;
    }

    setFontWeight(weight) {
        this.fontWeight = weight;
        this._dirty = true;
    }

    setAlignment(align) {
        this.align = align;
        this._dirty = true;
    }

    setMaxWidth(width) {
        this.maxWidth = width;
        this._dirty = true;
    }

    serialize() {
        return {
            type: this.type,
            id: this.id,
            x: this.x,
            y: this.y,
            content: this.content,
            fontSize: this.fontSize,
            fontFamily: this.fontFamily,
            fontWeight: this.fontWeight,
            fontStyle: this.fontStyle,
            fill: this.fill,
            opacity: this.opacity,
            visible: this.visible,
            locked: this.locked,
            rotation: this.rotation,
            scaleX: this.scaleX,
            scaleY: this.scaleY,
            align: this.align,
            lineHeight: this.lineHeight,
            letterSpacing: this.letterSpacing,
            maxWidth: this.maxWidth,
            autoResize: this.autoResize,
            name: this.name,
            textDecoration: this.textDecoration,
            textTransform: this.textTransform,
            richText: this.richText ? {
                runs: this.richText.runs.map(r => ({
                    content: r.content,
                    style: {
                        fontFamily: r.style.fontFamily,
                        fontSize: r.style.fontSize,
                        fontWeight: r.style.fontWeight,
                        fontStyle: r.style.fontStyle
                    }
                }))
            } : null
        };
    }

    static deserialize(data) {
        const text = new VexelText(data.x, data.y, data.content, {
            id: data.id,
            fontSize: data.fontSize,
            fontFamily: data.fontFamily,
            fontWeight: data.fontWeight,
            fontStyle: data.fontStyle,
            fill: data.fill,
            opacity: data.opacity,
            visible: data.visible,
            locked: data.locked,
            rotation: data.rotation,
            scaleX: data.scaleX,
            scaleY: data.scaleY,
            align: data.align,
            lineHeight: data.lineHeight,
            letterSpacing: data.letterSpacing,
            maxWidth: data.maxWidth,
            autoResize: data.autoResize,
            name: data.name,
            textDecoration: data.textDecoration,
            textTransform: data.textTransform
        });

        if (data.richText && data.richText.runs) {
            text.richText = new VexelRichText(
                data.richText.runs.map(r => new VexelTextRun(r.content, new VexelTextStyle(r.style)))
            );
        }

        return text;
    }

    clone() {
        return VexelText.deserialize(this.serialize());
    }

    toSVG() {
        let svg = `<text x="${this.x}" y="${this.y}" font-size="${this.fontSize}" font-family="${this.fontFamily}" font-weight="${this.fontWeight}" font-style="${this.fontStyle}" fill="${this.fill}" opacity="${this.opacity}" text-anchor="${this.align === 'center' ? 'middle' : this.align === 'right' ? 'end' : 'start'}" transform="rotate(${this.rotation} ${this.x} ${this.y})"`;

        if (this.letterSpacing) svg += ` letter-spacing="${this.letterSpacing}"`;
        if (this.textDecoration !== 'none') svg += ` text-decoration="${this.textDecoration}"`;
        if (this.lineHeight !== 1.4) svg += ` line-height="${this.lineHeight}"`;

        svg += '>';

        const displayContent = this.textTransform === 'uppercase'
            ? this.content.toUpperCase()
            : this.textTransform === 'lowercase'
                ? this.content.toLowerCase()
                : this.content;

        svg += displayContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        svg += '</text>';
        return svg;
    }
}

if (typeof window !== 'undefined') {
    window.VexelTextStyle = VexelTextStyle;
    window.VexelTextRun = VexelTextRun;
    window.VexelRichText = VexelRichText;
    window.VexelText = VexelText;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VexelTextStyle, VexelTextRun, VexelRichText, VexelText };
}
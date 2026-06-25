// src/plugins/auto-layout.js

class VexelAutoLayout {
    constructor(vexel) {
        this.vexel = vexel;
        this.name = 'AutoLayout';
        this.version = '1.0.0';
    }

    install(vexel) {
        vexel.autoLayout = {
            stack: (shapes, options) => this.stack(shapes, options),
            grid: (shapes, options) => this.grid(shapes, options),
            distribute: (shapes, options) => this.distribute(shapes, options),
            align: (shapes, options) => this.align(shapes, options),
            pack: (shapes, options) => this.pack(shapes, options),
            wrap: (shapes, options) => this.wrap(shapes, options)
        };
    }

    uninstall(vexel) {
        delete vexel.autoLayout;
    }

    stack(shapes, options = {}) {
        const {
            direction = 'vertical',
            spacing = 16,
            padding = 0,
            alignment = 'start',
            reverse = false,
            anchor = { x: 0, y: 0 }
        } = options;

        const visible = shapes.filter(s => s.visible !== false);
        if (visible.length === 0) return;

        let offsetX = anchor.x + padding;
        let offsetY = anchor.y + padding;

        const ordered = reverse ? [...visible].reverse() : visible;

        for (const shape of ordered) {
            shape.x = offsetX;
            shape.y = offsetY;

            const bounds = shape.getBounds();

            if (direction === 'vertical') {
                offsetY += bounds.height + spacing;
            } else {
                offsetX += bounds.width + spacing;
            }
        }

        if (alignment === 'center' && direction === 'horizontal') {
            const totalHeight = Math.max(...visible.map(s => s.getBounds().height));
            for (const shape of visible) {
                shape.y = anchor.y + (totalHeight - shape.getBounds().height) / 2;
            }
        }

        if (alignment === 'center' && direction === 'vertical') {
            const totalWidth = Math.max(...visible.map(s => s.getBounds().width));
            for (const shape of visible) {
                shape.x = anchor.x + (totalWidth - shape.getBounds().width) / 2;
            }
        }

        this.vexel.dirty = true;
    }

    grid(shapes, options = {}) {
        const {
            columns = 3,
            spacing = 16,
            padding = 16,
            cellWidth = 100,
            cellHeight = 100,
            anchor = { x: 0, y: 0 }
        } = options;

        const visible = shapes.filter(s => s.visible !== false);
        if (visible.length === 0) return;

        visible.forEach((shape, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);

            shape.x = anchor.x + padding + col * (cellWidth + spacing);
            shape.y = anchor.y + padding + row * (cellHeight + spacing);

            if (shape.width !== cellWidth) shape.width = cellWidth;
            if (shape.height !== cellHeight) shape.height = cellHeight;
        });

        this.vexel.dirty = true;
    }

    distribute(shapes, options = {}) {
        const {
            direction = 'horizontal',
            spacing = 0,
            anchor = null
        } = options;

        const visible = shapes.filter(s => s.visible !== false);
        if (visible.length < 2) return;

        if (direction === 'horizontal') {
            const sorted = [...visible].sort((a, b) => a.x - b.x);
            const first = sorted[0];
            const last = sorted[sorted.length - 1];
            const startX = anchor ? anchor.x : first.x;
            const endX = anchor ? anchor.x + (last.x + last.getBounds().width - first.x) : last.x + last.getBounds().width;
            const totalWidth = endX - startX;
            const shapesWidth = sorted.reduce((sum, s) => sum + s.getBounds().width, 0);
            const totalSpacing = totalWidth - shapesWidth;
            const gap = spacing || totalSpacing / (sorted.length - 1);

            let currentX = startX;
            for (const shape of sorted) {
                shape.x = currentX;
                currentX += shape.getBounds().width + gap;
            }
        } else {
            const sorted = [...visible].sort((a, b) => a.y - b.y);
            const first = sorted[0];
            const last = sorted[sorted.length - 1];
            const startY = anchor ? anchor.y : first.y;
            const endY = anchor ? anchor.y + (last.y + last.getBounds().height - first.y) : last.y + last.getBounds().height;
            const totalHeight = endY - startY;
            const shapesHeight = sorted.reduce((sum, s) => sum + s.getBounds().height, 0);
            const totalSpacing = totalHeight - shapesHeight;
            const gap = spacing || totalSpacing / (sorted.length - 1);

            let currentY = startY;
            for (const shape of sorted) {
                shape.y = currentY;
                currentY += shape.getBounds().height + gap;
            }
        }

        this.vexel.dirty = true;
    }

    align(shapes, options = {}) {
        const {
            horizontal = null,
            vertical = null,
            relativeTo = 'selection'
        } = options;

        const visible = shapes.filter(s => s.visible !== false);
        if (visible.length === 0) return;

        let referenceBounds;
        if (relativeTo === 'first') {
            referenceBounds = visible[0].getBounds();
        } else if (relativeTo === 'last') {
            referenceBounds = visible[visible.length - 1].getBounds();
        } else if (relativeTo === 'canvas') {
            referenceBounds = { x: 0, y: 0, width: this.vexel.width, height: this.vexel.height };
        } else {
            referenceBounds = this._getUnionBounds(visible);
        }

        for (const shape of visible) {
            const bounds = shape.getBounds();

            if (horizontal === 'left') {
                shape.x = referenceBounds.x;
            } else if (horizontal === 'center') {
                shape.x = referenceBounds.x + referenceBounds.width / 2 - bounds.width / 2;
            } else if (horizontal === 'right') {
                shape.x = referenceBounds.x + referenceBounds.width - bounds.width;
            }

            if (vertical === 'top') {
                shape.y = referenceBounds.y;
            } else if (vertical === 'middle') {
                shape.y = referenceBounds.y + referenceBounds.height / 2 - bounds.height / 2;
            } else if (vertical === 'bottom') {
                shape.y = referenceBounds.y + referenceBounds.height - bounds.height;
            }
        }

        this.vexel.dirty = true;
    }

    pack(shapes, options = {}) {
        const {
            spacing = 8,
            padding = 16,
            anchor = { x: 0, y: 0 },
            sortBy = 'area'
        } = options;

        const visible = shapes.filter(s => s.visible !== false);
        if (visible.length === 0) return;

        const sorted = [...visible].sort((a, b) => {
            const aBounds = a.getBounds();
            const bBounds = b.getBounds();
            if (sortBy === 'width') return bBounds.width - aBounds.width;
            if (sortBy === 'height') return bBounds.height - aBounds.height;
            return (bBounds.width * bBounds.height) - (aBounds.width * aBounds.height);
        });

        const placed = [];
        let maxX = anchor.x + padding;
        let maxY = anchor.y + padding;

        for (const shape of sorted) {
            const bounds = shape.getBounds();
            const bw = bounds.width + spacing;
            const bh = bounds.height + spacing;

            let bestX = maxX;
            let bestY = maxY;
            let found = false;

            for (let y = anchor.y + padding; y <= maxY + bh; y += spacing) {
                for (let x = anchor.x + padding; x <= maxX + bw; x += spacing) {
                    let overlap = false;
                    for (const p of placed) {
                        const pb = p.getBounds();
                        if (
                            x < pb.x + pb.width + spacing &&
                            x + bw > pb.x &&
                            y < pb.y + pb.height + spacing &&
                            y + bh > pb.y
                        ) {
                            overlap = true;
                            break;
                        }
                    }
                    if (!overlap) {
                        bestX = x;
                        bestY = y;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }

            shape.x = bestX;
            shape.y = bestY;
            placed.push(shape);

            maxX = Math.max(maxX, bestX + bw);
            maxY = Math.max(maxY, bestY + bh);
        }

        this.vexel.dirty = true;
    }

    wrap(shapes, options = {}) {
        const {
            maxWidth = this.vexel.width,
            spacing = 16,
            padding = 16,
            anchor = { x: 0, y: 0 }
        } = options;

        const visible = shapes.filter(s => s.visible !== false);
        if (visible.length === 0) return;

        let currentX = anchor.x + padding;
        let currentY = anchor.y + padding;
        let rowHeight = 0;

        for (const shape of visible) {
            const bounds = shape.getBounds();

            if (currentX + bounds.width > anchor.x + maxWidth && currentX > anchor.x + padding) {
                currentX = anchor.x + padding;
                currentY += rowHeight + spacing;
                rowHeight = 0;
            }

            shape.x = currentX;
            shape.y = currentY;

            currentX += bounds.width + spacing;
            rowHeight = Math.max(rowHeight, bounds.height);
        }

        this.vexel.dirty = true;
    }

    _getUnionBounds(shapes) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const shape of shapes) {
            const b = shape.getBounds();
            minX = Math.min(minX, b.x);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.width);
            maxY = Math.max(maxY, b.y + b.height);
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
}

if (typeof window !== 'undefined') {
    window.VexelAutoLayout = VexelAutoLayout;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelAutoLayout;
}
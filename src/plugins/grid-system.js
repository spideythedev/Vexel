// src/plugins/grid-system.js

class VexelGridSystem {
    constructor(vexel) {
        this.vexel = vexel;
        this.name = 'Vexel Grid System';
        this.version = '1.0.0';
        this.grids = [];
        this.activeGridId = null;
        this.visible = true;
        this.snapToGrid = true;
    }

    install(vexel) {
        vexel.gridSystem = {
            create: (options) => this.createGrid(options),
            remove: (id) => this.removeGrid(id),
            activate: (id) => this.activateGrid(id),
            get: (id) => this.getGrid(id),
            getActive: () => this.getActiveGrid(),
            getAll: () => this.getAllGrids(),
            toggleVisibility: () => this.toggleVisibility(),
            toggleSnap: () => this.toggleSnap(),
            show: () => { this.visible = true; },
            hide: () => { this.visible = false; },
            snap: (x, y) => this.snap(x, y)
        };
    }

    uninstall(vexel) {
        delete vexel.gridSystem;
    }

    createGrid(options = {}) {
        const grid = {
            id: options.id || `grid_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: options.name || 'Grid',
            type: options.type || 'columns',
            columns: options.columns || 12,
            rows: options.rows || 0,
            gutter: options.gutter || 16,
            margin: options.margin || 16,
            maxWidth: options.maxWidth || this.vexel.width,
            color: options.color || 'rgba(255, 87, 34, 0.15)',
            gutterColor: options.gutterColor || 'rgba(255, 87, 34, 0.05)',
            baseline: options.baseline || 0,
            baselineColor: options.baselineColor || 'rgba(128, 128, 128, 0.1)',
            breakpoints: options.breakpoints || {},
            visible: options.visible !== false,
            snap: options.snap !== false
        };

        this.grids.push(grid);

        if (!this.activeGridId) {
            this.activeGridId = grid.id;
        }

        this.vexel.dirty = true;
        return grid;
    }

    removeGrid(id) {
        const index = this.grids.findIndex(g => g.id === id);
        if (index > -1) {
            this.grids.splice(index, 1);
            if (this.activeGridId === id) {
                this.activeGridId = this.grids.length > 0 ? this.grids[0].id : null;
            }
            this.vexel.dirty = true;
            return true;
        }
        return false;
    }

    activateGrid(id) {
        const grid = this.getGrid(id);
        if (grid) {
            this.activeGridId = id;
            this.vexel.dirty = true;
        }
    }

    getGrid(id) {
        return this.grids.find(g => g.id === id) || null;
    }

    getActiveGrid() {
        return this.getGrid(this.activeGridId);
    }

    getAllGrids() {
        return [...this.grids];
    }

    toggleVisibility() {
        this.visible = !this.visible;
        this.vexel.dirty = true;
    }

    toggleSnap() {
        this.snapToGrid = !this.snapToGrid;
    }

    snap(x, y) {
        if (!this.snapToGrid) return { x, y };

        const grid = this.getActiveGrid();
        if (!grid) return { x, y };

        if (grid.type === 'columns') {
            const totalWidth = Math.min(grid.maxWidth, this.vexel.width);
            const contentWidth = totalWidth - grid.margin * 2;
            const columnWidth = (contentWidth - (grid.columns - 1) * grid.gutter) / grid.columns;
            const gridStart = grid.margin;

            let snappedX = x;
            let snappedY = y;

            const col = Math.round((x - gridStart) / (columnWidth + grid.gutter));
            snappedX = gridStart + col * (columnWidth + grid.gutter);
            snappedX = Math.max(gridStart, Math.min(gridStart + contentWidth, snappedX));

            if (grid.baseline > 0) {
                snappedY = Math.round(y / grid.baseline) * grid.baseline;
            }

            return { x: snappedX, y: snappedY };
        }

        if (grid.type === 'grid' && grid.rows > 0) {
            const totalWidth = Math.min(grid.maxWidth, this.vexel.width);
            const totalHeight = this.vexel.height;
            const contentWidth = totalWidth - grid.margin * 2;
            const contentHeight = totalHeight - grid.margin * 2;
            const cellWidth = (contentWidth - (grid.columns - 1) * grid.gutter) / grid.columns;
            const cellHeight = (contentHeight - (grid.rows - 1) * grid.gutter) / grid.rows;
            const gridStartX = grid.margin;
            const gridStartY = grid.margin;

            const col = Math.round((x - gridStartX) / (cellWidth + grid.gutter));
            const row = Math.round((y - gridStartY) / (cellHeight + grid.gutter));

            return {
                x: gridStartX + col * (cellWidth + grid.gutter),
                y: gridStartY + row * (cellHeight + grid.gutter)
            };
        }

        if (grid.baseline > 0) {
            return { x, y: Math.round(y / grid.baseline) * grid.baseline };
        }

        return { x, y };
    }

    draw(ctx) {
        if (!this.visible) return;

        const grid = this.getActiveGrid();
        if (!grid) return;

        ctx.save();

        const totalWidth = Math.min(grid.maxWidth, this.vexel.width);
        const offsetX = Math.max(0, (this.vexel.width - totalWidth) / 2);

        if (grid.type === 'columns') {
            const contentWidth = totalWidth - grid.margin * 2;
            const columnWidth = (contentWidth - (grid.columns - 1) * grid.gutter) / grid.columns;
            let x = offsetX + grid.margin;

            ctx.fillStyle = grid.color;

            for (let i = 0; i < grid.columns; i++) {
                ctx.fillRect(x, 0, columnWidth, this.vexel.height);

                if (i < grid.columns - 1 && grid.gutterColor !== 'transparent') {
                    ctx.fillStyle = grid.gutterColor;
                    ctx.fillRect(x + columnWidth, 0, grid.gutter, this.vexel.height);
                    ctx.fillStyle = grid.color;
                }

                x += columnWidth + grid.gutter;
            }
        }

        if (grid.type === 'grid' && grid.rows > 0) {
            const contentWidth = totalWidth - grid.margin * 2;
            const contentHeight = this.vexel.height - grid.margin * 2;
            const cellWidth = (contentWidth - (grid.columns - 1) * grid.gutter) / grid.columns;
            const cellHeight = (contentHeight - (grid.rows - 1) * grid.gutter) / grid.rows;

            ctx.fillStyle = grid.color;

            let y = grid.margin;
            for (let row = 0; row < grid.rows; row++) {
                let x = offsetX + grid.margin;
                for (let col = 0; col < grid.columns; col++) {
                    ctx.fillRect(x, y, cellWidth, cellHeight);
                    x += cellWidth + grid.gutter;
                }
                y += cellHeight + grid.gutter;
            }
        }

        if (grid.baseline > 0) {
            ctx.strokeStyle = grid.baselineColor;
            ctx.lineWidth = 0.5;

            for (let y = 0; y < this.vexel.height; y += grid.baseline) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(this.vexel.width, y);
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    getColumns() {
        const grid = this.getActiveGrid();
        if (!grid || grid.type !== 'columns') return [];

        const totalWidth = Math.min(grid.maxWidth, this.vexel.width);
        const contentWidth = totalWidth - grid.margin * 2;
        const columnWidth = (contentWidth - (grid.columns - 1) * grid.gutter) / grid.columns;
        const offsetX = Math.max(0, (this.vexel.width - totalWidth) / 2);
        const columns = [];

        let x = offsetX + grid.margin;
        for (let i = 0; i < grid.columns; i++) {
            columns.push({
                index: i,
                x,
                width: columnWidth,
                gutter: i < grid.columns - 1 ? grid.gutter : 0
            });
            x += columnWidth + grid.gutter;
        }

        return columns;
    }

    spanColumns(start, end) {
        const columns = this.getColumns();
        if (start < 0 || end >= columns.length || start > end) return null;

        const first = columns[start];
        const last = columns[end];

        return {
            x: first.x,
            width: (last.x + last.width) - first.x
        };
    }

    createBreakpoint(name, minWidth, columns, gutter, margin) {
        const grid = this.getActiveGrid();
        if (!grid) return;

        grid.breakpoints[name] = { minWidth, columns, gutter, margin };
    }

    applyBreakpoint() {
        if (typeof window === 'undefined') return;

        const grid = this.getActiveGrid();
        if (!grid) return;

        const viewportWidth = window.innerWidth;
        let applied = false;

        const sorted = Object.entries(grid.breakpoints)
            .sort(([, a], [, b]) => b.minWidth - a.minWidth);

        for (const [, bp] of sorted) {
            if (viewportWidth >= bp.minWidth) {
                grid.columns = bp.columns;
                grid.gutter = bp.gutter;
                grid.margin = bp.margin;
                applied = true;
                break;
            }
        }

        if (applied) {
            this.vexel.dirty = true;
        }
    }

    serialize() {
        return this.grids.map(g => ({ ...g }));
    }

    deserialize(data) {
        this.grids = data.map(g => ({ ...g }));
        if (this.grids.length > 0) {
            this.activeGridId = this.grids[0].id;
        }
    }
}

if (typeof window !== 'undefined') {
    window.VexelGridSystem = VexelGridSystem;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelGridSystem;
}
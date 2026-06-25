// src/plugins/constraints.js

class VexelConstraints {
    constructor(vexel) {
        this.vexel = vexel;
        this.name = 'Vexel Constraints';
        this.version = '1.0.0';
        this.constraints = new Map();
        this.enabled = true;
    }

    install(vexel) {
        vexel.constraints = {
            set: (shapeId, constraint) => this.set(shapeId, constraint),
            get: (shapeId) => this.get(shapeId),
            remove: (shapeId) => this.remove(shapeId),
            apply: (shapeId) => this.apply(shapeId),
            applyAll: () => this.applyAll(),
            clear: () => this.clear(),
            enable: () => { this.enabled = true; },
            disable: () => { this.enabled = false; }
        };
    }

    uninstall(vexel) {
        delete vexel.constraints;
    }

    set(shapeId, constraint) {
        this.constraints.set(shapeId, {
            horizontal: constraint.horizontal || 'none',
            vertical: constraint.vertical || 'none',
            left: constraint.left || 0,
            right: constraint.right || 0,
            top: constraint.top || 0,
            bottom: constraint.bottom || 0,
            width: constraint.width !== undefined ? constraint.width : null,
            height: constraint.height !== undefined ? constraint.height : null,
            relativeTo: constraint.relativeTo || 'parent',
            parentId: constraint.parentId || null
        });
    }

    get(shapeId) {
        return this.constraints.get(shapeId) || null;
    }

    remove(shapeId) {
        return this.constraints.delete(shapeId);
    }

    apply(shapeId) {
        if (!this.enabled) return;

        const constraint = this.constraints.get(shapeId);
        if (!constraint) return;

        const shape = this.vexel.shapes.find(s => s.id === shapeId);
        if (!shape) return;

        let parentBounds;

        if (constraint.relativeTo === 'parent' && constraint.parentId) {
            const parent = this.vexel.shapes.find(s => s.id === constraint.parentId);
            if (parent) {
                parentBounds = parent.getBounds();
            }
        } else if (constraint.relativeTo === 'parent') {
            const parent = this._findParent(shape);
            if (parent) {
                parentBounds = parent.getBounds();
            } else {
                parentBounds = { x: 0, y: 0, width: this.vexel.width, height: this.vexel.height };
            }
        } else if (constraint.relativeTo === 'canvas') {
            parentBounds = { x: 0, y: 0, width: this.vexel.width, height: this.vexel.height };
        }

        if (!parentBounds) return;

        const bounds = shape.getBounds();
        const padding = { left: constraint.left, right: constraint.right, top: constraint.top, bottom: constraint.bottom };

        if (constraint.horizontal === 'left') {
            shape.x = parentBounds.x + padding.left;
        } else if (constraint.horizontal === 'right') {
            shape.x = parentBounds.x + parentBounds.width - bounds.width - padding.right;
        } else if (constraint.horizontal === 'center') {
            shape.x = parentBounds.x + parentBounds.width / 2 - bounds.width / 2;
        } else if (constraint.horizontal === 'stretch') {
            shape.x = parentBounds.x + padding.left;
            if (shape.width !== undefined) {
                shape.width = parentBounds.width - padding.left - padding.right;
            }
        } else if (constraint.horizontal === 'scale') {
            const newWidth = parentBounds.width - padding.left - padding.right;
            if (shape.width && shape.width > 0) {
                shape.scaleX = newWidth / shape.width;
            }
            shape.x = parentBounds.x + padding.left;
        }

        if (constraint.vertical === 'top') {
            shape.y = parentBounds.y + padding.top;
        } else if (constraint.vertical === 'bottom') {
            shape.y = parentBounds.y + parentBounds.height - bounds.height - padding.bottom;
        } else if (constraint.vertical === 'center') {
            shape.y = parentBounds.y + parentBounds.height / 2 - bounds.height / 2;
        } else if (constraint.vertical === 'stretch') {
            shape.y = parentBounds.y + padding.top;
            if (shape.height !== undefined) {
                shape.height = parentBounds.height - padding.top - padding.bottom;
            }
        } else if (constraint.vertical === 'scale') {
            const newHeight = parentBounds.height - padding.top - padding.bottom;
            if (shape.height && shape.height > 0) {
                shape.scaleY = newHeight / shape.height;
            }
            shape.y = parentBounds.y + padding.top;
        }

        if (constraint.width !== null) {
            shape.width = constraint.width;
        }

        if (constraint.height !== null) {
            shape.height = constraint.height;
        }

        shape._dirty = true;
        this.vexel.dirty = true;
    }

    applyAll() {
        for (const shapeId of this.constraints.keys()) {
            this.apply(shapeId);
        }
    }

    _findParent(shape) {
        for (const s of this.vexel.shapes) {
            if (s.type === 'frame' || s.type === 'group') {
                if (s.shapes && s.shapes.includes(shape)) {
                    return s;
                }
            }
        }
        return null;
    }

    clear() {
        this.constraints.clear();
    }

    pinLeft(shapeId, offset = 0) {
        this.set(shapeId, {
            ...this.get(shapeId),
            horizontal: 'left',
            left: offset
        });
    }

    pinRight(shapeId, offset = 0) {
        this.set(shapeId, {
            ...this.get(shapeId),
            horizontal: 'right',
            right: offset
        });
    }

    pinTop(shapeId, offset = 0) {
        this.set(shapeId, {
            ...this.get(shapeId),
            vertical: 'top',
            top: offset
        });
    }

    pinBottom(shapeId, offset = 0) {
        this.set(shapeId, {
            ...this.get(shapeId),
            vertical: 'bottom',
            bottom: offset
        });
    }

    pinCenter(shapeId) {
        this.set(shapeId, {
            ...this.get(shapeId),
            horizontal: 'center',
            vertical: 'center'
        });
    }

    fillContainer(shapeId, padding = 0) {
        this.set(shapeId, {
            horizontal: 'stretch',
            vertical: 'stretch',
            left: padding,
            right: padding,
            top: padding,
            bottom: padding
        });
    }

    fillWidth(shapeId, padding = 0) {
        this.set(shapeId, {
            ...this.get(shapeId),
            horizontal: 'stretch',
            left: padding,
            right: padding
        });
    }

    fillHeight(shapeId, padding = 0) {
        this.set(shapeId, {
            ...this.get(shapeId),
            vertical: 'stretch',
            top: padding,
            bottom: padding
        });
    }

    aspectRatio(shapeId, ratio) {
        const constraint = this.get(shapeId) || {};
        constraint.aspectRatio = ratio;
        this.set(shapeId, constraint);
    }

    serialize() {
        const data = {};
        for (const [id, constraint] of this.constraints) {
            data[id] = { ...constraint };
        }
        return data;
    }

    deserialize(data) {
        this.constraints.clear();
        for (const [id, constraint] of Object.entries(data)) {
            this.constraints.set(id, { ...constraint });
        }
    }

    getStats() {
        return {
            totalConstraints: this.constraints.size,
            enabled: this.enabled
        };
    }
}

if (typeof window !== 'undefined') {
    window.VexelConstraints = VexelConstraints;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelConstraints;
}
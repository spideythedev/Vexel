// src/utils/history.js

class VexelHistory {
    constructor(vexel, options = {}) {
        this.vexel = vexel;
        this.maxSteps = options.maxSteps || 100;
        this.undoStack = [];
        this.redoStack = [];
        this.currentBatch = null;
        this.batching = false;
        this.savedPoint = null;
        this.listeners = [];
    }

    push(action) {
        if (this.batching && this.currentBatch !== null) {
            this.currentBatch.actions.push(action);
            return;
        }

        this.undoStack.push({
            ...action,
            timestamp: Date.now()
        });

        if (this.undoStack.length > this.maxSteps) {
            this.undoStack.shift();
        }

        this.redoStack = [];
        this._notifyListeners('push', action);
    }

    startBatch(name = 'Batch') {
        this.batching = true;
        this.currentBatch = {
            name,
            actions: [],
            timestamp: Date.now()
        };
    }

    endBatch() {
        if (!this.batching || !this.currentBatch) return;

        this.batching = false;

        if (this.currentBatch.actions.length > 0) {
            this.undoStack.push(this.currentBatch);
            if (this.undoStack.length > this.maxSteps) {
                this.undoStack.shift();
            }
            this.redoStack = [];
            this._notifyListeners('push', this.currentBatch);
        }

        this.currentBatch = null;
    }

    undo() {
        if (this.undoStack.length === 0) return false;

        const action = this.undoStack.pop();
        this.redoStack.push(action);
        this._applyUndo(action);
        this.vexel.dirty = true;
        this._notifyListeners('undo', action);
        return true;
    }

    redo() {
        if (this.redoStack.length === 0) return false;

        const action = this.redoStack.pop();
        this.undoStack.push(action);
        this._applyRedo(action);
        this.vexel.dirty = true;
        this._notifyListeners('redo', action);
        return true;
    }

    _applyUndo(action) {
        if (action.type === 'batch') {
            for (let i = action.actions.length - 1; i >= 0; i--) {
                this._applyUndo(action.actions[i]);
            }
            return;
        }

        switch (action.type) {
            case 'add-shapes':
                for (const shape of action.shapes) {
                    const index = this.vexel.shapes.indexOf(shape);
                    if (index > -1) this.vexel.shapes.splice(index, 1);
                }
                break;

            case 'remove-shapes':
                for (let i = action.shapes.length - 1; i >= 0; i--) {
                    this.vexel.shapes.splice(action.indices[i], 0, action.shapes[i]);
                }
                break;

            case 'move-shapes':
                for (const item of action.previousPositions) {
                    const shape = this.vexel.shapes.find(s => s.id === item.id);
                    if (shape) {
                        shape.x = item.x;
                        shape.y = item.y;
                    }
                }
                break;

            case 'transform-shape':
                const shape = this.vexel.shapes.find(s => s.id === action.shapeId);
                if (shape && action.previousState) {
                    Object.assign(shape, action.previousState);
                }
                break;

            case 'style-change':
                const styleShape = this.vexel.shapes.find(s => s.id === action.shapeId);
                if (styleShape && action.previousStyle) {
                    Object.assign(styleShape, action.previousStyle);
                }
                break;

            case 'delete-all':
                this.vexel.shapes = [...action.previousShapes];
                break;

            case 'reorder':
                const reorderShape = this.vexel.shapes.find(s => s.id === action.shapeId);
                if (reorderShape) {
                    const idx = this.vexel.shapes.indexOf(reorderShape);
                    if (idx > -1) {
                        this.vexel.shapes.splice(idx, 1);
                        this.vexel.shapes.splice(action.previousIndex, 0, reorderShape);
                    }
                }
                break;
        }
    }

    _applyRedo(action) {
        if (action.type === 'batch') {
            for (const subAction of action.actions) {
                this._applyRedo(subAction);
            }
            return;
        }

        switch (action.type) {
            case 'add-shapes':
                for (const shape of action.shapes) {
                    this.vexel.shapes.push(shape);
                }
                break;

            case 'remove-shapes':
                for (const shape of action.shapes) {
                    const index = this.vexel.shapes.indexOf(shape);
                    if (index > -1) this.vexel.shapes.splice(index, 1);
                }
                break;

            case 'move-shapes':
                for (const item of action.positions) {
                    const shape = this.vexel.shapes.find(s => s.id === item.id);
                    if (shape) {
                        shape.x = item.x;
                        shape.y = item.y;
                    }
                }
                break;

            case 'transform-shape':
                const shape = this.vexel.shapes.find(s => s.id === action.shapeId);
                if (shape && action.newState) {
                    Object.assign(shape, action.newState);
                }
                break;

            case 'style-change':
                const styleShape = this.vexel.shapes.find(s => s.id === action.shapeId);
                if (styleShape && action.newStyle) {
                    Object.assign(styleShape, action.newStyle);
                }
                break;

            case 'delete-all':
                this.vexel.shapes = [];
                break;

            case 'reorder':
                const reorderShape = this.vexel.shapes.find(s => s.id === action.shapeId);
                if (reorderShape) {
                    const idx = this.vexel.shapes.indexOf(reorderShape);
                    if (idx > -1) {
                        this.vexel.shapes.splice(idx, 1);
                        this.vexel.shapes.splice(action.newIndex, 0, reorderShape);
                    }
                }
                break;
        }
    }

    recordAdd(shapes) {
        const shapeList = Array.isArray(shapes) ? shapes : [shapes];
        this.push({
            type: 'add-shapes',
            shapes: shapeList
        });
    }

    recordRemove(shapes) {
        const shapeList = Array.isArray(shapes) ? shapes : [shapes];
        const indices = shapeList.map(s => this.vexel.shapes.indexOf(s));
        this.push({
            type: 'remove-shapes',
            shapes: shapeList,
            indices
        });
    }

    recordMove(shapes, previousPositions) {
        const shapeList = Array.isArray(shapes) ? shapes : [shapes];
        this.push({
            type: 'move-shapes',
            shapes: shapeList,
            previousPositions: previousPositions.map((pos, i) => ({
                id: shapeList[i].id,
                x: pos.x,
                y: pos.y
            })),
            positions: shapeList.map(s => ({
                id: s.id,
                x: s.x,
                y: s.y
            }))
        });
    }

    recordTransform(shape, previousState) {
        this.push({
            type: 'transform-shape',
            shapeId: shape.id,
            previousState: { ...previousState },
            newState: {
                x: shape.x,
                y: shape.y,
                width: shape.width,
                height: shape.height,
                rotation: shape.rotation,
                scaleX: shape.scaleX,
                scaleY: shape.scaleY
            }
        });
    }

    recordStyleChange(shape, previousStyle) {
        this.push({
            type: 'style-change',
            shapeId: shape.id,
            previousStyle: { ...previousStyle },
            newStyle: {
                fill: shape.fill,
                stroke: shape.stroke,
                strokeWidth: shape.strokeWidth,
                opacity: shape.opacity,
                cornerRadius: shape.cornerRadius
            }
        });
    }

    recordDeleteAll() {
        this.push({
            type: 'delete-all',
            previousShapes: [...this.vexel.shapes]
        });
    }

    recordReorder(shape, previousIndex) {
        this.push({
            type: 'reorder',
            shapeId: shape.id,
            previousIndex,
            newIndex: this.vexel.shapes.indexOf(shape)
        });
    }

    markSaved() {
        this.savedPoint = this.undoStack.length;
    }

    isSaved() {
        return this.savedPoint === null || this.savedPoint === this.undoStack.length;
    }

    hasUnsavedChanges() {
        return !this.isSaved();
    }

    getUndoCount() {
        return this.undoStack.length;
    }

    getRedoCount() {
        return this.redoStack.length;
    }

    getUndoDescription() {
        if (this.undoStack.length === 0) return null;
        const action = this.undoStack[this.undoStack.length - 1];
        if (action.type === 'batch') return action.name;
        return action.type;
    }

    getRedoDescription() {
        if (this.redoStack.length === 0) return null;
        const action = this.redoStack[this.redoStack.length - 1];
        if (action.type === 'batch') return action.name;
        return action.type;
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.currentBatch = null;
        this.batching = false;
        this.savedPoint = null;
        this._notifyListeners('clear');
    }

    on(event, callback) {
        this.listeners.push({ event, callback });
    }

    off(event, callback) {
        this.listeners = this.listeners.filter(
            l => !(l.event === event && l.callback === callback)
        );
    }

    _notifyListeners(event, data) {
        for (const listener of this.listeners) {
            if (listener.event === event || listener.event === '*') {
                listener.callback(event, data);
            }
        }
    }
}

class VexelClipboard {
    constructor(vexel) {
        this.vexel = vexel;
        this.items = [];
        this.maxItems = 20;
    }

    copy(shapes) {
        const shapeList = Array.isArray(shapes) ? shapes : [shapes];
        const data = shapeList.map(s => s.serialize());

        this.items.push({
            shapes: data,
            timestamp: Date.now()
        });

        if (this.items.length > this.maxItems) {
            this.items.shift();
        }

        try {
            const json = JSON.stringify(data);
            navigator.clipboard.writeText(json);
        } catch (e) {
            console.warn('Clipboard write failed:', e);
        }

        return data;
    }

    cut(shapes) {
        const data = this.copy(shapes);
        const shapeList = Array.isArray(shapes) ? shapes : [shapes];

        for (const shape of shapeList) {
            const index = this.vexel.shapes.indexOf(shape);
            if (index > -1) {
                this.vexel.shapes.splice(index, 1);
            }
        }

        this.vexel.deselectAll();
        this.vexel.dirty = true;
        return data;
    }

    paste(x, y) {
        if (this.items.length === 0) return [];

        const lastItem = this.items[this.items.length - 1];
        const newShapes = [];

        for (const shapeData of lastItem.shapes) {
            const Ctor = {
                rectangle: VexelRectangle,
                ellipse: VexelEllipse,
                polygon: VexelPolygon,
                line: VexelLine,
                path: VexelPath,
                text: VexelText,
                image: VexelImage,
                group: VexelGroup
            }[shapeData.type];

            if (Ctor && Ctor.deserialize) {
                const shape = Ctor.deserialize(shapeData);
                shape.id = shape._generateId();

                if (x !== undefined) shape.x = x + (shapeData.x - lastItem.shapes[0].x);
                if (y !== undefined) shape.y = y + (shapeData.y - lastItem.shapes[0].y);

                this.vexel.shapes.push(shape);
                newShapes.push(shape);
            }
        }

        this.vexel.deselectAll();
        for (const shape of newShapes) {
            this.vexel.select(shape);
        }

        this.vexel.dirty = true;
        return newShapes;
    }

    pasteInPlace() {
        return this.paste(0, 0);
    }

    duplicate(shapes) {
        const data = this.copy(shapes);
        const newShapes = this.pasteInPlace();

        for (const shape of newShapes) {
            shape.x += 20;
            shape.y += 20;
        }

        return newShapes;
    }

    hasContent() {
        return this.items.length > 0;
    }

    clear() {
        this.items = [];
    }
}

if (typeof window !== 'undefined') {
    window.VexelHistory = VexelHistory;
    window.VexelClipboard = VexelClipboard;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VexelHistory, VexelClipboard };
}
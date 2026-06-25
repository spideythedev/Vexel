// src/core/scene-graph.js

class VexelSceneGraph {
    constructor() {
        this.root = new VexelSceneNode('root', 'root');
        this.nodeMap = new Map();
        this.nodeMap.set('root', this.root);
        this.dirtyNodes = new Set();
    }

    createNode(id, type = 'group', parentId = 'root') {
        if (this.nodeMap.has(id)) {
            console.warn(`Node "${id}" already exists`);
            return this.nodeMap.get(id);
        }

        const parent = this.nodeMap.get(parentId) || this.root;
        const node = new VexelSceneNode(id, type, parent);
        parent.addChild(node);
        this.nodeMap.set(id, node);
        this.dirtyNodes.add(node);
        return node;
    }

    removeNode(id) {
        const node = this.nodeMap.get(id);
        if (!node || id === 'root') return false;

        node.parent.removeChild(node);
        this._removeSubtree(node);
        this.dirtyNodes.add(node.parent);
        return true;
    }

    _removeSubtree(node) {
        for (const child of node.children) {
            this._removeSubtree(child);
            this.nodeMap.delete(child.id);
        }
        this.nodeMap.delete(node.id);
    }

    getNode(id) {
        return this.nodeMap.get(id) || null;
    }

    getParent(id) {
        const node = this.nodeMap.get(id);
        return node ? node.parent : null;
    }

    getChildren(id) {
        const node = this.nodeMap.get(id);
        return node ? [...node.children] : [];
    }

    getSiblings(id) {
        const node = this.nodeMap.get(id);
        if (!node || !node.parent) return [];
        return node.parent.children.filter(c => c.id !== id);
    }

    getAncestors(id) {
        const ancestors = [];
        let current = this.nodeMap.get(id);
        while (current && current.parent && current.id !== 'root') {
            ancestors.push(current.parent);
            current = current.parent;
        }
        return ancestors;
    }

    getDescendants(id) {
        const node = this.nodeMap.get(id);
        if (!node) return [];
        const descendants = [];
        this._collectDescendants(node, descendants);
        return descendants;
    }

    _collectDescendants(node, result) {
        for (const child of node.children) {
            result.push(child);
            this._collectDescendants(child, result);
        }
    }

    moveNode(id, newParentId, index = -1) {
        const node = this.nodeMap.get(id);
        const newParent = this.nodeMap.get(newParentId);

        if (!node || !newParent || id === 'root') return false;
        if (this._isDescendant(newParent, node)) return false;

        if (node.parent) {
            node.parent.removeChild(node);
            this.dirtyNodes.add(node.parent);
        }

        newParent.addChild(node, index);
        node.parent = newParent;
        this.dirtyNodes.add(newParent);
        this.dirtyNodes.add(node);
        return true;
    }

    _isDescendant(ancestor, node) {
        let current = node;
        while (current) {
            if (current.id === ancestor.id) return true;
            current = current.parent;
        }
        return false;
    }

    reorderChildren(parentId, childOrder) {
        const parent = this.nodeMap.get(parentId);
        if (!parent) return false;

        const ordered = childOrder
            .map(id => this.nodeMap.get(id))
            .filter(Boolean);

        if (ordered.length !== parent.children.length) return false;

        parent.children = ordered;
        this.dirtyNodes.add(parent);
        return true;
    }

    setVisibility(id, visible) {
        const node = this.nodeMap.get(id);
        if (!node) return false;
        node.visible = visible;
        this.dirtyNodes.add(node);
        return true;
    }

    setLocked(id, locked) {
        const node = this.nodeMap.get(id);
        if (!node) return false;
        node.locked = locked;
        return true;
    }

    setOpacity(id, opacity) {
        const node = this.nodeMap.get(id);
        if (!node) return false;
        node.opacity = Math.max(0, Math.min(1, opacity));
        this.dirtyNodes.add(node);
        return true;
    }

    setBlendMode(id, blendMode) {
        const node = this.nodeMap.get(id);
        if (!node) return false;
        node.blendMode = blendMode;
        this.dirtyNodes.add(node);
        return true;
    }

    attachShape(nodeId, shape) {
        const node = this.nodeMap.get(nodeId);
        if (!node) return false;
        node.shape = shape;
        this.dirtyNodes.add(node);
        return true;
    }

    detachShape(nodeId) {
        const node = this.nodeMap.get(nodeId);
        if (!node) return false;
        const shape = node.shape;
        node.shape = null;
        this.dirtyNodes.add(node);
        return shape;
    }

    getWorldTransform(id) {
        const node = this.nodeMap.get(id);
        if (!node) return VexelMatrix.identity();

        let matrix = VexelMatrix.identity();
        let current = node;

        while (current && current.id !== 'root') {
            const localMatrix = VexelMatrix.identity()
                .translate(current.x, current.y)
                .rotate(current.rotation * VexelMath.DEG_TO_RAD)
                .scale(current.scaleX, current.scaleY);

            matrix = localMatrix.multiply(matrix);
            current = current.parent;
        }

        return matrix;
    }

    getLocalTransform(id) {
        const node = this.nodeMap.get(id);
        if (!node) return VexelMatrix.identity();

        return VexelMatrix.identity()
            .translate(node.x, node.y)
            .rotate(node.rotation * VexelMath.DEG_TO_RAD)
            .scale(node.scaleX, node.scaleY);
    }

    getWorldBounds(id) {
        const node = this.nodeMap.get(id);
        if (!node || !node.shape) return null;

        const bounds = node.shape.getBounds();
        const matrix = this.getWorldTransform(id);

        const corners = [
            matrix.transformPoint({ x: bounds.x, y: bounds.y }),
            matrix.transformPoint({ x: bounds.x + bounds.width, y: bounds.y }),
            matrix.transformPoint({ x: bounds.x, y: bounds.y + bounds.height }),
            matrix.transformPoint({ x: bounds.x + bounds.width, y: bounds.y + bounds.height })
        ];

        return VexelBounds.fromPoints(corners);
    }

    getDirtyNodes() {
        const dirty = [...this.dirtyNodes];
        this.dirtyNodes.clear();
        return dirty;
    }

    markDirty(id) {
        const node = this.nodeMap.get(id);
        if (node) this.dirtyNodes.add(node);
    }

    markAllDirty() {
        for (const node of this.nodeMap.values()) {
            this.dirtyNodes.add(node);
        }
    }

    traverse(callback, startId = 'root') {
        const startNode = this.nodeMap.get(startId);
        if (!startNode) return;

        const stack = [startNode];
        while (stack.length > 0) {
            const node = stack.shift();
            callback(node);
            for (const child of node.children) {
                stack.push(child);
            }
        }
    }

    traverseReverse(callback, startId = 'root') {
        const startNode = this.nodeMap.get(startId);
        if (!startNode) return;

        for (let i = startNode.children.length - 1; i >= 0; i--) {
            this.traverseReverse(callback, startNode.children[i].id);
        }
        callback(startNode);
    }

    cloneNode(id, newId) {
        const node = this.nodeMap.get(id);
        if (!node) return null;

        const cloned = this.createNode(newId, node.type, node.parent ? node.parent.id : 'root');
        cloned.x = node.x;
        cloned.y = node.y;
        cloned.rotation = node.rotation;
        cloned.scaleX = node.scaleX;
        cloned.scaleY = node.scaleY;
        cloned.opacity = node.opacity;
        cloned.visible = node.visible;
        cloned.locked = node.locked;
        cloned.blendMode = node.blendMode;

        if (node.shape) {
            cloned.shape = node.shape.clone();
        }

        for (const child of node.children) {
            this.cloneNode(child.id, `${newId}_${child.id}`);
        }

        return cloned;
    }

    serialize() {
        const data = {
            nodes: []
        };

        this.traverse((node) => {
            if (node.id === 'root') return;
            data.nodes.push({
                id: node.id,
                type: node.type,
                parentId: node.parent ? node.parent.id : 'root',
                x: node.x,
                y: node.y,
                rotation: node.rotation,
                scaleX: node.scaleX,
                scaleY: node.scaleY,
                opacity: node.opacity,
                visible: node.visible,
                locked: node.locked,
                blendMode: node.blendMode,
                shape: node.shape ? node.shape.serialize() : null
            });
        });

        return data;
    }

    deserialize(data) {
        this.clear();

        for (const nodeData of data.nodes) {
            const node = this.createNode(nodeData.id, nodeData.type, nodeData.parentId);
            node.x = nodeData.x || 0;
            node.y = nodeData.y || 0;
            node.rotation = nodeData.rotation || 0;
            node.scaleX = nodeData.scaleX || 1;
            node.scaleY = nodeData.scaleY || 1;
            node.opacity = nodeData.opacity !== undefined ? nodeData.opacity : 1;
            node.visible = nodeData.visible !== false;
            node.locked = nodeData.locked || false;
            node.blendMode = nodeData.blendMode || 'normal';

            if (nodeData.shape) {
                const Ctor = {
                    rectangle: VexelRectangle,
                    ellipse: VexelEllipse,
                    polygon: VexelPolygon,
                    line: VexelLine,
                    path: VexelPath,
                    text: VexelText,
                    image: VexelImage,
                    group: VexelGroup
                }[nodeData.shape.type];

                if (Ctor && Ctor.deserialize) {
                    node.shape = Ctor.deserialize(nodeData.shape);
                }
            }
        }
    }

    clear() {
        for (const [id, node] of this.nodeMap) {
            if (id !== 'root') {
                this.nodeMap.delete(id);
            }
        }
        this.root.children = [];
        this.dirtyNodes.clear();
    }

    getStats() {
        return {
            totalNodes: this.nodeMap.size,
            rootChildren: this.root.children.length,
            dirtyNodes: this.dirtyNodes.size
        };
    }
}

class VexelSceneNode {
    constructor(id, type, parent = null) {
        this.id = id;
        this.type = type;
        this.parent = parent;
        this.children = [];
        this.shape = null;
        this.x = 0;
        this.y = 0;
        this.rotation = 0;
        this.scaleX = 1;
        this.scaleY = 1;
        this.opacity = 1;
        this.visible = true;
        this.locked = false;
        this.blendMode = 'normal';
        this.metadata = {};
        this.createdAt = Date.now();
    }

    addChild(node, index = -1) {
        if (node.parent) {
            node.parent.removeChild(node);
        }
        node.parent = this;

        if (index >= 0 && index < this.children.length) {
            this.children.splice(index, 0, node);
        } else {
            this.children.push(node);
        }
    }

    removeChild(node) {
        const index = this.children.indexOf(node);
        if (index > -1) {
            this.children.splice(index, 1);
            node.parent = null;
        }
    }

    hasChild(node) {
        return this.children.includes(node);
    }

    getChildIndex(node) {
        return this.children.indexOf(node);
    }

    getChildById(id) {
        for (const child of this.children) {
            if (child.id === id) return child;
            const found = child.getChildById(id);
            if (found) return found;
        }
        return null;
    }

    getDepth() {
        let depth = 0;
        let current = this;
        while (current.parent) {
            depth++;
            current = current.parent;
        }
        return depth;
    }

    isAncestorOf(node) {
        let current = node;
        while (current) {
            if (current.id === this.id) return true;
            current = current.parent;
        }
        return false;
    }
}

if (typeof window !== 'undefined') {
    window.VexelSceneGraph = VexelSceneGraph;
    window.VexelSceneNode = VexelSceneNode;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VexelSceneGraph, VexelSceneNode };
}
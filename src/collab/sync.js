// src/collab/sync.js

class VexelSync {
    constructor(vexel, options = {}) {
        this.vexel = vexel;
        this.serverUrl = options.serverUrl || null;
        this.roomId = options.roomId || 'default';
        this.userId = options.userId || this._generateUserId();
        this.userName = options.userName || 'Anonymous';
        this.userColor = options.userColor || this._generateColor();
        this.connected = false;
        this.socket = null;
        this.pendingChanges = [];
        this.changeQueue = [];
        this.lastSyncedVersion = 0;
        this.currentVersion = 0;
        this.syncing = false;
        this.autoSync = options.autoSync !== false;
        this.syncInterval = options.syncInterval || 100;
        this.syncTimer = null;
        this.listeners = {};
        this.remoteCursors = {};
        this.cursorDebounce = null;
    }

    _generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    _generateColor() {
        const colors = [
            '#FF5722', '#2196F3', '#4CAF50', '#FF9800',
            '#9C27B0', '#00BCD4', '#E91E63', '#3F51B5',
            '#FFEB3B', '#795548', '#607D8B', '#8BC34A'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    connect(url = null) {
        if (url) this.serverUrl = url;
        if (!this.serverUrl) {
            this._connectLocal();
            return;
        }

        try {
            this.socket = new WebSocket(this.serverUrl);

            this.socket.onopen = () => {
                this.connected = true;
                this._emit('connected', { userId: this.userId });
                this.socket.send(JSON.stringify({
                    type: 'join',
                    roomId: this.roomId,
                    userId: this.userId,
                    userName: this.userName,
                    userColor: this.userColor
                }));
            };

            this.socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this._handleMessage(data);
            };

            this.socket.onclose = () => {
                this.connected = false;
                this._emit('disconnected', {});
                setTimeout(() => this.connect(), 3000);
            };

            this.socket.onerror = (error) => {
                this._emit('error', { error });
            };
        } catch (e) {
            this._connectLocal();
        }
    }

    _connectLocal() {
        this.connected = true;
        this._emit('connected', { userId: this.userId, local: true });
    }

    disconnect() {
        if (this.socket) {
            this.socket.send(JSON.stringify({
                type: 'leave',
                roomId: this.roomId,
                userId: this.userId
            }));
            this.socket.close();
            this.socket = null;
        }
        this.connected = false;
        this.stopAutoSync();
    }

    _handleMessage(data) {
        switch (data.type) {
            case 'user-joined':
                this._emit('userJoined', { userId: data.userId, userName: data.userName });
                break;

            case 'user-left':
                this._emit('userLeft', { userId: data.userId });
                delete this.remoteCursors[data.userId];
                break;

            case 'cursor-update':
                this.remoteCursors[data.userId] = {
                    x: data.x,
                    y: data.y,
                    userName: data.userName,
                    color: data.userColor,
                    timestamp: Date.now()
                };
                this._emit('cursorUpdate', this.remoteCursors[data.userId]);
                break;

            case 'change':
                this._applyRemoteChange(data.change);
                break;

            case 'sync':
                this._applyFullSync(data.document);
                break;

            case 'cursor-request':
                this._sendCursorPosition();
                break;
        }
    }

    sendCursorPosition(x, y) {
        if (!this.connected) return;

        clearTimeout(this.cursorDebounce);
        this.cursorDebounce = setTimeout(() => {
            const message = {
                type: 'cursor-update',
                roomId: this.roomId,
                userId: this.userId,
                userName: this.userName,
                userColor: this.userColor,
                x,
                y
            };

            if (this.socket) {
                this.socket.send(JSON.stringify(message));
            }
            this._emit('cursorSent', { x, y });
        }, 50);
    }

    _sendCursorPosition() {
        this._emit('cursorRequest', {});
    }

    sendChange(change) {
        const versionedChange = {
            ...change,
            version: ++this.currentVersion,
            userId: this.userId,
            userName: this.userName,
            timestamp: Date.now()
        };

        this.changeQueue.push(versionedChange);

        if (this.socket && this.connected) {
            this.socket.send(JSON.stringify({
                type: 'change',
                roomId: this.roomId,
                change: versionedChange
            }));
        }

        this.pendingChanges.push(versionedChange);
        this._emit('changeSent', versionedChange);
    }

    _applyRemoteChange(change) {
        if (change.version <= this.lastSyncedVersion) return;

        try {
            switch (change.action) {
                case 'add-shape':
                    const shape = this._deserializeShape(change.shapeData);
                    if (shape) {
                        this.vexel.shapes.push(shape);
                    }
                    break;

                case 'remove-shape':
                    const removeIndex = this.vexel.shapes.findIndex(s => s.id === change.shapeId);
                    if (removeIndex > -1) {
                        this.vexel.shapes.splice(removeIndex, 1);
                    }
                    break;

                case 'update-shape':
                    const updateShape = this.vexel.shapes.find(s => s.id === change.shapeId);
                    if (updateShape) {
                        Object.assign(updateShape, change.properties);
                    }
                    break;

                case 'move-shape':
                    const moveShape = this.vexel.shapes.find(s => s.id === change.shapeId);
                    if (moveShape) {
                        moveShape.x = change.x;
                        moveShape.y = change.y;
                    }
                    break;

                case 'transform-shape':
                    const transformShape = this.vexel.shapes.find(s => s.id === change.shapeId);
                    if (transformShape) {
                        if (change.x !== undefined) transformShape.x = change.x;
                        if (change.y !== undefined) transformShape.y = change.y;
                        if (change.rotation !== undefined) transformShape.rotation = change.rotation;
                        if (change.scaleX !== undefined) transformShape.scaleX = change.scaleX;
                        if (change.scaleY !== undefined) transformShape.scaleY = change.scaleY;
                        if (change.width !== undefined) transformShape.width = change.width;
                        if (change.height !== undefined) transformShape.height = change.height;
                    }
                    break;

                case 'style-shape':
                    const styleShape = this.vexel.shapes.find(s => s.id === change.shapeId);
                    if (styleShape && change.properties) {
                        Object.assign(styleShape, change.properties);
                    }
                    break;

                case 'clear-all':
                    this.vexel.shapes = [];
                    break;

                case 'reorder':
                    const reorderShape = this.vexel.shapes.find(s => s.id === change.shapeId);
                    if (reorderShape) {
                        const idx = this.vexel.shapes.indexOf(reorderShape);
                        if (idx > -1) {
                            this.vexel.shapes.splice(idx, 1);
                            const newIdx = Math.min(change.newIndex, this.vexel.shapes.length);
                            this.vexel.shapes.splice(newIdx, 0, reorderShape);
                        }
                    }
                    break;
            }

            this.lastSyncedVersion = change.version;
            this.vexel.dirty = true;
            this._emit('changeApplied', change);
        } catch (e) {
            this._emit('changeError', { change, error: e });
        }
    }

    _applyFullSync(document) {
        if (!document || !document.shapes) return;

        this.vexel.shapes = [];
        for (const shapeData of document.shapes) {
            const shape = this._deserializeShape(shapeData);
            if (shape) this.vexel.shapes.push(shape);
        }

        if (document.viewport) {
            this.vexel.viewport = { ...document.viewport };
        }

        this.lastSyncedVersion = document.version || 0;
        this.currentVersion = this.lastSyncedVersion;
        this.vexel.dirty = true;
        this._emit('syncApplied', document);
    }

    _deserializeShape(data) {
        const constructors = {
            rectangle: VexelRectangle,
            ellipse: VexelEllipse,
            polygon: VexelPolygon,
            line: VexelLine,
            path: VexelPath,
            text: VexelText,
            image: VexelImage,
            group: VexelGroup
        };

        const Ctor = constructors[data.type];
        if (!Ctor) return null;

        if (Ctor.deserialize) {
            return Ctor.deserialize(data);
        }

        return new Ctor(data);
    }

    startAutoSync() {
        if (this.syncTimer) return;
        this.autoSync = true;
        this.syncTimer = setInterval(() => {
            this._syncNow();
        }, this.syncInterval);
    }

    stopAutoSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
        this.autoSync = false;
    }

    _syncNow() {
        if (!this.connected || this.syncing) return;

        const changes = [...this.changeQueue];
        this.changeQueue = [];

        if (changes.length === 0) return;

        this.syncing = true;

        if (this.socket) {
            this.socket.send(JSON.stringify({
                type: 'batch-change',
                roomId: this.roomId,
                changes
            }));
        }

        this.syncing = false;
    }

    requestFullSync() {
        if (this.socket && this.connected) {
            this.socket.send(JSON.stringify({
                type: 'request-sync',
                roomId: this.roomId,
                userId: this.userId
            }));
        }
    }

    getDocument() {
        return {
            version: this.currentVersion,
            viewport: { ...this.vexel.viewport },
            shapes: this.vexel.shapes.map(s => s.serialize()),
            users: Object.values(this.remoteCursors),
            timestamp: Date.now()
        };
    }

    getRemoteUsers() {
        return Object.values(this.remoteCursors);
    }

    getRemoteCursors() {
        return { ...this.remoteCursors };
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    _emit(event, data) {
        if (this.listeners[event]) {
            for (const cb of this.listeners[event]) {
                cb(data);
            }
        }
    }

    destroy() {
        this.disconnect();
        this.listeners = {};
        this.remoteCursors = {};
        this.changeQueue = [];
        this.pendingChanges = [];
    }
}

class VexelCursor {
    constructor(sync) {
        this.sync = sync;
        this.vexel = sync.vexel;
    }

    drawRemoteCursors(ctx) {
        const cursors = this.sync.getRemoteCursors();
        const now = Date.now();

        ctx.save();
        ctx.translate(this.vexel.viewport.x, this.vexel.viewport.y);
        ctx.scale(this.vexel.viewport.zoom, this.vexel.viewport.zoom);

        for (const [userId, cursor] of Object.entries(cursors)) {
            if (now - cursor.timestamp > 10000) continue;

            const x = cursor.x;
            const y = cursor.y;
            const color = cursor.color;
            const name = cursor.userName || userId;

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 12, y + 8);
            ctx.lineTo(x + 8, y + 8);
            ctx.lineTo(x + 8, y + 16);
            ctx.lineTo(x + 4, y + 12);
            ctx.lineTo(x, y + 20);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = color;
            ctx.font = `${11 / this.vexel.viewport.zoom}px -apple-system, sans-serif`;
            ctx.fillText(
                name,
                x + 16 / this.vexel.viewport.zoom,
                y + 22 / this.vexel.viewport.zoom
            );
        }

        ctx.restore();
    }
}

class VexelPresence {
    constructor(sync) {
        this.sync = sync;
        this.users = {};
        this.onUserJoined = null;
        this.onUserLeft = null;

        this.sync.on('userJoined', (data) => {
            this.users[data.userId] = {
                userId: data.userId,
                userName: data.userName,
                joinedAt: Date.now()
            };
            if (this.onUserJoined) this.onUserJoined(data);
        });

        this.sync.on('userLeft', (data) => {
            delete this.users[data.userId];
            if (this.onUserLeft) this.onUserLeft(data);
        });
    }

    getUsers() {
        return Object.values(this.users);
    }

    getUserCount() {
        return Object.keys(this.users).length;
    }

    isUserOnline(userId) {
        return userId in this.users;
    }
}

if (typeof window !== 'undefined') {
    window.VexelSync = VexelSync;
    window.VexelCursor = VexelCursor;
    window.VexelPresence = VexelPresence;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VexelSync, VexelCursor, VexelPresence };
}
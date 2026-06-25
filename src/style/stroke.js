// src/utils/events.js

class VexelEventEmitter {
    constructor() {
        this._events = {};
        this._onceEvents = {};
        this._maxListeners = 100;
    }

    on(event, listener) {
        if (!this._events[event]) {
            this._events[event] = [];
        }
        if (this._events[event].length >= this._maxListeners) {
            console.warn(`Max listeners (${this._maxListeners}) reached for event: ${event}`);
        }
        this._events[event].push(listener);
        return () => this.off(event, listener);
    }

    once(event, listener) {
        if (!this._onceEvents[event]) {
            this._onceEvents[event] = [];
        }
        this._onceEvents[event].push(listener);
        return () => this.off(event, listener);
    }

    off(event, listener) {
        if (this._events[event]) {
            this._events[event] = this._events[event].filter(l => l !== listener);
        }
        if (this._onceEvents[event]) {
            this._onceEvents[event] = this._onceEvents[event].filter(l => l !== listener);
        }
    }

    emit(event, ...args) {
        const listeners = this._events[event];
        if (listeners) {
            for (const listener of [...listeners]) {
                listener(...args);
            }
        }

        const onceListeners = this._onceEvents[event];
        if (onceListeners) {
            for (const listener of [...onceListeners]) {
                listener(...args);
            }
            delete this._onceEvents[event];
        }

        if (this._events['*']) {
            for (const listener of this._events['*']) {
                listener(event, ...args);
            }
        }
    }

    removeAllListeners(event) {
        if (event) {
            delete this._events[event];
            delete this._onceEvents[event];
        } else {
            this._events = {};
            this._onceEvents = {};
        }
    }

    listenerCount(event) {
        const regular = this._events[event] ? this._events[event].length : 0;
        const once = this._onceEvents[event] ? this._onceEvents[event].length : 0;
        return regular + once;
    }

    eventNames() {
        const names = new Set([
            ...Object.keys(this._events),
            ...Object.keys(this._onceEvents)
        ]);
        return [...names];
    }

    setMaxListeners(n) {
        this._maxListeners = n;
    }
}

class VexelKeyboard {
    constructor(target = window) {
        this.target = target;
        this.keys = {};
        this.modifiers = {
            shift: false,
            ctrl: false,
            alt: false,
            meta: false
        };
        this.shortcuts = {};
        this.enabled = true;
        this._boundDown = this._onKeyDown.bind(this);
        this._boundUp = this._onKeyUp.bind(this);
        this._boundBlur = this._onBlur.bind(this);
        this._attach();
    }

    _attach() {
        this.target.addEventListener('keydown', this._boundDown);
        this.target.addEventListener('keyup', this._boundUp);
        this.target.addEventListener('blur', this._boundBlur);
    }

    detach() {
        this.target.removeEventListener('keydown', this._boundDown);
        this.target.removeEventListener('keyup', this._boundUp);
        this.target.removeEventListener('blur', this._boundBlur);
    }

    _onKeyDown(e) {
        this.keys[e.key.toLowerCase()] = true;
        this.keys[e.code] = true;
        this.modifiers.shift = e.shiftKey;
        this.modifiers.ctrl = e.ctrlKey || e.metaKey;
        this.modifiers.alt = e.altKey;
        this.modifiers.meta = e.metaKey;

        if (this.enabled) {
            const combo = this._getCombo(e);
            if (this.shortcuts[combo]) {
                e.preventDefault();
                this.shortcuts[combo](e);
            }
        }
    }

    _onKeyUp(e) {
        this.keys[e.key.toLowerCase()] = false;
        this.keys[e.code] = false;
        this.modifiers.shift = e.shiftKey;
        this.modifiers.ctrl = e.ctrlKey || e.metaKey;
        this.modifiers.alt = e.altKey;
        this.modifiers.meta = e.metaKey;
    }

    _onBlur() {
        this.keys = {};
        this.modifiers = { shift: false, ctrl: false, alt: false, meta: false };
    }

    _getCombo(e) {
        const parts = [];
        if (e.ctrlKey || e.metaKey) parts.push('cmd');
        if (e.shiftKey) parts.push('shift');
        if (e.altKey) parts.push('alt');

        let key = e.key.toLowerCase();
        if (key === ' ') key = 'space';
        const keyMap = {
            'arrowleft': 'left', 'arrowright': 'right',
            'arrowup': 'up', 'arrowdown': 'down',
            'escape': 'esc', 'delete': 'del',
            'insert': 'ins', 'pagedown': 'pagedown',
            'pageup': 'pageup', 'home': 'home', 'end': 'end'
        };
        key = keyMap[key] || key;
        parts.push(key);

        return parts.join('+');
    }

    isDown(key) {
        return !!this.keys[key.toLowerCase()] || !!this.keys[key];
    }

    isShift() { return this.modifiers.shift; }
    isCtrl() { return this.modifiers.ctrl; }
    isAlt() { return this.modifiers.alt; }
    isMeta() { return this.modifiers.meta; }

    register(combo, callback) {
        this.shortcuts[combo.toLowerCase()] = callback;
    }

    unregister(combo) {
        delete this.shortcuts[combo.toLowerCase()];
    }

    enable() { this.enabled = true; }
    disable() { this.enabled = false; }

    destroy() {
        this.detach();
        this.keys = {};
        this.shortcuts = {};
    }
}

class VexelPointer {
    constructor(vexel) {
        this.vexel = vexel;
        this.x = 0;
        this.y = 0;
        this.worldX = 0;
        this.worldY = 0;
        this.down = false;
        this.dragging = false;
        this.dragStart = null;
        this.dragDistance = 0;
        this.dragThreshold = 3;
        this.buttons = 0;
        this.pressure = 0;
        this.tiltX = 0;
        this.tiltY = 0;
        this.pointerType = 'mouse';
        this.lastClickTime = 0;
        this.lastClickPos = { x: 0, y: 0 };
        this.doubleClickTime = 300;
        this.doubleClickDistance = 10;
        this._boundMove = this._onMove.bind(this);
        this._boundDown = this._onDown.bind(this);
        this._boundUp = this._onUp.bind(this);
        this._attach();
    }

    _attach() {
        const container = this.vexel.container;
        container.addEventListener('pointermove', this._boundMove);
        container.addEventListener('pointerdown', this._boundDown);
        window.addEventListener('pointerup', this._boundUp);
    }

    detach() {
        const container = this.vexel.container;
        container.removeEventListener('pointermove', this._boundMove);
        container.removeEventListener('pointerdown', this._boundDown);
        window.removeEventListener('pointerup', this._boundUp);
    }

    _onMove(e) {
        const rect = this.vexel.container.getBoundingClientRect();
        this.x = e.clientX - rect.left;
        this.y = e.clientY - rect.top;
        this.worldX = (this.x - this.vexel.viewport.x) / this.vexel.viewport.zoom;
        this.worldY = (this.y - this.vexel.viewport.y) / this.vexel.viewport.zoom;
        this.pressure = e.pressure || 0;
        this.tiltX = e.tiltX || 0;
        this.tiltY = e.tiltY || 0;
        this.pointerType = e.pointerType;

        if (this.down && this.dragStart) {
            this.dragDistance = Math.hypot(
                this.worldX - this.dragStart.x,
                this.worldY - this.dragStart.y
            );
            if (this.dragDistance > this.dragThreshold && !this.dragging) {
                this.dragging = true;
                this.vexel.events.emit('dragstart', {
                    x: this.dragStart.x,
                    y: this.dragStart.y,
                    pointer: this
                });
            }
        }

        if (this.dragging) {
            this.vexel.events.emit('drag', {
                x: this.worldX,
                y: this.worldY,
                dx: this.worldX - this.dragStart.x,
                dy: this.worldY - this.dragStart.y,
                pointer: this
            });
        }

        this.vexel.events.emit('pointermove', {
            x: this.worldX,
            y: this.worldY,
            screenX: this.x,
            screenY: this.y,
            pointer: this
        });
    }

    _onDown(e) {
        this.down = true;
        this.buttons = e.buttons;
        this.pressure = e.pressure || 0;
        this.dragStart = { x: this.worldX, y: this.worldY };
        this.dragDistance = 0;

        const now = Date.now();
        const dist = Math.hypot(
            this.worldX - this.lastClickPos.x,
            this.worldY - this.lastClickPos.y
        );

        if (now - this.lastClickTime < this.doubleClickTime && dist < this.doubleClickDistance) {
            this.vexel.events.emit('dblclick', {
                x: this.worldX,
                y: this.worldY,
                pointer: this
            });
            this.lastClickTime = 0;
        } else {
            this.lastClickTime = now;
            this.lastClickPos = { x: this.worldX, y: this.worldY };
        }

        this.vexel.events.emit('pointerdown', {
            x: this.worldX,
            y: this.worldY,
            button: e.button,
            pointer: this
        });
    }

    _onUp(e) {
        if (this.dragging) {
            this.vexel.events.emit('dragend', {
                x: this.worldX,
                y: this.worldY,
                pointer: this
            });
        } else if (this.down) {
            this.vexel.events.emit('click', {
                x: this.dragStart ? this.dragStart.x : this.worldX,
                y: this.dragStart ? this.dragStart.y : this.worldY,
                button: e.button,
                pointer: this
            });
        }

        this.down = false;
        this.dragging = false;
        this.dragStart = null;
        this.buttons = 0;

        this.vexel.events.emit('pointerup', {
            x: this.worldX,
            y: this.worldY,
            pointer: this
        });
    }

    getPosition() {
        return { x: this.worldX, y: this.worldY };
    }

    getScreenPosition() {
        return { x: this.x, y: this.y };
    }

    destroy() {
        this.detach();
    }
}

class VexelGesture {
    constructor(vexel) {
        this.vexel = vexel;
        this.touches = new Map();
        this.pinchStartDistance = 0;
        this.pinchStartZoom = 1;
        this.pinchCenter = { x: 0, y: 0 };
        this.rotating = false;
        this.rotateStartAngle = 0;
        this.rotateStartRotation = 0;
        this._boundTouchStart = this._onTouchStart.bind(this);
        this._boundTouchMove = this._onTouchMove.bind(this);
        this._boundTouchEnd = this._onTouchEnd.bind(this);
        this._attach();
    }

    _attach() {
        const container = this.vexel.container;
        container.addEventListener('touchstart', this._boundTouchStart, { passive: false });
        container.addEventListener('touchmove', this._boundTouchMove, { passive: false });
        container.addEventListener('touchend', this._boundTouchEnd);
    }

    detach() {
        const container = this.vexel.container;
        container.removeEventListener('touchstart', this._boundTouchStart);
        container.removeEventListener('touchmove', this._boundTouchMove);
        container.removeEventListener('touchend', this._boundTouchEnd);
    }

    _onTouchStart(e) {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            this.touches.set(touch.identifier, touch);
        }

        if (this.touches.size === 2) {
            const touches = [...this.touches.values()];
            this.pinchStartDistance = Math.hypot(
                touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY
            );
            this.pinchStartZoom = this.vexel.viewport.zoom;

            const rect = this.vexel.container.getBoundingClientRect();
            this.pinchCenter = {
                x: ((touches[0].clientX + touches[1].clientX) / 2 - rect.left),
                y: ((touches[0].clientY + touches[1].clientY) / 2 - rect.top)
            };

            this.rotateStartAngle = Math.atan2(
                touches[1].clientY - touches[0].clientY,
                touches[1].clientX - touches[0].clientX
            );
            this.rotateStartRotation = this.vexel.viewport.rotation;
            this.rotating = true;
        }
    }

    _onTouchMove(e) {
        e.preventDefault();

        if (this.touches.size === 2) {
            const touches = [...this.touches.values()];
            const currentDistance = Math.hypot(
                touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY
            );

            const scale = currentDistance / this.pinchStartDistance;
            const newZoom = Math.max(0.001, Math.min(100, this.pinchStartZoom * scale));

            const rect = this.vexel.container.getBoundingClientRect();
            this.vexel.viewport.zoom = newZoom;
            this.vexel.viewport.x = this.pinchCenter.x - (this.pinchCenter.x - this.vexel.viewport.x) * (newZoom / this.pinchStartZoom);
            this.vexel.viewport.y = this.pinchCenter.y - (this.pinchCenter.y - this.vexel.viewport.y) * (newZoom / this.pinchStartZoom);
            this.vexel.dirty = true;

            if (this.rotating) {
                const currentAngle = Math.atan2(
                    touches[1].clientY - touches[0].clientY,
                    touches[1].clientX - touches[0].clientX
                );
                const angleDiff = (currentAngle - this.rotateStartAngle) * (180 / Math.PI);
                this.vexel.viewport.rotation = (this.rotateStartRotation + angleDiff) % 360;
                this.vexel.dirty = true;
            }
        }
    }

    _onTouchEnd(e) {
        for (const touch of e.changedTouches) {
            this.touches.delete(touch.identifier);
        }
        if (this.touches.size < 2) {
            this.rotating = false;
        }
    }

    destroy() {
        this.detach();
        this.touches.clear();
    }
}

if (typeof window !== 'undefined') {
    window.VexelEventEmitter = VexelEventEmitter;
    window.VexelKeyboard = VexelKeyboard;
    window.VexelPointer = VexelPointer;
    window.VexelGesture = VexelGesture;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VexelEventEmitter, VexelKeyboard, VexelPointer, VexelGesture };
}
// src/core/events.js

class VexelEventSystem {
    constructor(vexel) {
        this.vexel = vexel;
        this.listeners = {};
        this.pointerPosition = { x: 0, y: 0 };
        this.pointerDown = false;
        this.pointerDragging = false;
        this.dragStart = null;
        this.dragDistance = 0;
        this.dragThreshold = 3;
        this.lastClickTime = 0;
        this.lastClickPosition = { x: 0, y: 0 };
        this.doubleClickThreshold = 300;
        this.doubleClickDistance = 10;
        this.pinchStartDistance = 0;
        this.pinchStartZoom = 1;
        this.pinchCenter = { x: 0, y: 0 };
        this.activeTouches = new Map();
        this.shortcuts = {};
        this.shortcutEnabled = true;
        this._boundHandlers = {};
        this._setupHandlers();
    }

    _setupHandlers() {
        this._boundHandlers.onMouseDown = this._onMouseDown.bind(this);
        this._boundHandlers.onMouseMove = this._onMouseMove.bind(this);
        this._boundHandlers.onMouseUp = this._onMouseUp.bind(this);
        this._boundHandlers.onWheel = this._onWheel.bind(this);
        this._boundHandlers.onKeyDown = this._onKeyDown.bind(this);
        this._boundHandlers.onKeyUp = this._onKeyUp.bind(this);
        this._boundHandlers.onTouchStart = this._onTouchStart.bind(this);
        this._boundHandlers.onTouchMove = this._onTouchMove.bind(this);
        this._boundHandlers.onTouchEnd = this._onTouchEnd.bind(this);
        this._boundHandlers.onContextMenu = this._onContextMenu.bind(this);
        this._boundHandlers.onResize = this._onResize.bind(this);
        this._boundHandlers.onBlur = this._onBlur.bind(this);
    }

    attach() {
        const container = this.vexel.container;
        const windowTarget = window;

        container.addEventListener('mousedown', this._boundHandlers.onMouseDown);
        windowTarget.addEventListener('mousemove', this._boundHandlers.onMouseMove);
        windowTarget.addEventListener('mouseup', this._boundHandlers.onMouseUp);
        container.addEventListener('wheel', this._boundHandlers.onWheel, { passive: false });
        windowTarget.addEventListener('keydown', this._boundHandlers.onKeyDown);
        windowTarget.addEventListener('keyup', this._boundHandlers.onKeyUp);
        container.addEventListener('touchstart', this._boundHandlers.onTouchStart, { passive: false });
        container.addEventListener('touchmove', this._boundHandlers.onTouchMove, { passive: false });
        container.addEventListener('touchend', this._boundHandlers.onTouchEnd);
        container.addEventListener('contextmenu', this._boundHandlers.onContextMenu);
        windowTarget.addEventListener('resize', this._boundHandlers.onResize);
        windowTarget.addEventListener('blur', this._boundHandlers.onBlur);
    }

    detach() {
        const container = this.vexel.container;
        const windowTarget = window;

        container.removeEventListener('mousedown', this._boundHandlers.onMouseDown);
        windowTarget.removeEventListener('mousemove', this._boundHandlers.onMouseMove);
        windowTarget.removeEventListener('mouseup', this._boundHandlers.onMouseUp);
        container.removeEventListener('wheel', this._boundHandlers.onWheel);
        windowTarget.removeEventListener('keydown', this._boundHandlers.onKeyDown);
        windowTarget.removeEventListener('keyup', this._boundHandlers.onKeyUp);
        container.removeEventListener('touchstart', this._boundHandlers.onTouchStart);
        container.removeEventListener('touchmove', this._boundHandlers.onTouchMove);
        container.removeEventListener('touchend', this._boundHandlers.onTouchEnd);
        container.removeEventListener('contextmenu', this._boundHandlers.onContextMenu);
        windowTarget.removeEventListener('resize', this._boundHandlers.onResize);
        windowTarget.removeEventListener('blur', this._boundHandlers.onBlur);
    }

    _getCanvasPoint(e) {
        const rect = this.vexel.container.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        return {
            x: (clientX - rect.left - this.vexel.viewport.x) / this.vexel.viewport.zoom,
            y: (clientY - rect.top - this.vexel.viewport.y) / this.vexel.viewport.zoom
        };
    }

    _onMouseDown(e) {
        this.pointerDown = true;
        this.pointerPosition = this._getCanvasPoint(e);
        this.dragStart = { ...this.pointerPosition };
        this.dragDistance = 0;

        const now = Date.now();
        const dist = Math.hypot(
            this.pointerPosition.x - this.lastClickPosition.x,
            this.pointerPosition.y - this.lastClickPosition.y
        );

        if (
            now - this.lastClickTime < this.doubleClickThreshold &&
            dist < this.doubleClickDistance
        ) {
            this._emit('dblclick', {
                x: this.pointerPosition.x,
                y: this.pointerPosition.y,
                originalEvent: e
            });
            this.lastClickTime = 0;
        } else {
            this.lastClickTime = now;
            this.lastClickPosition = { ...this.pointerPosition };
        }

        this._emit('pointerdown', {
            x: this.pointerPosition.x,
            y: this.pointerPosition.y,
            button: e.button,
            altKey: e.altKey,
            shiftKey: e.shiftKey,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            originalEvent: e
        });
    }

    _onMouseMove(e) {
        this.pointerPosition = this._getCanvasPoint(e);

        if (this.pointerDown && this.dragStart) {
            this.dragDistance = Math.hypot(
                this.pointerPosition.x - this.dragStart.x,
                this.pointerPosition.y - this.dragStart.y
            );

            if (this.dragDistance > this.dragThreshold && !this.pointerDragging) {
                this.pointerDragging = true;
                this._emit('dragstart', {
                    x: this.dragStart.x,
                    y: this.dragStart.y,
                    originalEvent: e
                });
            }
        }

        if (this.pointerDragging) {
            this._emit('drag', {
                x: this.pointerPosition.x,
                y: this.pointerPosition.y,
                dx: this.pointerPosition.x - this.dragStart.x,
                dy: this.pointerPosition.y - this.dragStart.y,
                originalEvent: e
            });
        }

        this._emit('pointermove', {
            x: this.pointerPosition.x,
            y: this.pointerPosition.y,
            originalEvent: e
        });
    }

    _onMouseUp(e) {
        if (this.pointerDragging) {
            this._emit('dragend', {
                x: this.pointerPosition.x,
                y: this.pointerPosition.y,
                dx: this.pointerPosition.x - this.dragStart.x,
                dy: this.pointerPosition.y - this.dragStart.y,
                originalEvent: e
            });
        } else if (this.pointerDown) {
            this._emit('click', {
                x: this.dragStart.x,
                y: this.dragStart.y,
                button: e.button,
                originalEvent: e
            });
        }

        this.pointerDown = false;
        this.pointerDragging = false;
        this.dragStart = null;

        this._emit('pointerup', {
            x: this.pointerPosition.x,
            y: this.pointerPosition.y,
            originalEvent: e
        });
    }

    _onWheel(e) {
        e.preventDefault();

        const rect = this.vexel.container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (e.ctrlKey || e.metaKey) {
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = Math.max(0.001, Math.min(100, this.vexel.viewport.zoom * delta));

            this.vexel.viewport.x = mouseX - (mouseX - this.vexel.viewport.x) * (newZoom / this.vexel.viewport.zoom);
            this.vexel.viewport.y = mouseY - (mouseY - this.vexel.viewport.y) * (newZoom / this.vexel.viewport.zoom);
            this.vexel.viewport.zoom = newZoom;
        } else if (e.shiftKey) {
            this.vexel.viewport.x -= e.deltaY;
        } else {
            this.vexel.viewport.x -= e.deltaX;
            this.vexel.viewport.y -= e.deltaY;
        }

        this.vexel.dirty = true;

        this._emit('wheel', {
            deltaX: e.deltaX,
            deltaY: e.deltaY,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            originalEvent: e
        });
    }

    _onKeyDown(e) {
        if (!this.shortcutEnabled) return;

        const key = this._normalizeKey(e);
        const shortcut = this.shortcuts[key];

        if (shortcut) {
            e.preventDefault();
            shortcut.callback(e);
        }

        this._emit('keydown', {
            key: e.key,
            code: e.code,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            metaKey: e.metaKey,
            originalEvent: e
        });
    }

    _onKeyUp(e) {
        this._emit('keyup', {
            key: e.key,
            code: e.code,
            originalEvent: e
        });
    }

    _onTouchStart(e) {
        e.preventDefault();

        for (const touch of e.changedTouches) {
            this.activeTouches.set(touch.identifier, touch);
        }

        if (this.activeTouches.size === 1) {
            const touch = e.touches[0];
            const fakeEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY,
                button: 0
            };
            this._onMouseDown(fakeEvent);
        } else if (this.activeTouches.size === 2) {
            const touches = [...this.activeTouches.values()];
            this.pinchStartDistance = Math.hypot(
                touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY
            );
            this.pinchStartZoom = this.vexel.viewport.zoom;

            const rect = this.vexel.container.getBoundingClientRect();
            this.pinchCenter = {
                x: ((touches[0].clientX + touches[1].clientX) / 2 - rect.left - this.vexel.viewport.x) / this.vexel.viewport.zoom,
                y: ((touches[0].clientY + touches[1].clientY) / 2 - rect.top - this.vexel.viewport.y) / this.vexel.viewport.zoom
            };
        }

        this._emit('touchstart', {
            touches: e.touches,
            originalEvent: e
        });
    }

    _onTouchMove(e) {
        e.preventDefault();

        if (this.activeTouches.size === 1) {
            const touch = e.touches[0];
            const fakeEvent = {
                clientX: touch.clientX,
                clientY: touch.clientY
            };
            this._onMouseMove(fakeEvent);
        } else if (this.activeTouches.size === 2) {
            const touches = [...this.activeTouches.values()];
            const currentDistance = Math.hypot(
                touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY
            );

            const scale = currentDistance / this.pinchStartDistance;
            const newZoom = this.pinchStartZoom * scale;

            const rect = this.vexel.container.getBoundingClientRect();
            const cx = (touches[0].clientX + touches[1].clientX) / 2;
            const cy = (touches[0].clientY + touches[1].clientY) / 2;

            this.vexel.viewport.zoom = Math.max(0.001, Math.min(100, newZoom));
            this.vexel.viewport.x = cx - rect.left - this.pinchCenter.x * this.vexel.viewport.zoom;
            this.vexel.viewport.y = cy - rect.top - this.pinchCenter.y * this.vexel.viewport.zoom;
            this.vexel.dirty = true;

            this._emit('pinch', {
                scale,
                zoom: this.vexel.viewport.zoom,
                center: this.pinchCenter,
                originalEvent: e
            });
        }

        this._emit('touchmove', {
            touches: e.touches,
            originalEvent: e
        });
    }

    _onTouchEnd(e) {
        for (const touch of e.changedTouches) {
            this.activeTouches.delete(touch.identifier);
        }

        if (this.activeTouches.size === 0) {
            this._onMouseUp({ button: 0 });
        }

        this._emit('touchend', {
            touches: e.touches,
            originalEvent: e
        });
    }

    _onContextMenu(e) {
        const point = this._getCanvasPoint(e);

        this._emit('contextmenu', {
            x: point.x,
            y: point.y,
            originalEvent: e
        });
    }

    _onResize() {
        this._emit('resize', {
            width: window.innerWidth,
            height: window.innerHeight
        });
    }

    _onBlur() {
        this.pointerDown = false;
        this.pointerDragging = false;
        this.activeTouches.clear();

        this._emit('blur', {});
    }

    _normalizeKey(e) {
        const parts = [];
        if (e.ctrlKey || e.metaKey) parts.push('cmd');
        if (e.shiftKey) parts.push('shift');
        if (e.altKey) parts.push('alt');

        let key = e.key.toLowerCase();
        if (key === ' ') key = 'space';
        if (key === 'arrowleft') key = 'left';
        if (key === 'arrowright') key = 'right';
        if (key === 'arrowup') key = 'up';
        if (key === 'arrowdown') key = 'down';

        parts.push(key);
        return parts.join('+');
    }

    registerShortcut(keys, callback, description = '') {
        const normalized = keys.toLowerCase().replace(/\s/g, '');
        this.shortcuts[normalized] = { callback, description };
    }

    unregisterShortcut(keys) {
        const normalized = keys.toLowerCase().replace(/\s/g, '');
        delete this.shortcuts[normalized];
    }

    getShortcuts() {
        return Object.entries(this.shortcuts).map(([keys, data]) => ({
            keys,
            description: data.description
        }));
    }

    enableShortcuts() {
        this.shortcutEnabled = true;
    }

    disableShortcuts() {
        this.shortcutEnabled = false;
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    once(event, callback) {
        const wrapper = (data) => {
            callback(data);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }

    _emit(event, data) {
        if (this.listeners[event]) {
            for (const callback of this.listeners[event]) {
                callback(data);
            }
        }

        if (this.listeners['*']) {
            for (const callback of this.listeners['*']) {
                callback(event, data);
            }
        }
    }

    destroy() {
        this.detach();
        this.listeners = {};
        this.shortcuts = {};
        this.activeTouches.clear();
    }
}

if (typeof window !== 'undefined') {
    window.VexelEventSystem = VexelEventSystem;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelEventSystem;
}
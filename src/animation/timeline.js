// src/animation/timeline.js

class VexelTimeline {
    constructor(vexel) {
        this.vexel = vexel;
        this.animations = [];
        this.playing = false;
        this.time = 0;
        this.duration = 0;
        this.loop = false;
        this.reversed = false;
        this.speed = 1;
        this.frameId = null;
        this.lastFrameTime = null;
        this.onUpdate = null;
        this.onComplete = null;
        this.onFrame = null;
        this.keyframes = [];
        this.easing = 'easeInOutCubic';
    }

    add(animation) {
        this.animations.push(animation);
        this.duration = Math.max(this.duration, animation.delay + animation.duration);
        return animation;
    }

    to(target, properties, options = {}) {
        const animation = new VexelAnimation(target, properties, options);
        return this.add(animation);
    }

    from(target, properties, options = {}) {
        const startValues = {};
        for (const [key, value] of Object.entries(properties)) {
            startValues[key] = target[key];
            target[key] = value;
        }
        const animation = new VexelAnimation(target, startValues, options);
        animation._reversed = true;
        return this.add(animation);
    }

    fromTo(target, fromProps, toProps, options = {}) {
        for (const [key, value] of Object.entries(fromProps)) {
            target[key] = value;
        }
        const animation = new VexelAnimation(target, toProps, options);
        return this.add(animation);
    }

    set(properties, options = {}) {
        const animation = new VexelAnimation(null, properties, { ...options, duration: 0 });
        return this.add(animation);
    }

    call(callback, options = {}) {
        const animation = new VexelAnimation(null, {}, {
            ...options,
            duration: 0,
            onStart: callback
        });
        return this.add(animation);
    }

    stagger(targets, properties, staggerTime = 0.1, options = {}) {
        const animations = [];
        targets.forEach((target, index) => {
            const animOptions = { ...options, delay: (options.delay || 0) + index * staggerTime };
            animations.push(this.to(target, properties, animOptions));
        });
        return animations;
    }

    play() {
        if (this.playing) return;
        this.playing = true;
        this.lastFrameTime = performance.now();
        this._tick();
    }

    pause() {
        this.playing = false;
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }

    resume() {
        if (!this.playing) {
            this.playing = true;
            this.lastFrameTime = performance.now();
            this._tick();
        }
    }

    stop() {
        this.pause();
        this.time = 0;
        for (const anim of this.animations) {
            anim.reset();
        }
        this.vexel.dirty = true;
    }

    seek(time) {
        this.time = time;
        this._updateAnimations(time);
        this.vexel.dirty = true;
    }

    reverse() {
        this.reversed = !this.reversed;
        for (const anim of this.animations) {
            anim.reversed = this.reversed;
        }
    }

    _tick() {
        if (!this.playing) return;

        const now = performance.now();
        const delta = (now - this.lastFrameTime) * this.speed;
        this.lastFrameTime = now;

        if (this.reversed) {
            this.time -= delta;
            if (this.time <= 0) {
                this.time = 0;
                if (this.loop) {
                    this.time = this.duration;
                } else {
                    this._complete();
                    return;
                }
            }
        } else {
            this.time += delta;
            if (this.time >= this.duration) {
                this.time = this.duration;
                if (this.loop) {
                    this.time = 0;
                    for (const anim of this.animations) {
                        anim.reset();
                    }
                } else {
                    this._complete();
                    return;
                }
            }
        }

        this._updateAnimations(this.time);

        if (this.onFrame) {
            this.onFrame(this.time, this.duration);
        }

        this.vexel.dirty = true;
        this.frameId = requestAnimationFrame(() => this._tick());
    }

    _updateAnimations(time) {
        for (const anim of this.animations) {
            anim.update(time);
        }
    }

    _complete() {
        this.playing = false;
        this._updateAnimations(this.reversed ? 0 : this.duration);

        if (this.onComplete) {
            this.onComplete();
        }

        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }

    destroy() {
        this.pause();
        this.animations = [];
        this.keyframes = [];
        this.onUpdate = null;
        this.onComplete = null;
        this.onFrame = null;
    }
}

class VexelAnimation {
    constructor(target, properties, options = {}) {
        this.target = target;
        this.properties = properties;
        this.duration = options.duration || 1000;
        this.delay = options.delay || 0;
        this.easing = options.easing || 'easeInOutCubic';
        this.reversed = false;
        this.yoyo = options.yoyo || false;
        this.repeat = options.repeat || 0;
        this.repeatCount = 0;
        this.onStart = options.onStart || null;
        this.onUpdate = options.onUpdate || null;
        this.onComplete = options.onComplete || null;
        this._startValues = {};
        this._endValues = { ...properties };
        this._started = false;
        this._completed = false;
        this._reversed = options._reversed || false;
    }

    reset() {
        this._started = false;
        this._completed = false;
        this.repeatCount = 0;
        this._startValues = {};
    }

    update(time) {
        if (time < this.delay) {
            return;
        }

        if (this._completed) return;

        if (!this._started) {
            this._start();
        }

        let t = (time - this.delay) / this.duration;
        t = Math.max(0, Math.min(1, t));

        if (this._reversed) {
            t = 1 - t;
        }
        if (this.reversed) {
            t = 1 - t;
        }

        const easedT = VexelEasing.apply(this.easing, t);

        if (this.target) {
            for (const [key, endValue] of Object.entries(this._endValues)) {
                const startValue = this._startValues[key];
                if (typeof endValue === 'number') {
                    this.target[key] = startValue + (endValue - startValue) * easedT;
                } else if (typeof endValue === 'string' && endValue.startsWith('#')) {
                    this.target[key] = VexelAnimation._interpolateColor(startValue, endValue, easedT);
                }
            }
        }

        if (this.onUpdate) {
            this.onUpdate(easedT, t);
        }

        if (t >= 1 || (this._reversed && t <= 0)) {
            if (this.yoyo && this.repeatCount < this.repeat) {
                this._reversed = !this._reversed;
                this.repeatCount++;
                this._startValues = {};
                this._started = false;
                return;
            }

            if (this.repeatCount < this.repeat) {
                this.repeatCount++;
                this._startValues = {};
                this._started = false;
                return;
            }

            this._completed = true;
            if (this.onComplete) {
                this.onComplete();
            }
        }
    }

    _start() {
        this._started = true;
        if (this.target) {
            for (const [key, value] of Object.entries(this._endValues)) {
                this._startValues[key] = this.target[key] !== undefined ? this.target[key] : value;
            }
        }
        if (this.onStart) {
            this.onStart();
        }
    }

    static _interpolateColor(color1, color2, t) {
        const c1 = VexelAnimation._parseColor(color1);
        const c2 = VexelAnimation._parseColor(color2);

        if (!c1 || !c2) return color1;

        const r = Math.round(c1.r + (c2.r - c1.r) * t);
        const g = Math.round(c1.g + (c2.g - c1.g) * t);
        const b = Math.round(c1.b + (c2.b - c1.b) * t);
        const a = (c1.a || 1) + ((c2.a || 1) - (c1.a || 1)) * t;

        return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
    }

    static _parseColor(color) {
        if (!color) return null;

        if (color.startsWith('#')) {
            const hex = color.replace('#', '');
            if (hex.length === 3) {
                return {
                    r: parseInt(hex[0] + hex[0], 16),
                    g: parseInt(hex[1] + hex[1], 16),
                    b: parseInt(hex[2] + hex[2], 16),
                    a: 1
                };
            }
            if (hex.length === 6) {
                return {
                    r: parseInt(hex.substring(0, 2), 16),
                    g: parseInt(hex.substring(2, 4), 16),
                    b: parseInt(hex.substring(4, 6), 16),
                    a: 1
                };
            }
        }

        const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
        if (rgbaMatch) {
            return {
                r: parseInt(rgbaMatch[1]),
                g: parseInt(rgbaMatch[2]),
                b: parseInt(rgbaMatch[3]),
                a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
            };
        }

        return null;
    }
}

class VexelEasing {
    static apply(easing, t) {
        const fn = VexelEasing[easing];
        if (fn) return fn(t);
        return t;
    }

    static linear(t) { return t; }
    static easeInQuad(t) { return t * t; }
    static easeOutQuad(t) { return t * (2 - t); }
    static easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
    static easeInCubic(t) { return t * t * t; }
    static easeOutCubic(t) { return (--t) * t * t + 1; }
    static easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; }
    static easeInQuart(t) { return t * t * t * t; }
    static easeOutQuart(t) { return 1 - (--t) * t * t * t; }
    static easeInOutQuart(t) { return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t; }
    static easeInQuint(t) { return t * t * t * t * t; }
    static easeOutQuint(t) { return 1 + (--t) * t * t * t * t; }
    static easeInOutQuint(t) { return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t; }
    static easeInSine(t) { return 1 - Math.cos(t * Math.PI / 2); }
    static easeOutSine(t) { return Math.sin(t * Math.PI / 2); }
    static easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }
    static easeInExpo(t) { return t === 0 ? 0 : Math.pow(2, 10 * t - 10); }
    static easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
    static easeInOutExpo(t) {
        if (t === 0) return 0;
        if (t === 1) return 1;
        return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
    }
    static easeInCirc(t) { return 1 - Math.sqrt(1 - t * t); }
    static easeOutCirc(t) { return Math.sqrt(1 - (--t) * t); }
    static easeInOutCirc(t) {
        return t < 0.5
            ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
            : (Math.sqrt(1 - 4 * (--t) * t) + 1) / 2;
    }
    static easeInBack(t) { const s = 1.70158; return t * t * ((s + 1) * t - s); }
    static easeOutBack(t) { const s = 1.70158; return (--t) * t * ((s + 1) * t + s) + 1; }
    static easeInOutBack(t) {
        const s = 1.70158 * 1.525;
        return t < 0.5
            ? (t * t * ((s + 1) * 2 * t - s)) / 2
            : ((--t) * t * ((s + 1) * 2 * t + s) + 2) / 2;
    }
    static easeInElastic(t) {
        if (t === 0 || t === 1) return t;
        return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * (2 * Math.PI) / 3);
    }
    static easeOutElastic(t) {
        if (t === 0 || t === 1) return t;
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
    }
    static easeInOutElastic(t) {
        if (t === 0 || t === 1) return t;
        return t < 0.5
            ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * (2 * Math.PI) / 4.5)) / 2
            : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * (2 * Math.PI) / 4.5)) / 2 + 1;
    }
    static easeInBounce(t) { return 1 - VexelEasing.easeOutBounce(1 - t); }
    static easeOutBounce(t) {
        if (t < 1 / 2.75) return 7.5625 * t * t;
        if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
        if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
        return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
    static easeInOutBounce(t) {
        return t < 0.5
            ? (1 - VexelEasing.easeOutBounce(1 - 2 * t)) / 2
            : (1 + VexelEasing.easeOutBounce(2 * t - 1)) / 2;
    }
}

class VexelSpring {
    constructor(target, properties, options = {}) {
        this.target = target;
        this.properties = properties;
        this.stiffness = options.stiffness || 170;
        this.damping = options.damping || 26;
        this.mass = options.mass || 1;
        this.precision = options.precision || 0.01;
        this.velocity = {};
        this.currentValues = {};
        this.endValues = { ...properties };
        this.active = false;
        this.frameId = null;
        this.onUpdate = options.onUpdate || null;
        this.onComplete = options.onComplete || null;

        this._init();
    }

    _init() {
        for (const key of Object.keys(this.endValues)) {
            this.velocity[key] = 0;
            this.currentValues[key] = this.target[key] || 0;
        }
    }

    start() {
        this.active = true;
        this._tick();
    }

    stop() {
        this.active = false;
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }

    _tick() {
        if (!this.active) return;

        let allSettled = true;

        for (const [key, endValue] of Object.entries(this.endValues)) {
            const currentValue = this.currentValues[key];
            const velocity = this.velocity[key];

            const force = -(currentValue - endValue) * this.stiffness;
            const damping = -velocity * this.damping;
            const acceleration = (force + damping) / this.mass;

            this.velocity[key] = velocity + acceleration * 0.016;
            this.currentValues[key] = currentValue + this.velocity[key] * 0.016;

            if (this.target) {
                this.target[key] = this.currentValues[key];
            }

            if (Math.abs(this.currentValues[key] - endValue) > this.precision ||
                Math.abs(this.velocity[key]) > this.precision) {
                allSettled = false;
            }
        }

        if (this.onUpdate) {
            this.onUpdate(this.currentValues);
        }

        if (allSettled) {
            for (const [key, endValue] of Object.entries(this.endValues)) {
                if (this.target) this.target[key] = endValue;
            }
            this.active = false;
            if (this.onComplete) this.onComplete();
            return;
        }

        this.frameId = requestAnimationFrame(() => this._tick());
    }

    setProperties(properties) {
        this.endValues = { ...properties };
        for (const key of Object.keys(properties)) {
            if (!(key in this.velocity)) {
                this.velocity[key] = 0;
                this.currentValues[key] = this.target ? this.target[key] || 0 : 0;
            }
        }
        if (!this.active) this.start();
    }
}

if (typeof window !== 'undefined') {
    window.VexelTimeline = VexelTimeline;
    window.VexelAnimation = VexelAnimation;
    window.VexelEasing = VexelEasing;
    window.VexelSpring = VexelSpring;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VexelTimeline, VexelAnimation, VexelEasing, VexelSpring };
}
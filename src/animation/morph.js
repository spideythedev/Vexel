// src/animation/morph.js

class VexelMorph {
    constructor(vexel) {
        this.vexel = vexel;
        this.animations = [];
        this.playing = false;
        this.frameId = null;
    }

    morph(shape, targetShape, options = {}) {
        const {
            duration = 500,
            easing = 'easeInOutCubic',
            delay = 0,
            onUpdate = null,
            onComplete = null
        } = options;

        if (shape.type !== targetShape.type) {
            console.warn('Morph requires same shape types');
            return null;
        }

        const animation = {
            shape,
            startState: shape.serialize(),
            endState: targetShape.serialize(),
            duration,
            easing,
            delay,
            startTime: null,
            progress: 0,
            completed: false,
            onUpdate,
            onComplete
        };

        this.animations.push(animation);

        if (!this.playing) {
            this.play();
        }

        return animation;
    }

    morphPath(shape, targetPath, options = {}) {
        const {
            duration = 500,
            easing = 'easeInOutCubic',
            delay = 0,
            normalizePoints = true,
            onUpdate = null,
            onComplete = null
        } = options;

        if (!shape.points || !targetPath.points) return null;

        let fromPoints = [...shape.points];
        let toPoints = [...targetPath.points];

        if (normalizePoints && fromPoints.length !== toPoints.length) {
            const maxPoints = Math.max(fromPoints.length, toPoints.length);

            if (fromPoints.length < maxPoints) {
                fromPoints = this._normalizePointCount(fromPoints, maxPoints);
            }
            if (toPoints.length < maxPoints) {
                toPoints = this._normalizePointCount(toPoints, maxPoints);
            }
        }

        const animation = {
            shape,
            type: 'path',
            fromPoints,
            toPoints,
            duration,
            easing,
            delay,
            startTime: null,
            progress: 0,
            completed: false,
            onUpdate,
            onComplete
        };

        this.animations.push(animation);

        if (!this.playing) {
            this.play();
        }

        return animation;
    }

    morphColor(shape, property, fromColor, toColor, options = {}) {
        const {
            duration = 300,
            easing = 'easeInOutCubic',
            delay = 0,
            onUpdate = null,
            onComplete = null
        } = options;

        const fromParsed = VexelColor.parse(fromColor);
        const toParsed = VexelColor.parse(toColor);

        if (!fromParsed || !toParsed) return null;

        const animation = {
            shape,
            type: 'color',
            property,
            fromColor: fromParsed,
            toColor: toParsed,
            duration,
            easing,
            delay,
            startTime: null,
            progress: 0,
            completed: false,
            onUpdate,
            onComplete
        };

        this.animations.push(animation);

        if (!this.playing) {
            this.play();
        }

        return animation;
    }

    morphNumber(shape, property, fromValue, toValue, options = {}) {
        const {
            duration = 300,
            easing = 'easeInOutCubic',
            delay = 0,
            onUpdate = null,
            onComplete = null
        } = options;

        const animation = {
            shape,
            type: 'number',
            property,
            fromValue,
            toValue,
            duration,
            easing,
            delay,
            startTime: null,
            progress: 0,
            completed: false,
            onUpdate,
            onComplete
        };

        this.animations.push(animation);

        if (!this.playing) {
            this.play();
        }

        return animation;
    }

    morphMultiple(shape, properties, options = {}) {
        const animations = [];

        for (const [key, value] of Object.entries(properties)) {
            if (typeof value === 'string' && (value.startsWith('#') || value.startsWith('rgb'))) {
                const anim = this.morphColor(shape, key, shape[key] || '#000000', value, options);
                if (anim) animations.push(anim);
            } else if (typeof value === 'number') {
                const anim = this.morphNumber(shape, key, shape[key] || 0, value, options);
                if (anim) animations.push(anim);
            }
        }

        return animations;
    }

    _normalizePointCount(points, targetCount) {
        if (points.length >= targetCount) return points.slice(0, targetCount);

        const result = [...points];
        const totalLength = this._getPathLength(points);
        const segmentLength = totalLength / (targetCount - 1);

        let currentLength = 0;
        let segmentIndex = 0;
        let pointIndex = 1;

        while (result.length < targetCount - 1) {
            const targetLength = segmentLength * pointIndex;

            while (segmentIndex < points.length - 1 && currentLength < targetLength) {
                const segLen = this._distance(points[segmentIndex], points[segmentIndex + 1]);
                if (currentLength + segLen >= targetLength) {
                    const t = (targetLength - currentLength) / segLen;
                    result.splice(pointIndex, 0, {
                        x: points[segmentIndex].x + (points[segmentIndex + 1].x - points[segmentIndex].x) * t,
                        y: points[segmentIndex].y + (points[segmentIndex + 1].y - points[segmentIndex].y) * t
                    });
                    pointIndex++;
                    break;
                }
                currentLength += segLen;
                segmentIndex++;
            }
            pointIndex++;
        }

        return result;
    }

    _getPathLength(points) {
        let length = 0;
        for (let i = 1; i < points.length; i++) {
            length += this._distance(points[i - 1], points[i]);
        }
        return length;
    }

    _distance(p1, p2) {
        return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    }

    play() {
        this.playing = true;
        this._tick();
    }

    pause() {
        this.playing = false;
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
    }

    stop() {
        this.pause();
        this.animations = [];
    }

    _tick() {
        if (!this.playing) return;

        const now = performance.now();
        let allComplete = true;

        for (const anim of this.animations) {
            if (anim.completed) continue;

            if (anim.startTime === null) {
                anim.startTime = now + anim.delay;
            }

            if (now < anim.startTime) {
                allComplete = false;
                continue;
            }

            anim.progress = Math.min(1, (now - anim.startTime) / anim.duration);
            const easedT = VexelEasing.apply(anim.easing, anim.progress);

            switch (anim.type) {
                case 'path':
                    this._updatePathMorph(anim, easedT);
                    break;
                case 'color':
                    this._updateColorMorph(anim, easedT);
                    break;
                case 'number':
                    this._updateNumberMorph(anim, easedT);
                    break;
                default:
                    this._updateShapeMorph(anim, easedT);
                    break;
            }

            if (anim.onUpdate) {
                anim.onUpdate(anim.progress, easedT);
            }

            if (anim.progress >= 1) {
                anim.completed = true;
                if (anim.onComplete) {
                    anim.onComplete();
                }
            } else {
                allComplete = false;
            }
        }

        this.vexel.dirty = true;

        if (allComplete) {
            this.playing = false;
            this.animations = [];
            return;
        }

        this.frameId = requestAnimationFrame(() => this._tick());
    }

    _updatePathMorph(anim, t) {
        if (!anim.shape.points) return;

        const pointCount = Math.min(anim.fromPoints.length, anim.toPoints.length);

        for (let i = 0; i < pointCount; i++) {
            const from = anim.fromPoints[i];
            const to = anim.toPoints[i];
            anim.shape.points[i] = {
                x: from.x + (to.x - from.x) * t,
                y: from.y + (to.y - from.y) * t
            };
        }
    }

    _updateColorMorph(anim, t) {
        const r = Math.round(anim.fromColor.r + (anim.toColor.r - anim.fromColor.r) * t);
        const g = Math.round(anim.fromColor.g + (anim.toColor.g - anim.fromColor.g) * t);
        const b = Math.round(anim.fromColor.b + (anim.toColor.b - anim.fromColor.b) * t);
        const a = (anim.fromColor.a || 1) + ((anim.toColor.a || 1) - (anim.fromColor.a || 1)) * t;

        anim.shape[anim.property] = a < 1
            ? `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`
            : VexelColor.rgbToHex(r, g, b);
    }

    _updateNumberMorph(anim, t) {
        anim.shape[anim.property] = anim.fromValue + (anim.toValue - anim.fromValue) * t;
    }

    _updateShapeMorph(anim, t) {
        const shape = anim.shape;
        const from = anim.startState;
        const to = anim.endState;

        const numericProps = ['x', 'y', 'width', 'height', 'rotation', 'opacity', 'strokeWidth', 'cornerRadius', 'scaleX', 'scaleY'];

        for (const prop of numericProps) {
            if (from[prop] !== undefined && to[prop] !== undefined) {
                shape[prop] = from[prop] + (to[prop] - from[prop]) * t;
            }
        }
    }

    destroy() {
        this.stop();
        this.animations = [];
    }
}

class VexelPathAnimator {
    constructor(vexel) {
        this.vexel = vexel;
        this.animations = [];
    }

    animateAlongPath(shape, pathPoints, options = {}) {
        const {
            duration = 2000,
            easing = 'easeInOutCubic',
            loop = false,
            autoRotate = true,
            delay = 0,
            onUpdate = null,
            onComplete = null
        } = options;

        const animation = {
            shape,
            pathPoints,
            duration,
            easing,
            loop,
            autoRotate,
            delay,
            progress: 0,
            startTime: null,
            completed: false,
            onUpdate,
            onComplete
        };

        this.animations.push(animation);
        return animation;
    }

    update(time) {
        const now = performance.now();

        for (const anim of this.animations) {
            if (anim.completed && !anim.loop) continue;

            if (anim.startTime === null) {
                anim.startTime = now + anim.delay;
            }

            if (now < anim.startTime) continue;

            const elapsed = now - anim.startTime;
            anim.progress = (elapsed % anim.duration) / anim.duration;

            if (!anim.loop && elapsed >= anim.duration) {
                anim.progress = 1;
                anim.completed = true;
            }

            const easedT = VexelEasing.apply(anim.easing, anim.progress);
            const point = this._getPointOnPath(anim.pathPoints, easedT);

            if (point) {
                anim.shape.x = point.x;
                anim.shape.y = point.y;

                if (anim.autoRotate) {
                    const nextT = Math.min(1, easedT + 0.001);
                    const nextPoint = this._getPointOnPath(anim.pathPoints, nextT);
                    if (nextPoint) {
                        anim.shape.rotation = Math.atan2(
                            nextPoint.y - point.y,
                            nextPoint.x - point.x
                        ) * (180 / Math.PI);
                    }
                }
            }

            if (anim.onUpdate) {
                anim.onUpdate(anim.progress, point);
            }

            if (anim.completed && anim.onComplete) {
                anim.onComplete();
            }
        }
    }

    _getPointOnPath(points, t) {
        if (points.length < 2) return points[0] || null;

        const totalLength = this._getPathLength(points);
        const targetLength = totalLength * t;

        let currentLength = 0;
        for (let i = 1; i < points.length; i++) {
            const segLen = this._distance(points[i - 1], points[i]);
            if (currentLength + segLen >= targetLength) {
                const segT = segLen > 0 ? (targetLength - currentLength) / segLen : 0;
                return {
                    x: points[i - 1].x + (points[i].x - points[i - 1].x) * segT,
                    y: points[i - 1].y + (points[i].y - points[i - 1].y) * segT
                };
            }
            currentLength += segLen;
        }

        return points[points.length - 1];
    }

    _getPathLength(points) {
        let length = 0;
        for (let i = 1; i < points.length; i++) {
            length += this._distance(points[i - 1], points[i]);
        }
        return length;
    }

    _distance(p1, p2) {
        return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    }

    clear() {
        this.animations = [];
    }
}

if (typeof window !== 'undefined') {
    window.VexelMorph = VexelMorph;
    window.VexelPathAnimator = VexelPathAnimator;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VexelMorph, VexelPathAnimator };
}
// src/collab/conflict.js

class VexelConflictResolver {
    constructor() {
        this.strategy = 'last-write-wins';
        this.resolvedConflicts = 0;
        this.unresolvedConflicts = 0;
        this.listeners = [];
    }

    setStrategy(strategy) {
        const validStrategies = ['last-write-wins', 'first-write-wins', 'merge', 'manual'];
        if (validStrategies.includes(strategy)) {
            this.strategy = strategy;
        }
    }

    resolve(local, remote) {
        switch (this.strategy) {
            case 'last-write-wins':
                return this._lastWriteWins(local, remote);
            case 'first-write-wins':
                return this._firstWriteWins(local, remote);
            case 'merge':
                return this._merge(local, remote);
            case 'manual':
                return this._manual(local, remote);
            default:
                return this._lastWriteWins(local, remote);
        }
    }

    _lastWriteWins(local, remote) {
        const localTime = local.timestamp || 0;
        const remoteTime = remote.timestamp || 0;

        if (remoteTime >= localTime) {
            this.resolvedConflicts++;
            this._notify('resolved', { winner: 'remote', local, remote });
            return remote;
        }

        this.resolvedConflicts++;
        this._notify('resolved', { winner: 'local', local, remote });
        return local;
    }

    _firstWriteWins(local, remote) {
        const localTime = local.timestamp || 0;
        const remoteTime = remote.timestamp || 0;

        if (localTime <= remoteTime) {
            this.resolvedConflicts++;
            this._notify('resolved', { winner: 'local', local, remote });
            return local;
        }

        this.resolvedConflicts++;
        this._notify('resolved', { winner: 'remote', local, remote });
        return remote;
    }

    _merge(local, remote) {
        if (!local || !remote) {
            return local || remote;
        }

        if (local.type !== remote.type) {
            return this._lastWriteWins(local, remote);
        }

        const merged = { ...local };

        const numericProps = ['x', 'y', 'width', 'height', 'rotation', 'opacity', 'scaleX', 'scaleY', 'strokeWidth', 'cornerRadius'];

        for (const prop of numericProps) {
            if (remote[prop] !== undefined && local[prop] !== undefined && remote[prop] !== local[prop]) {
                merged[prop] = (local[prop] + remote[prop]) / 2;
            }
        }

        const colorProps = ['fill', 'stroke'];
        for (const prop of colorProps) {
            if (remote[prop] && local[prop] && remote[prop] !== local[prop]) {
                if (VexelColor && VexelColor.parse(remote[prop]) && VexelColor.parse(local[prop])) {
                    merged[prop] = VexelColor.mix(local[prop], remote[prop], 0.5);
                }
            }
        }

        if (remote.text && local.text && remote.text !== local.text) {
            merged.text = local.text + '\n' + remote.text;
        }

        merged.timestamp = Math.max(local.timestamp || 0, remote.timestamp || 0);
        merged._merged = true;

        this.resolvedConflicts++;
        this._notify('resolved', { winner: 'merged', local, remote, merged });
        return merged;
    }

    _manual(local, remote) {
        this.unresolvedConflicts++;
        const conflict = {
            id: `conflict_${Date.now()}`,
            local,
            remote,
            timestamp: Date.now()
        };
        this._notify('conflict', conflict);
        return local;
    }

    resolveShapeConflict(localShape, remoteShape) {
        if (!localShape || !remoteShape) return localShape || remoteShape;

        if (localShape.id !== remoteShape.id) return localShape;

        const localTime = localShape.updatedAt || localShape.timestamp || 0;
        const remoteTime = remoteShape.updatedAt || remoteShape.timestamp || 0;

        if (Math.abs(localTime - remoteTime) < 100) {
            return this._merge(localShape, remoteShape);
        }

        return this.resolve(localShape, remoteShape);
    }

    resolvePropertyConflict(shapeId, property, localValue, remoteValue, localTime, remoteTime) {
        return this.resolve(
            { id: shapeId, property, value: localValue, timestamp: localTime },
            { id: shapeId, property, value: remoteValue, timestamp: remoteTime }
        ).value;
    }

    resolveListConflict(localList, remoteList, keyFn) {
        const result = new Map();
        const conflicts = [];

        for (const item of localList) {
            const key = keyFn(item);
            result.set(key, item);
        }

        for (const remoteItem of remoteList) {
            const key = keyFn(remoteItem);
            const localItem = result.get(key);

            if (localItem) {
                const resolved = this.resolveShapeConflict(localItem, remoteItem);
                result.set(key, resolved);

                if (resolved._merged) {
                    conflicts.push({ local: localItem, remote: remoteItem, resolved });
                }
            } else {
                result.set(key, remoteItem);
            }
        }

        return {
            result: [...result.values()],
            conflicts
        };
    }

    resolveStyleConflict(shapeId, localStyle, remoteStyle) {
        const resolved = {};
        const allKeys = new Set([...Object.keys(localStyle), ...Object.keys(remoteStyle)]);

        for (const key of allKeys) {
            const localVal = localStyle[key];
            const remoteVal = remoteStyle[key];

            if (localVal === undefined) {
                resolved[key] = remoteVal;
            } else if (remoteVal === undefined) {
                resolved[key] = localVal;
            } else if (localVal === remoteVal) {
                resolved[key] = localVal;
            } else {
                resolved[key] = this._merge(
                    { key, value: localVal, timestamp: localStyle._timestamp || 0 },
                    { key, value: remoteVal, timestamp: remoteStyle._timestamp || 0 }
                ).value;
            }
        }

        return resolved;
    }

    on(event, callback) {
        this.listeners.push({ event, callback });
    }

    _notify(event, data) {
        for (const listener of this.listeners) {
            if (listener.event === event || listener.event === '*') {
                listener.callback(data);
            }
        }
    }

    getStats() {
        return {
            strategy: this.strategy,
            resolvedConflicts: this.resolvedConflicts,
            unresolvedConflicts: this.unresolvedConflicts,
            total: this.resolvedConflicts + this.unresolvedConflicts
        };
    }

    reset() {
        this.resolvedConflicts = 0;
        this.unresolvedConflicts = 0;
    }
}

class VexelCRDT {
    constructor(nodeId) {
        this.nodeId = nodeId;
        this.clock = 0;
        this.data = new Map();
    }

    tick() {
        this.clock++;
        return this.clock;
    }

    set(key, value) {
        const timestamp = this.tick();
        this.data.set(key, {
            value,
            timestamp,
            nodeId: this.nodeId,
            version: timestamp
        });
        return timestamp;
    }

    get(key) {
        const entry = this.data.get(key);
        return entry ? entry.value : undefined;
    }

    delete(key) {
        this.tick();
        this.data.set(key, {
            value: undefined,
            timestamp: this.clock,
            nodeId: this.nodeId,
            deleted: true,
            version: this.clock
        });
    }

    merge(remoteData) {
        const conflicts = [];

        for (const [key, remoteEntry] of remoteData) {
            const localEntry = this.data.get(key);

            if (!localEntry) {
                this.data.set(key, remoteEntry);
                if (remoteEntry.version > this.clock) {
                    this.clock = remoteEntry.version;
                }
                continue;
            }

            if (remoteEntry.timestamp > localEntry.timestamp) {
                this.data.set(key, remoteEntry);
                if (remoteEntry.version > this.clock) {
                    this.clock = remoteEntry.version;
                }
            } else if (remoteEntry.timestamp === localEntry.timestamp) {
                if (remoteEntry.nodeId > localEntry.nodeId) {
                    this.data.set(key, remoteEntry);
                }
            } else {
                conflicts.push({ key, local: localEntry, remote: remoteEntry });
            }
        }

        return conflicts;
    }

    getData() {
        const result = new Map();
        for (const [key, entry] of this.data) {
            if (!entry.deleted) {
                result.set(key, entry.value);
            }
        }
        return result;
    }

    getFullData() {
        return new Map(this.data);
    }

    getVersion() {
        return this.clock;
    }
}

if (typeof window !== 'undefined') {
    window.VexelConflictResolver = VexelConflictResolver;
    window.VexelCRDT = VexelCRDT;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VexelConflictResolver, VexelCRDT };
}
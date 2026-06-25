// src/core/plugin.js

class VexelPluginSystem {
    constructor(vexel) {
        this.vexel = vexel;
        this.plugins = new Map();
        this.hooks = {};
        this.loadedCount = 0;
        this.activeCount = 0;
    }

    register(name, plugin, options = {}) {
        if (this.plugins.has(name)) {
            console.warn(`Plugin "${name}" is already registered. Skipping.`);
            return false;
        }

        const pluginInstance = {
            name,
            version: plugin.version || '1.0.0',
            description: plugin.description || '',
            author: plugin.author || '',
            instance: plugin,
            active: false,
            options,
            dependencies: plugin.dependencies || [],
            createdAt: Date.now()
        };

        this.plugins.set(name, pluginInstance);
        this.loadedCount++;
        return true;
    }

    activate(name) {
        const plugin = this.plugins.get(name);
        if (!plugin) {
            console.warn(`Plugin "${name}" not found.`);
            return false;
        }

        if (plugin.active) return true;

        try {
            if (plugin.instance.install) {
                plugin.instance.install(this.vexel);
            }
            plugin.active = true;
            this.activeCount++;
            this._emitHook('plugin:activated', { name, plugin });
            return true;
        } catch (e) {
            console.error(`Failed to activate plugin "${name}":`, e);
            return false;
        }
    }

    deactivate(name) {
        const plugin = this.plugins.get(name);
        if (!plugin || !plugin.active) return false;

        try {
            if (plugin.instance.uninstall) {
                plugin.instance.uninstall(this.vexel);
            }
            plugin.active = false;
            this.activeCount--;
            this._emitHook('plugin:deactivated', { name, plugin });
            return true;
        } catch (e) {
            console.error(`Failed to deactivate plugin "${name}":`, e);
            return false;
        }
    }

    toggle(name) {
        const plugin = this.plugins.get(name);
        if (!plugin) return false;
        return plugin.active ? this.deactivate(name) : this.activate(name);
    }

    unregister(name) {
        const plugin = this.plugins.get(name);
        if (!plugin) return false;

        if (plugin.active) {
            this.deactivate(name);
        }

        this.plugins.delete(name);
        this.loadedCount--;
        this._emitHook('plugin:unregistered', { name });
        return true;
    }

    get(name) {
        return this.plugins.get(name) || null;
    }

    getAll() {
        return [...this.plugins.values()];
    }

    getActive() {
        return [...this.plugins.values()].filter(p => p.active);
    }

    getNames() {
        return [...this.plugins.keys()];
    }

    isActive(name) {
        const plugin = this.plugins.get(name);
        return plugin ? plugin.active : false;
    }

    activateAll() {
        const results = [];
        for (const name of this.plugins.keys()) {
            results.push({ name, success: this.activate(name) });
        }
        return results;
    }

    deactivateAll() {
        const results = [];
        for (const name of this.plugins.keys()) {
            results.push({ name, success: this.deactivate(name) });
        }
        return results;
    }

    registerHook(name, callback) {
        if (!this.hooks[name]) {
            this.hooks[name] = [];
        }
        this.hooks[name].push(callback);
        return () => this.unregisterHook(name, callback);
    }

    unregisterHook(name, callback) {
        if (!this.hooks[name]) return;
        this.hooks[name] = this.hooks[name].filter(cb => cb !== callback);
    }

    _emitHook(name, data) {
        if (!this.hooks[name]) return;
        for (const callback of this.hooks[name]) {
            try {
                callback(data);
            } catch (e) {
                console.error(`Hook "${name}" error:`, e);
            }
        }
    }

    extend(extensionPoint, extension) {
        if (!this.vexel[extensionPoint]) {
            this.vexel[extensionPoint] = {};
        }

        if (typeof extension === 'function') {
            extension(this.vexel[extensionPoint], this.vexel);
        } else if (typeof extension === 'object') {
            Object.assign(this.vexel[extensionPoint], extension);
        }
    }

    createTool(name, ToolClass) {
        if (!this.vexel.tools) {
            this.vexel.tools = {};
        }

        const tool = new ToolClass(this.vexel);
        this.vexel.tools[name] = tool;

        this.register(`tool-${name}`, {
            version: '1.0.0',
            description: `${name} tool`,
            install: (vexel) => {
                if (!vexel.tools) vexel.tools = {};
                vexel.tools[name] = tool;
            },
            uninstall: (vexel) => {
                if (vexel.tools) {
                    delete vexel.tools[name];
                }
            }
        });

        return tool;
    }

    createShape(name, ShapeClass) {
        const constructor = function(...args) {
            return new ShapeClass(...args);
        };

        if (!this.vexel[name]) {
            this.vexel[name] = constructor;
        }

        return constructor;
    }

    getStats() {
        return {
            totalPlugins: this.plugins.size,
            loadedCount: this.loadedCount,
            activeCount: this.activeCount,
            plugins: [...this.plugins.values()].map(p => ({
                name: p.name,
                version: p.version,
                active: p.active,
                description: p.description
            }))
        };
    }

    destroy() {
        this.deactivateAll();
        this.plugins.clear();
        this.hooks = {};
        this.loadedCount = 0;
        this.activeCount = 0;
    }
}

class VexelPlugin {
    constructor(options = {}) {
        this.name = options.name || 'Unnamed Plugin';
        this.version = options.version || '1.0.0';
        this.description = options.description || '';
        this.author = options.author || '';
        this.dependencies = options.dependencies || [];
    }

    install(vexel) {
        throw new Error('Plugin must implement install(vexel) method');
    }

    uninstall(vexel) {
        throw new Error('Plugin must implement uninstall(vexel) method');
    }

    static create(options, installFn, uninstallFn) {
        const plugin = new VexelPlugin(options);
        if (installFn) plugin.install = installFn;
        if (uninstallFn) plugin.uninstall = uninstallFn || (() => {});
        return plugin;
    }
}

class VexelPluginRegistry {
    constructor() {
        this.registry = new Map();
    }

    add(pluginClass, metadata = {}) {
        const name = metadata.name || pluginClass.prototype?.name || 'Unnamed';
        if (this.registry.has(name)) {
            console.warn(`Plugin "${name}" already registered`);
            return false;
        }
        this.registry.set(name, { class: pluginClass, metadata });
        return true;
    }

    remove(name) {
        return this.registry.delete(name);
    }

    get(name) {
        return this.registry.get(name) || null;
    }

    getAll() {
        return [...this.registry.entries()].map(([name, data]) => ({
            name,
            ...data.metadata
        }));
    }

    create(name, vexel, ...args) {
        const entry = this.registry.get(name);
        if (!entry) return null;

        const plugin = new entry.class(vexel, ...args);
        return plugin;
    }

    clear() {
        this.registry.clear();
    }
}

if (typeof window !== 'undefined') {
    window.VexelPluginSystem = VexelPluginSystem;
    window.VexelPlugin = VexelPlugin;
    window.VexelPluginRegistry = VexelPluginRegistry;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VexelPluginSystem, VexelPlugin, VexelPluginRegistry };
}
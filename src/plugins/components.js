// src/plugins/components.js

class VexelComponentsPlugin {
    constructor(vexel) {
        this.vexel = vexel;
        this.name = 'Vexel Components';
        this.version = '1.0.0';
        this.components = new Map();
        this.instances = new Map();
        this.masterComponents = new Map();
    }

    install(vexel) {
        vexel.components = {
            create: (name, shapes, options) => this.createComponent(name, shapes, options),
            get: (name) => this.getComponent(name),
            getAll: () => this.getAllComponents(),
            createInstance: (name, x, y) => this.createInstance(name, x, y),
            getInstances: (name) => this.getInstances(name),
            detach: (instance) => this.detachInstance(instance),
            reset: (instance) => this.resetInstance(instance),
            pushChanges: (name) => this.pushChanges(name),
            delete: (name) => this.deleteComponent(name)
        };
    }

    uninstall(vexel) {
        delete vexel.components;
    }

    createComponent(name, shapes, options = {}) {
        if (this.components.has(name)) {
            console.warn(`Component "${name}" already exists. Overwriting.`);
        }

        const component = {
            name,
            shapes: shapes.map(s => s.serialize()),
            options,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        this.components.set(name, component);
        this.instances.set(name, []);

        return component;
    }

    getComponent(name) {
        return this.components.get(name) || null;
    }

    getAllComponents() {
        return [...this.components.entries()].map(([name, component]) => ({
            name,
            shapeCount: component.shapes.length,
            instanceCount: (this.instances.get(name) || []).length,
            createdAt: component.createdAt,
            updatedAt: component.updatedAt
        }));
    }

    createInstance(name, x = 0, y = 0) {
        const component = this.components.get(name);
        if (!component) {
            console.warn(`Component "${name}" not found.`);
            return null;
        }

        const shapes = component.shapes.map(s => this._deserializeShape(s));
        const group = new VexelGroup(shapes, {
            name: `${name} instance`,
            x,
            y
        });

        group._componentName = name;
        group._componentInstance = true;

        this.vexel.shapes.push(group);

        const instances = this.instances.get(name) || [];
        instances.push(group);
        this.instances.set(name, instances);

        this.vexel.dirty = true;
        return group;
    }

    getInstances(name) {
        return this.instances.get(name) || [];
    }

    detachInstance(instance) {
        if (!instance._componentInstance) return false;

        const name = instance._componentName;
        if (!name) return false;

        const instances = this.instances.get(name) || [];
        const index = instances.indexOf(instance);
        if (index > -1) {
            instances.splice(index, 1);
            this.instances.set(name, instances);
            instance._componentName = null;
            instance._componentInstance = false;
            return true;
        }

        return false;
    }

    resetInstance(instance) {
        if (!instance._componentInstance) return false;

        const name = instance._componentName;
        if (!name) return false;

        const component = this.components.get(name);
        if (!component) return false;

        const x = instance.x;
        const y = instance.y;

        instance.shapes = component.shapes.map(s => {
            const shape = this._deserializeShape(s);
            return shape;
        });

        instance.x = x;
        instance.y = y;
        this.vexel.dirty = true;
        return true;
    }

    pushChanges(name) {
        const component = this.components.get(name);
        if (!component) return false;

        const instances = this.instances.get(name) || [];
        if (instances.length === 0) return false;

        const masterInstance = instances[0];
        component.shapes = masterInstance.shapes.map(s => s.serialize());
        component.updatedAt = Date.now();

        for (let i = 1; i < instances.length; i++) {
            const instance = instances[i];
            const x = instance.x;
            const y = instance.y;
            instance.shapes = component.shapes.map(s => this._deserializeShape(s));
            instance.x = x;
            instance.y = y;
        }

        this.vexel.dirty = true;
        return true;
    }

    pullChanges(name) {
        const component = this.components.get(name);
        if (!component) return false;

        const instances = this.instances.get(name) || [];

        for (const instance of instances) {
            const x = instance.x;
            const y = instance.y;
            instance.shapes = component.shapes.map(s => this._deserializeShape(s));
            instance.x = x;
            instance.y = y;
        }

        this.vexel.dirty = true;
        return true;
    }

    deleteComponent(name) {
        const instances = this.instances.get(name) || [];
        for (const instance of instances) {
            this.detachInstance(instance);
            const index = this.vexel.shapes.indexOf(instance);
            if (index > -1) {
                this.vexel.shapes.splice(index, 1);
            }
        }

        this.components.delete(name);
        this.instances.delete(name);
        this.vexel.dirty = true;
        return true;
    }

    _deserializeShape(data) {
        const ctors = {
            rectangle: VexelRectangle,
            ellipse: VexelEllipse,
            polygon: VexelPolygon,
            line: VexelLine,
            path: VexelPath,
            text: VexelText,
            image: VexelImage,
            group: VexelGroup
        };
        const Ctor = ctors[data.type];
        if (Ctor && Ctor.deserialize) return Ctor.deserialize(data);
        return null;
    }

    serialize() {
        const data = {};
        for (const [name, component] of this.components) {
            data[name] = {
                shapes: component.shapes,
                options: component.options,
                createdAt: component.createdAt,
                updatedAt: component.updatedAt,
                instanceCount: (this.instances.get(name) || []).length
            };
        }
        return data;
    }

    deserialize(data) {
        for (const [name, component] of Object.entries(data)) {
            this.components.set(name, {
                name,
                shapes: component.shapes,
                options: component.options || {},
                createdAt: component.createdAt,
                updatedAt: component.updatedAt
            });
            this.instances.set(name, []);
        }
    }
}

class VexelTemplatePlugin {
    constructor(vexel) {
        this.vexel = vexel;
        this.name = 'Vexel Templates';
        this.version = '1.0.0';
        this.templates = new Map();
    }

    install(vexel) {
        vexel.templates = {
            register: (name, data, options) => this.register(name, data, options),
            apply: (name, options) => this.apply(name, options),
            list: () => this.listTemplates(),
            delete: (name) => this.deleteTemplate(name),
            export: () => this.exportTemplates(),
            import: (data) => this.importTemplates(data)
        };

        this._loadDefaults();
    }

    uninstall(vexel) {
        delete vexel.templates;
    }

    _loadDefaults() {
        const defaults = {
            'Mobile App': {
                width: 375, height: 812,
                description: 'iPhone mobile app screen'
            },
            'Desktop Dashboard': {
                width: 1440, height: 900,
                description: 'Desktop dashboard layout'
            },
            'Business Card': {
                width: 252, height: 144,
                description: 'Standard business card'
            },
            'Social Post': {
                width: 1080, height: 1080,
                description: 'Instagram/Facebook post'
            },
            'Presentation': {
                width: 1920, height: 1080,
                description: 'Presentation slide'
            },
            'A4 Document': {
                width: 595, height: 842,
                description: 'A4 print document'
            }
        };

        for (const [name, config] of Object.entries(defaults)) {
            this.templates.set(name, {
                ...config,
                preset: true
            });
        }
    }

    register(name, data, options = {}) {
        const template = {
            name,
            shapes: data.shapes ? data.shapes.map(s => s.serialize()) : [],
            width: data.width || this.vexel.width,
            height: data.height || this.vexel.height,
            description: options.description || '',
            category: options.category || 'Custom',
            tags: options.tags || [],
            createdAt: Date.now()
        };

        this.templates.set(name, template);
        return template;
    }

    apply(name, options = {}) {
        const template = this.templates.get(name);
        if (!template) {
            console.warn(`Template "${name}" not found.`);
            return false;
        }

        if (options.clearExisting !== false) {
            this.vexel.clear();
        }

        if (template.width && template.height && options.resizeCanvas !== false) {
            this.vexel.resize(template.width, template.height);
        }

        if (template.shapes && template.shapes.length > 0) {
            for (const shapeData of template.shapes) {
                const shape = this._deserializeShape(shapeData);
                if (shape) {
                    this.vexel.shapes.push(shape);
                }
            }
        }

        this.vexel.viewportManager.reset();
        this.vexel.viewportManager.zoomToFit(this.vexel.shapes);
        this.vexel.dirty = true;
        return true;
    }

    listTemplates() {
        return [...this.templates.entries()].map(([name, template]) => ({
            name,
            description: template.description,
            category: template.category,
            tags: template.tags,
            width: template.width,
            height: template.height,
            shapeCount: template.shapes ? template.shapes.length : 0,
            preset: template.preset || false
        }));
    }

    deleteTemplate(name) {
        const template = this.templates.get(name);
        if (template && template.preset) {
            console.warn('Cannot delete preset templates.');
            return false;
        }
        return this.templates.delete(name);
    }

    createFromCurrent(name, options = {}) {
        return this.register(name, {
            shapes: this.vexel.shapes,
            width: this.vexel.width,
            height: this.vexel.height
        }, options);
    }

    exportTemplates() {
        const data = {};
        for (const [name, template] of this.templates) {
            if (!template.preset) {
                data[name] = {
                    shapes: template.shapes,
                    width: template.width,
                    height: template.height,
                    description: template.description,
                    category: template.category,
                    tags: template.tags
                };
            }
        }
        return JSON.stringify(data, null, 2);
    }

    importTemplates(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            let count = 0;
            for (const [name, template] of Object.entries(data)) {
                this.register(name, {
                    shapes: template.shapes,
                    width: template.width,
                    height: template.height
                }, {
                    description: template.description,
                    category: template.category,
                    tags: template.tags
                });
                count++;
            }
            return count;
        } catch (e) {
            console.error('Failed to import templates:', e);
            return 0;
        }
    }

    _deserializeShape(data) {
        const ctors = {
            rectangle: VexelRectangle,
            ellipse: VexelEllipse,
            polygon: VexelPolygon,
            line: VexelLine,
            path: VexelPath,
            text: VexelText,
            image: VexelImage,
            group: VexelGroup
        };
        const Ctor = ctors[data.type];
        if (Ctor && Ctor.deserialize) return Ctor.deserialize(data);
        return null;
    }
}

if (typeof window !== 'undefined') {
    window.VexelComponentsPlugin = VexelComponentsPlugin;
    window.VexelTemplatePlugin = VexelTemplatePlugin;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VexelComponentsPlugin, VexelTemplatePlugin };
}
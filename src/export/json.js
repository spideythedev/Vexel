// src/export/json.js

class VexelJSONExport {
    constructor(vexel) {
        this.vexel = vexel;
        this.version = '1.0.0';
    }

    export(options = {}) {
        const {
            pretty = true,
            includeMetadata = true,
            includeHistory = false,
            includeViewport = true,
            compress = false
        } = options;

        const data = {
            vexel: this.version,
            type: 'vexel-document',
            exportedAt: new Date().toISOString()
        };

        if (includeMetadata) {
            data.metadata = {
                name: options.name || 'Untitled',
                author: options.author || 'Unknown',
                description: options.description || '',
                tags: options.tags || [],
                createdAt: options.createdAt || new Date().toISOString(),
                modifiedAt: new Date().toISOString(),
                version: options.documentVersion || 1
            };
        }

        if (includeViewport) {
            data.viewport = {
                x: this.vexel.viewport.x,
                y: this.vexel.viewport.y,
                zoom: this.vexel.viewport.zoom,
                rotation: this.vexel.viewport.rotation,
                width: this.vexel.width,
                height: this.vexel.height
            };
        }

        data.shapes = this.vexel.shapes.map(s => this._serializeShape(s));

        data.layers = this.vexel.layers.map(l => ({
            id: l.id,
            name: l.name,
            visible: l.visible,
            locked: l.locked,
            opacity: l.opacity,
            shapeIds: l.shapes.map(s => s.id)
        }));

        if (includeHistory && this.vexel.history) {
            data.history = {
                undoCount: this.vexel.history.undo.length,
                redoCount: this.vexel.history.redo.length
            };
        }

        if (options.plugins) {
            data.plugins = this.vexel.plugins.map(p => ({
                name: p.name,
                version: p.version
            }));
        }

        let result;
        if (pretty) {
            result = JSON.stringify(data, null, 2);
        } else {
            result = JSON.stringify(data);
        }

        if (compress) {
            result = this._compress(result);
        }

        return result;
    }

    _serializeShape(shape) {
        const data = shape.serialize();

        if (shape.shapes && shape.type === 'group') {
            data.shapes = shape.shapes.map(s => this._serializeShape(s));
        }

        if (shape.clipPath) {
            data.clipPath = shape.clipPath.id;
        }

        if (shape.mask) {
            data.mask = shape.mask.id;
        }

        if (shape.effects && shape.effects.length > 0) {
            data.effects = shape.effects.map(e => ({
                type: e.type,
                properties: e.properties || {}
            }));
        }

        return data;
    }

    _compress(data) {
        return data
            .replace(/\s+/g, '')
            .replace(/"([^"]+)":/g, '$1:');
    }

    download(filename = 'vexel-document.vexel', options = {}) {
        const json = this.export(options);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    static import(vexel, data, options = {}) {
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                console.error('Invalid JSON:', e);
                return false;
            }
        }

        if (!data || !data.shapes) {
            console.error('Invalid Vexel document format');
            return false;
        }

        if (options.clearExisting !== false) {
            vexel.shapes = [];
            vexel.layers = [];
            vexel.selectedShapes = [];
        }

        if (data.viewport && options.restoreViewport !== false) {
            vexel.viewport.x = data.viewport.x || 0;
            vexel.viewport.y = data.viewport.y || 0;
            vexel.viewport.zoom = data.viewport.zoom || 1;
            vexel.viewport.rotation = data.viewport.rotation || 0;
        }

        const shapeMap = new Map();

        for (const shapeData of data.shapes) {
            const shape = VexelJSONExport._deserializeShape(shapeData);
            if (shape) {
                vexel.shapes.push(shape);
                shapeMap.set(shape.id, shape);
            }
        }

        for (const shapeData of data.shapes) {
            if (shapeData.clipPath) {
                const shape = shapeMap.get(shapeData.id);
                const clipShape = shapeMap.get(shapeData.clipPath);
                if (shape && clipShape) {
                    shape.setClipPath(clipShape);
                }
            }
            if (shapeData.mask) {
                const shape = shapeMap.get(shapeData.id);
                const maskShape = shapeMap.get(shapeData.mask);
                if (shape && maskShape) {
                    shape.setMask(maskShape);
                }
            }
        }

        if (data.layers && options.restoreLayers !== false) {
            for (const layerData of data.layers) {
                const layer = {
                    id: layerData.id,
                    name: layerData.name,
                    visible: layerData.visible,
                    locked: layerData.locked,
                    opacity: layerData.opacity,
                    shapes: layerData.shapeIds.map(id => shapeMap.get(id)).filter(Boolean)
                };
                vexel.layers.push(layer);
            }
        }

        vexel.dirty = true;
        return true;
    }

    static _deserializeShape(data) {
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

        if (data.type === 'group' && data.shapes) {
            const childShapes = data.shapes
                .map(s => VexelJSONExport._deserializeShape(s))
                .filter(Boolean);
            return new VexelGroup(childShapes, data);
        }

        if (Ctor.deserialize) {
            return Ctor.deserialize(data);
        }

        return new Ctor(data);
    }
}

class VexelPNGExport {
    constructor(vexel) {
        this.vexel = vexel;
    }

    export(options = {}) {
        return new Promise((resolve, reject) => {
            const {
                scale = 1,
                background = '#ffffff',
                padding = 0,
                region = null,
                format = 'image/png',
                quality = 1.0
            } = options;

            let x = 0, y = 0;
            let width = this.vexel.width;
            let height = this.vexel.height;

            if (region) {
                x = region.x || 0;
                y = region.y || 0;
                width = region.width || this.vexel.width;
                height = region.height || this.vexel.height;
            }

            const exportWidth = (width + padding * 2) * scale;
            const exportHeight = (height + padding * 2) * scale;

            const canvas = document.createElement('canvas');
            canvas.width = exportWidth;
            canvas.height = exportHeight;

            const ctx = canvas.getContext('2d');

            if (background && background !== 'transparent') {
                ctx.fillStyle = background;
                ctx.fillRect(0, 0, exportWidth, exportHeight);
            }

            ctx.save();
            ctx.scale(scale, scale);
            ctx.translate(padding - x, padding - y);

            ctx.translate(this.vexel.viewport.x, this.vexel.viewport.y);
            ctx.scale(this.vexel.viewport.zoom, this.vexel.viewport.zoom);
            ctx.rotate(this.vexel.viewport.rotation);

            for (const shape of this.vexel.shapes) {
                if (shape.visible !== false) {
                    shape.draw(ctx);
                }
            }

            ctx.restore();

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create blob'));
                    }
                },
                format,
                quality
            );
        });
    }

    async download(filename = 'vexel-export.png', options = {}) {
        const blob = await this.export(options);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

class VexelPDFExport {
    constructor(vexel) {
        this.vexel = vexel;
    }

    export(options = {}) {
        const {
            format = 'a4',
            orientation = 'landscape',
            margin = 20,
            scale = 1
        } = options;

        const sizes = {
            a4: { width: 297, height: 210 },
            a3: { width: 420, height: 297 },
            letter: { width: 279, height: 216 },
            custom: { width: options.width || this.vexel.width, height: options.height || this.vexel.height }
        };

        const page = sizes[format] || sizes.custom;
        let pageWidth = page.width;
        let pageHeight = page.height;

        if (orientation === 'portrait') {
            [pageWidth, pageHeight] = [pageHeight, pageWidth];
        }

        const svgWidth = pageWidth - margin * 2;
        const svgHeight = pageHeight - margin * 2;

        const scaleX = svgWidth / this.vexel.width;
        const scaleY = svgHeight / this.vexel.height;
        const fitScale = Math.min(scaleX, scaleY) * scale;

        const svg = new VexelSVGExport(this.vexel);
        const svgContent = svg.export({ includeMetadata: false, pretty: false });

        const pdfContent = `<?xml version="1.0" encoding="UTF-8"?>
        <svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}mm" height="${pageHeight}mm" viewBox="0 0 ${pageWidth} ${pageHeight}">
          <rect width="100%" height="100%" fill="white"/>
          <g transform="translate(${margin} ${margin}) scale(${fitScale})">
            ${svgContent.replace(/<\?xml.*?\?>/, '').replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '')}
          </g>
        </svg>`;

        return pdfContent;
    }

    download(filename = 'vexel-export.pdf', options = {}) {
        const svg = this.export(options);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

if (typeof window !== 'undefined') {
    window.VexelJSONExport = VexelJSONExport;
    window.VexelPNGExport = VexelPNGExport;
    window.VexelPDFExport = VexelPDFExport;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VexelJSONExport, VexelPNGExport, VexelPDFExport };
}
// src/renderer/webgl.js

class VexelWebGLRenderer {
    constructor(vexel) {
        this.vexel = vexel;
        this.gl = null;
        this.programs = {};
        this.buffers = {};
        this.initialized = false;
        this.maxTextureSize = 4096;
        this.batchSize = 1000;
        this.drawCalls = 0;
    }

    init() {
        const canvas = document.createElement('canvas');
        canvas.width = this.vexel.width;
        canvas.height = this.vexel.height;
        canvas.style.cssText = this.vexel.canvas.style.cssText;

        this.gl = canvas.getContext('webgl2', {
            alpha: true,
            antialias: true,
            premultipliedAlpha: true,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance'
        });

        if (!this.gl) {
            this.gl = canvas.getContext('webgl', {
                alpha: true,
                antialias: true,
                premultipliedAlpha: true,
                preserveDrawingBuffer: false
            });
        }

        if (!this.gl) {
            console.warn('WebGL not supported, falling back to Canvas2D');
            return false;
        }

        this.vexel.canvas.parentNode.replaceChild(canvas, this.vexel.canvas);
        this.vexel.canvas = canvas;
        this.vexel.ctx = this.gl;

        this._createShaders();
        this._createBuffers();
        this._setupState();

        this.initialized = true;
        return true;
    }

    _createShaders() {
        const gl = this.gl;

        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec4 a_color;
            attribute vec2 a_texCoord;
            uniform mat3 u_matrix;
            varying vec4 v_color;
            varying vec2 v_texCoord;
            void main() {
                vec3 position = u_matrix * vec3(a_position, 1.0);
                gl_Position = vec4(position.xy, 0.0, 1.0);
                v_color = a_color;
                v_texCoord = a_texCoord;
            }
        `;

        const fragmentShaderSource = `
            precision mediump float;
            varying vec4 v_color;
            varying vec2 v_texCoord;
            uniform sampler2D u_texture;
            uniform bool u_useTexture;
            void main() {
                if (u_useTexture) {
                    gl_FragColor = texture2D(u_texture, v_texCoord) * v_color;
                } else {
                    gl_FragColor = v_color;
                }
            }
        `;

        this.programs.main = this._compileShader(vertexShaderSource, fragmentShaderSource);
    }

    _compileShader(vertexSource, fragmentSource) {
        const gl = this.gl;

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);

        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            console.error('Vertex shader error:', gl.getShaderInfoLog(vertexShader));
            return null;
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);

        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            console.error('Fragment shader error:', gl.getShaderInfoLog(fragmentShader));
            return null;
        }

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return null;
        }

        return {
            program,
            uniforms: {
                matrix: gl.getUniformLocation(program, 'u_matrix'),
                texture: gl.getUniformLocation(program, 'u_texture'),
                useTexture: gl.getUniformLocation(program, 'u_useTexture')
            },
            attributes: {
                position: gl.getAttribLocation(program, 'a_position'),
                color: gl.getAttribLocation(program, 'a_color'),
                texCoord: gl.getAttribLocation(program, 'a_texCoord')
            }
        };
    }

    _createBuffers() {
        const gl = this.gl;

        this.buffers.position = gl.createBuffer();
        this.buffers.color = gl.createBuffer();
        this.buffers.texCoord = gl.createBuffer();
        this.buffers.index = gl.createBuffer();
    }

    _setupState() {
        const gl = this.gl;

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.SCISSOR_TEST);
        gl.clearColor(0, 0, 0, 0);
    }

    begin() {
        const gl = this.gl;
        this.drawCalls = 0;

        gl.viewport(0, 0, this.vexel.width * this.vexel.pixelRatio || 1, this.vexel.height * this.vexel.pixelRatio || 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const program = this.programs.main;
        gl.useProgram(program.program);

        const matrix = this._getViewMatrix();
        gl.uniformMatrix3fv(program.uniforms.matrix, false, matrix);
        gl.uniform1i(program.uniforms.texture, 0);
        gl.uniform1i(program.uniforms.useTexture, 0);
    }

    end() {
        this.gl.flush();
    }

    _getViewMatrix() {
        const vp = this.vexel.viewport;
        const w = this.vexel.width;
        const h = this.vexel.height;

        const a = 2 / w;
        const b = 2 / h;
        const c = -1 + vp.x * a;
        const d = -1 + vp.y * b;

        return [
            a * vp.zoom, 0, c,
            0, b * vp.zoom, d,
            0, 0, 1
        ];
    }

    drawRect(x, y, width, height, color) {
        const gl = this.gl;
        const program = this.programs.main;

        const x1 = x;
        const y1 = y;
        const x2 = x + width;
        const y2 = y + height;

        const positions = new Float32Array([
            x1, y1, x2, y1, x1, y2,
            x1, y2, x2, y1, x2, y2
        ]);

        const r = ((color >> 16) & 0xFF) / 255;
        const g = ((color >> 8) & 0xFF) / 255;
        const b = (color & 0xFF) / 255;
        const a = ((color >> 24) & 0xFF) / 255 || 1;

        const colors = new Float32Array([
            r, g, b, a, r, g, b, a, r, g, b, a,
            r, g, b, a, r, g, b, a, r, g, b, a
        ]);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(program.attributes.position);
        gl.vertexAttribPointer(program.attributes.position, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.color);
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(program.attributes.color);
        gl.vertexAttribPointer(program.attributes.color, 4, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        this.drawCalls++;
    }

    drawEllipse(cx, cy, rx, ry, color, segments = 64) {
        const gl = this.gl;
        const program = this.programs.main;

        const positions = [];
        const colors = [];

        const r = ((color >> 16) & 0xFF) / 255;
        const g = ((color >> 8) & 0xFF) / 255;
        const b = (color & 0xFF) / 255;
        const a = ((color >> 24) & 0xFF) / 255 || 1;

        positions.push(cx, cy);

        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            positions.push(
                cx + Math.cos(angle) * rx,
                cy + Math.sin(angle) * ry
            );
        }

        for (let i = 0; i <= segments + 1; i++) {
            colors.push(r, g, b, a);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(program.attributes.position);
        gl.vertexAttribPointer(program.attributes.position, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.color);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(program.attributes.color);
        gl.vertexAttribPointer(program.attributes.color, 4, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, segments + 2);
        this.drawCalls++;
    }

    drawLine(x1, y1, x2, y2, color, width = 1) {
        const gl = this.gl;
        const program = this.programs.main;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / len * width / 2;
        const ny = dx / len * width / 2;

        const positions = new Float32Array([
            x1 + nx, y1 + ny, x1 - nx, y1 - ny, x2 + nx, y2 + ny,
            x1 - nx, y1 - ny, x2 - nx, y2 - ny, x2 + nx, y2 + ny
        ]);

        const r = ((color >> 16) & 0xFF) / 255;
        const g = ((color >> 8) & 0xFF) / 255;
        const b = (color & 0xFF) / 255;
        const a = ((color >> 24) & 0xFF) / 255 || 1;

        const colors = new Float32Array([
            r, g, b, a, r, g, b, a, r, g, b, a,
            r, g, b, a, r, g, b, a, r, g, b, a
        ]);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(program.attributes.position);
        gl.vertexAttribPointer(program.attributes.position, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.color);
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(program.attributes.color);
        gl.vertexAttribPointer(program.attributes.color, 4, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
        this.drawCalls++;
    }

    drawPolygon(vertices, color) {
        if (vertices.length < 3) return;

        const gl = this.gl;
        const program = this.programs.main;

        const positions = [];
        const r = ((color >> 16) & 0xFF) / 255;
        const g = ((color >> 8) & 0xFF) / 255;
        const b = (color & 0xFF) / 255;
        const a = ((color >> 24) & 0xFF) / 255 || 1;

        for (let i = 1; i < vertices.length - 1; i++) {
            positions.push(
                vertices[0].x, vertices[0].y,
                vertices[i].x, vertices[i].y,
                vertices[i + 1].x, vertices[i + 1].y
            );
        }

        const colors = new Float32Array((positions.length / 2) * 4);
        for (let i = 0; i < colors.length; i += 4) {
            colors[i] = r;
            colors[i + 1] = g;
            colors[i + 2] = b;
            colors[i + 3] = a;
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(program.attributes.position);
        gl.vertexAttribPointer(program.attributes.position, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.color);
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(program.attributes.color);
        gl.vertexAttribPointer(program.attributes.color, 4, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2);
        this.drawCalls++;
    }

    setScissor(x, y, width, height) {
        const gl = this.gl;
        gl.scissor(x, this.vexel.height - y - height, width, height);
    }

    clearScissor() {
        const gl = this.gl;
        gl.scissor(0, 0, this.vexel.width, this.vexel.height);
    }

    createTexture(image) {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return texture;
    }

    getStats() {
        return {
            drawCalls: this.drawCalls,
            initialized: this.initialized,
            renderer: 'WebGL',
            maxTextureSize: this.maxTextureSize
        };
    }

    destroy() {
        const gl = this.gl;
        if (gl) {
            for (const key of Object.keys(this.buffers)) {
                gl.deleteBuffer(this.buffers[key]);
            }
            for (const key of Object.keys(this.programs)) {
                gl.deleteProgram(this.programs[key].program);
            }
        }
        this.initialized = false;
    }
}

if (typeof window !== 'undefined') {
    window.VexelWebGLRenderer = VexelWebGLRenderer;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelWebGLRenderer;
}
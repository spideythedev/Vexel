// src/utils/dom.js

class VexelDOM {
    static create(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);

        for (const [key, value] of Object.entries(attributes)) {
            if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key === 'dataset' && typeof value === 'object') {
                Object.assign(element.dataset, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                element.addEventListener(key.substring(2).toLowerCase(), value);
            } else if (key === 'className') {
                element.className = value;
            } else if (key === 'html') {
                element.innerHTML = value;
            } else {
                element.setAttribute(key, value);
            }
        }

        for (const child of children) {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        }

        return element;
    }

    static div(attributes = {}, children = []) {
        return VexelDOM.create('div', attributes, children);
    }

    static span(attributes = {}, children = []) {
        return VexelDOM.create('span', attributes, children);
    }

    static button(attributes = {}, children = []) {
        return VexelDOM.create('button', attributes, children);
    }

    static input(attributes = {}) {
        return VexelDOM.create('input', attributes);
    }

    static label(attributes = {}, children = []) {
        return VexelDOM.create('label', attributes, children);
    }

    static select(attributes = {}, options = []) {
        const element = VexelDOM.create('select', attributes);
        for (const opt of options) {
            const optionEl = VexelDOM.create('option', {
                value: opt.value,
                html: opt.label,
                selected: opt.selected || false
            });
            element.appendChild(optionEl);
        }
        return element;
    }

    static mount(element, container) {
        const target = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        if (target) {
            target.appendChild(element);
            return true;
        }
        return false;
    }

    static unmount(element) {
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
            return true;
        }
        return false;
    }

    static empty(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
        return element;
    }

    static replace(oldElement, newElement) {
        if (oldElement && oldElement.parentNode) {
            oldElement.parentNode.replaceChild(newElement, oldElement);
            return true;
        }
        return false;
    }

    static show(element, display = 'block') {
        element.style.display = display;
    }

    static hide(element) {
        element.style.display = 'none';
    }

    static toggle(element, display = 'block') {
        if (element.style.display === 'none') {
            VexelDOM.show(element, display);
        } else {
            VexelDOM.hide(element);
        }
    }

    static addClass(element, ...classes) {
        element.classList.add(...classes);
    }

    static removeClass(element, ...classes) {
        element.classList.remove(...classes);
    }

    static toggleClass(element, className) {
        element.classList.toggle(className);
    }

    static hasClass(element, className) {
        return element.classList.contains(className);
    }

    static setText(element, text) {
        element.textContent = text;
    }

    static setHTML(element, html) {
        element.innerHTML = html;
    }

    static setStyle(element, styles) {
        Object.assign(element.style, styles);
    }

    static getStyle(element, property) {
        return window.getComputedStyle(element)[property];
    }

    static setAttr(element, attributes) {
        for (const [key, value] of Object.entries(attributes)) {
            element.setAttribute(key, value);
        }
    }

    static getAttr(element, attribute) {
        return element.getAttribute(attribute);
    }

    static removeAttr(element, attribute) {
        element.removeAttribute(attribute);
    }

    static on(element, event, handler, options = {}) {
        element.addEventListener(event, handler, options);
        return () => element.removeEventListener(event, handler, options);
    }

    static once(element, event, handler) {
        element.addEventListener(event, handler, { once: true });
    }

    static delegate(element, event, selector, handler) {
        element.addEventListener(event, (e) => {
            const target = e.target.closest(selector);
            if (target && element.contains(target)) {
                handler.call(target, e);
            }
        });
    }

    static offset(element) {
        const rect = element.getBoundingClientRect();
        return {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height
        };
    }

    static position(element) {
        return {
            top: element.offsetTop,
            left: element.offsetLeft
        };
    }

    static scrollTo(element, options = {}) {
        element.scrollIntoView({
            behavior: options.smooth !== false ? 'smooth' : 'auto',
            block: options.block || 'start',
            inline: options.inline || 'nearest'
        });
    }

    static fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';
        element.style.transition = `opacity ${duration}ms ease`;

        requestAnimationFrame(() => {
            element.style.opacity = '1';
        });

        setTimeout(() => {
            element.style.transition = '';
        }, duration);
    }

    static fadeOut(element, duration = 300) {
        element.style.transition = `opacity ${duration}ms ease`;
        element.style.opacity = '0';

        setTimeout(() => {
            element.style.display = 'none';
            element.style.transition = '';
        }, duration);
    }

    static slideDown(element, duration = 300) {
        element.style.display = 'block';
        const height = element.scrollHeight;
        element.style.overflow = 'hidden';
        element.style.height = '0';
        element.style.transition = `height ${duration}ms ease`;

        requestAnimationFrame(() => {
            element.style.height = height + 'px';
        });

        setTimeout(() => {
            element.style.height = '';
            element.style.overflow = '';
            element.style.transition = '';
        }, duration);
    }

    static slideUp(element, duration = 300) {
        element.style.height = element.scrollHeight + 'px';
        element.style.overflow = 'hidden';
        element.style.transition = `height ${duration}ms ease`;

        requestAnimationFrame(() => {
            element.style.height = '0';
        });

        setTimeout(() => {
            element.style.display = 'none';
            element.style.height = '';
            element.style.overflow = '';
            element.style.transition = '';
        }, duration);
    }

    static draggable(element, options = {}) {
        let isDragging = false;
        let startX, startY, initialX, initialY;
        const handle = options.handle ? element.querySelector(options.handle) : element;

        handle.style.cursor = options.cursor || 'grab';

        const onMouseDown = (e) => {
            if (options.onDragStart && options.onDragStart(e) === false) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialX = element.offsetLeft;
            initialY = element.offsetTop;
            handle.style.cursor = options.cursorDragging || 'grabbing';
            element.style.transition = 'none';
        };

        const onMouseMove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newX = initialX + dx;
            let newY = initialY + dy;

            if (options.bounds) {
                const bounds = typeof options.bounds === 'function' ? options.bounds() : options.bounds;
                newX = Math.max(bounds.x, Math.min(bounds.x + bounds.width - element.offsetWidth, newX));
                newY = Math.max(bounds.y, Math.min(bounds.y + bounds.height - element.offsetHeight, newY));
            }

            if (options.axis === 'x') newY = initialY;
            if (options.axis === 'y') newX = initialX;

            element.style.left = newX + 'px';
            element.style.top = newY + 'px';

            if (options.onDrag) {
                options.onDrag({ x: newX, y: newY, dx, dy });
            }
        };

        const onMouseUp = () => {
            if (!isDragging) return;
            isDragging = false;
            handle.style.cursor = options.cursor || 'grab';
            element.style.transition = '';

            if (options.onDragEnd) {
                options.onDragEnd({
                    x: element.offsetLeft,
                    y: element.offsetTop
                });
            }
        };

        handle.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        return () => {
            handle.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }

    static resizable(element, options = {}) {
        const handles = options.handles || ['se'];
        const minWidth = options.minWidth || 20;
        const minHeight = options.minHeight || 20;

        const cleanupFunctions = [];

        for (const handle of handles) {
            const handleEl = VexelDOM.create('div', {
                className: `vexel-resize-handle vexel-resize-${handle}`,
                style: {
                    position: 'absolute',
                    width: '10px',
                    height: '10px',
                    background: '#4A90D9',
                    border: '1px solid white',
                    zIndex: '10'
                }
            });

            switch (handle) {
                case 'se': handleEl.style.cssText += 'bottom:-5px;right:-5px;cursor:nwse-resize;'; break;
                case 'sw': handleEl.style.cssText += 'bottom:-5px;left:-5px;cursor:nesw-resize;'; break;
                case 'ne': handleEl.style.cssText += 'top:-5px;right:-5px;cursor:nesw-resize;'; break;
                case 'nw': handleEl.style.cssText += 'top:-5px;left:-5px;cursor:nwse-resize;'; break;
                case 'n': handleEl.style.cssText += 'top:-5px;left:50%;margin-left:-5px;cursor:ns-resize;'; break;
                case 's': handleEl.style.cssText += 'bottom:-5px;left:50%;margin-left:-5px;cursor:ns-resize;'; break;
                case 'e': handleEl.style.cssText += 'top:50%;right:-5px;margin-top:-5px;cursor:ew-resize;'; break;
                case 'w': handleEl.style.cssText += 'top:50%;left:-5px;margin-top:-5px;cursor:ew-resize;'; break;
            }

            element.appendChild(handleEl);
            element.style.position = 'relative';

            let isResizing = false;
            let startX, startY, startW, startH, startL, startT;

            const onMouseDown = (e) => {
                e.preventDefault();
                e.stopPropagation();
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                startW = element.offsetWidth;
                startH = element.offsetHeight;
                startL = element.offsetLeft;
                startT = element.offsetTop;
            };

            const onMouseMove = (e) => {
                if (!isResizing) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;

                let newW = startW;
                let newH = startH;
                let newL = startL;
                let newT = startT;

                if (handle.includes('e')) newW = Math.max(minWidth, startW + dx);
                if (handle.includes('w')) { newW = Math.max(minWidth, startW - dx); newL = startL + dx; }
                if (handle.includes('s')) newH = Math.max(minHeight, startH + dy);
                if (handle.includes('n')) { newH = Math.max(minHeight, startH - dy); newT = startT + dy; }

                element.style.width = newW + 'px';
                element.style.height = newH + 'px';
                element.style.left = newL + 'px';
                element.style.top = newT + 'px';

                if (options.onResize) {
                    options.onResize({ width: newW, height: newH, x: newL, y: newT });
                }
            };

            const onMouseUp = () => {
                if (!isResizing) return;
                isResizing = false;
                if (options.onResizeEnd) {
                    options.onResizeEnd({
                        width: element.offsetWidth,
                        height: element.offsetHeight,
                        x: element.offsetLeft,
                        y: element.offsetTop
                    });
                }
            };

            handleEl.addEventListener('mousedown', onMouseDown);
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);

            cleanupFunctions.push(() => {
                handleEl.removeEventListener('mousedown', onMouseDown);
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                handleEl.remove();
            });
        }

        return () => {
            for (const cleanup of cleanupFunctions) {
                cleanup();
            }
        };
    }
}

if (typeof window !== 'undefined') {
    window.VexelDOM = VexelDOM;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelDOM;
}
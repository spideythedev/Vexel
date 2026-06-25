// src/utils/color.js

class VexelColor {
    static hexToRgb(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return { r, g, b, a: 1 };
    }

    static rgbToHex(r, g, b) {
        const toHex = (c) => {
            const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    static rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return { h: h * 360, s: s * 100, l: l * 100 };
    }

    static hslToRgb(h, s, l) {
        h /= 360;
        s /= 100;
        l /= 100;
        let r, g, b;

        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    }

    static rgbToCmyk(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const k = 1 - Math.max(r, g, b);
        if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
        const c = Math.round(((1 - r - k) / (1 - k)) * 100);
        const m = Math.round(((1 - g - k) / (1 - k)) * 100);
        const y = Math.round(((1 - b - k) / (1 - k)) * 100);
        return { c, m, y, k: Math.round(k * 100) };
    }

    static cmykToRgb(c, m, y, k) {
        c /= 100;
        m /= 100;
        y /= 100;
        k /= 100;
        const r = Math.round(255 * (1 - c) * (1 - k));
        const g = Math.round(255 * (1 - m) * (1 - k));
        const b = Math.round(255 * (1 - y) * (1 - k));
        return { r, g, b };
    }

    static rgbToLab(r, g, b) {
        let x = r / 255;
        let y = g / 255;
        let z = b / 255;

        x = x > 0.04045 ? Math.pow((x + 0.055) / 1.055, 2.4) : x / 12.92;
        y = y > 0.04045 ? Math.pow((y + 0.055) / 1.055, 2.4) : y / 12.92;
        z = z > 0.04045 ? Math.pow((z + 0.055) / 1.055, 2.4) : z / 12.92;

        x *= 100;
        y *= 100;
        z *= 100;

        const xn = 95.047, yn = 100.000, zn = 108.883;
        let fx = x / xn, fy = y / yn, fz = z / zn;
        fx = fx > 0.008856 ? Math.cbrt(fx) : (903.3 * fx + 16) / 116;
        fy = fy > 0.008856 ? Math.cbrt(fy) : (903.3 * fy + 16) / 116;
        fz = fz > 0.008856 ? Math.cbrt(fz) : (903.3 * fz + 16) / 116;

        return {
            l: (116 * fy) - 16,
            a: 500 * (fx - fy),
            b: 200 * (fy - fz)
        };
    }

    static labToRgb(l, a, b) {
        let fy = (l + 16) / 116;
        let fx = a / 500 + fy;
        let fz = fy - b / 200;

        const xn = 95.047, yn = 100.000, zn = 108.883;
        let x = fx > 0.206897 ? Math.pow(fx, 3) : (fx - 16 / 116) / 7.787;
        let y = fy > 0.206897 ? Math.pow(fy, 3) : (fy - 16 / 116) / 7.787;
        let z = fz > 0.206897 ? Math.pow(fz, 3) : (fz - 16 / 116) / 7.787;

        x = x * xn / 100;
        y = y * yn / 100;
        z = z * zn / 100;

        let r = x > 0.0031308 ? 1.055 * Math.pow(x, 1 / 2.4) - 0.055 : 12.92 * x;
        let g = y > 0.0031308 ? 1.055 * Math.pow(y, 1 / 2.4) - 0.055 : 12.92 * y;
        let b2 = z > 0.0031308 ? 1.055 * Math.pow(z, 1 / 2.4) - 0.055 : 12.92 * z;

        return {
            r: Math.round(Math.max(0, Math.min(255, r * 255))),
            g: Math.round(Math.max(0, Math.min(255, g * 255))),
            b: Math.round(Math.max(0, Math.min(255, b2 * 255)))
        };
    }

    static parse(colorString) {
        if (!colorString || colorString === 'transparent') return null;

        colorString = colorString.trim();

        if (colorString.startsWith('#')) {
            return VexelColor.hexToRgb(colorString);
        }

        const rgba = colorString.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,?\s*([\d.]+)?\s*\)/);
        if (rgba) {
            return {
                r: parseInt(rgba[1]),
                g: parseInt(rgba[2]),
                b: parseInt(rgba[3]),
                a: rgba[4] ? parseFloat(rgba[4]) : 1
            };
        }

        const hsl = colorString.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*,?\s*([\d.]+)?\s*\)/);
        if (hsl) {
            const rgb = VexelColor.hslToRgb(
                parseFloat(hsl[1]),
                parseFloat(hsl[2]),
                parseFloat(hsl[3])
            );
            rgb.a = hsl[4] ? parseFloat(hsl[4]) : 1;
            return rgb;
        }

        const namedColors = {
            red: '#FF0000', blue: '#0000FF', green: '#008000',
            black: '#000000', white: '#FFFFFF', gray: '#808080',
            orange: '#FFA500', purple: '#800080', yellow: '#FFFF00',
            pink: '#FFC0CB', cyan: '#00FFFF', magenta: '#FF00FF',
            lime: '#00FF00', teal: '#008080', navy: '#000080',
            maroon: '#800000', olive: '#808000', silver: '#C0C0C0',
            coral: '#FF7F50', crimson: '#DC143C', gold: '#FFD700',
            indigo: '#4B0082', violet: '#8B00FF', turquoise: '#40E0D0',
            salmon: '#FA8072', chocolate: '#D2691E', tomato: '#FF6347',
            transparent: 'transparent'
        };

        const lower = colorString.toLowerCase();
        if (namedColors[lower]) {
            if (namedColors[lower] === 'transparent') return null;
            return VexelColor.hexToRgb(namedColors[lower]);
        }

        return null;
    }

    static format(color, format = 'hex') {
        const parsed = typeof color === 'string' ? VexelColor.parse(color) : color;
        if (!parsed) return '';

        const { r, g, b, a } = parsed;

        switch (format) {
            case 'hex': return VexelColor.rgbToHex(r, g, b);
            case 'rgb': return a < 1 ? `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})` : `rgb(${r}, ${g}, ${b})`;
            case 'hsl': {
                const hsl = VexelColor.rgbToHsl(r, g, b);
                return a < 1
                    ? `hsla(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%, ${a.toFixed(2)})`
                    : `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
            }
            case 'cmyk': {
                const cmyk = VexelColor.rgbToCmyk(r, g, b);
                return `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;
            }
            default: return VexelColor.rgbToHex(r, g, b);
        }
    }

    static mix(color1, color2, ratio = 0.5) {
        const c1 = typeof color1 === 'string' ? VexelColor.parse(color1) : color1;
        const c2 = typeof color2 === 'string' ? VexelColor.parse(color2) : color2;
        if (!c1 || !c2) return '#000000';

        const r = Math.round(c1.r + (c2.r - c1.r) * ratio);
        const g = Math.round(c1.g + (c2.g - c1.g) * ratio);
        const b = Math.round(c1.b + (c2.b - c1.b) * ratio);
        const a = (c1.a || 1) + ((c2.a || 1) - (c1.a || 1)) * ratio;

        return a < 1 ? `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})` : VexelColor.rgbToHex(r, g, b);
    }

    static lighten(color, amount = 10) {
        const parsed = typeof color === 'string' ? VexelColor.parse(color) : color;
        if (!parsed) return '#000000';

        const hsl = VexelColor.rgbToHsl(parsed.r, parsed.g, parsed.b);
        hsl.l = Math.min(100, hsl.l + amount);
        const rgb = VexelColor.hslToRgb(hsl.h, hsl.s, hsl.l);
        return VexelColor.rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    static darken(color, amount = 10) {
        return VexelColor.lighten(color, -amount);
    }

    static saturate(color, amount = 10) {
        const parsed = typeof color === 'string' ? VexelColor.parse(color) : color;
        if (!parsed) return '#000000';

        const hsl = VexelColor.rgbToHsl(parsed.r, parsed.g, parsed.b);
        hsl.s = Math.min(100, hsl.s + amount);
        const rgb = VexelColor.hslToRgb(hsl.h, hsl.s, hsl.l);
        return VexelColor.rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    static desaturate(color, amount = 10) {
        return VexelColor.saturate(color, -amount);
    }

    static rotate(color, degrees = 30) {
        const parsed = typeof color === 'string' ? VexelColor.parse(color) : color;
        if (!parsed) return '#000000';

        const hsl = VexelColor.rgbToHsl(parsed.r, parsed.g, parsed.b);
        hsl.h = (hsl.h + degrees) % 360;
        if (hsl.h < 0) hsl.h += 360;
        const rgb = VexelColor.hslToRgb(hsl.h, hsl.s, hsl.l);
        return VexelColor.rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    static complementary(color) {
        return VexelColor.rotate(color, 180);
    }

    static analogous(color, count = 3, step = 30) {
        const colors = [];
        const start = -((count - 1) * step) / 2;
        for (let i = 0; i < count; i++) {
            colors.push(VexelColor.rotate(color, start + i * step));
        }
        return colors;
    }

    static triadic(color) {
        return [
            color,
            VexelColor.rotate(color, 120),
            VexelColor.rotate(color, 240)
        ];
    }

    static tetradic(color) {
        return [
            color,
            VexelColor.rotate(color, 60),
            VexelColor.rotate(color, 180),
            VexelColor.rotate(color, 240)
        ];
    }

    static monochromatic(color, count = 5) {
        const colors = [];
        const parsed = typeof color === 'string' ? VexelColor.parse(color) : color;
        if (!parsed) return [];

        const hsl = VexelColor.rgbToHsl(parsed.r, parsed.g, parsed.b);
        const step = 100 / (count + 1);

        for (let i = 1; i <= count; i++) {
            const l = Math.max(0, Math.min(100, hsl.l - (count / 2 - i) * step));
            const rgb = VexelColor.hslToRgb(hsl.h, hsl.s, l);
            colors.push(VexelColor.rgbToHex(rgb.r, rgb.g, rgb.b));
        }

        return colors;
    }

    static gradient(stops, angle = 0) {
        const gradientStops = stops.map(stop => {
            const color = typeof stop.color === 'string'
                ? VexelColor.parse(stop.color)
                : stop.color;
            if (!color) return null;
            const { r, g, b, a = 1 } = color;
            return {
                offset: stop.offset,
                color: a < 1 ? `rgba(${r},${g},${b},${a})` : VexelColor.rgbToHex(r, g, b)
            };
        }).filter(Boolean);

        const rad = (angle * Math.PI) / 180;
        const x1 = 50 - Math.cos(rad) * 50;
        const y1 = 50 - Math.sin(rad) * 50;
        const x2 = 50 + Math.cos(rad) * 50;
        const y2 = 50 + Math.sin(rad) * 50;

        return `linear-gradient(${angle}deg, ${gradientStops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')})`;
    }

    static contrast(color, dark = '#000000', light = '#ffffff', threshold = 128) {
        const parsed = typeof color === 'string' ? VexelColor.parse(color) : color;
        if (!parsed) return dark;

        const luminance = (0.299 * parsed.r + 0.587 * parsed.g + 0.114 * parsed.b);
        return luminance > threshold ? dark : light;
    }

    static luminance(color) {
        const parsed = typeof color === 'string' ? VexelColor.parse(color) : color;
        if (!parsed) return 0;

        const rsrgb = parsed.r / 255;
        const gsrgb = parsed.g / 255;
        const bsrgb = parsed.b / 255;

        const r = rsrgb <= 0.03928 ? rsrgb / 12.92 : Math.pow((rsrgb + 0.055) / 1.055, 2.4);
        const g = gsrgb <= 0.03928 ? gsrgb / 12.92 : Math.pow((gsrgb + 0.055) / 1.055, 2.4);
        const b = bsrgb <= 0.03928 ? bsrgb / 12.92 : Math.pow((bsrgb + 0.055) / 1.055, 2.4);

        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    static contrastRatio(color1, color2) {
        const lum1 = VexelColor.luminance(color1);
        const lum2 = VexelColor.luminance(color2);
        const lighter = Math.max(lum1, lum2);
        const darker = Math.min(lum1, lum2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    static isAccessible(color1, color2, level = 'AA') {
        const ratio = VexelColor.contrastRatio(color1, color2);
        switch (level) {
            case 'AA': return ratio >= 4.5;
            case 'AAA': return ratio >= 7;
            case 'large-AA': return ratio >= 3;
            case 'large-AAA': return ratio >= 4.5;
            default: return ratio >= 4.5;
        }
    }

    static isValid(colorString) {
        return VexelColor.parse(colorString) !== null;
    }
}

if (typeof window !== 'undefined') {
    window.VexelColor = VexelColor;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VexelColor;
}
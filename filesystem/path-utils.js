/**
 * Path utilities — POSIX-style paths inside the VFS.
 *
 * The VFS uses absolute paths like "/Documents/notes.md" or "/".
 * Path normalization and manipulation.
 */

const SEP = '/';

export function normalize(path) {
    if (!path || path === '') return '/';
    // ensure leading /
    let p = path.startsWith('/') ? path : '/' + path;
    // collapse . and ..
    const parts = [];
    for (const seg of p.split('/')) {
        if (seg === '' || seg === '.') continue;
        if (seg === '..') parts.pop();
        else parts.push(seg);
    }
    return SEP + parts.join(SEP);
}

export function join(...parts) {
    const flat = parts.filter(Boolean).join('/');
    return normalize(flat);
}

export function dirname(path) {
    path = normalize(path);
    if (path === '/') return '/';
    const i = path.lastIndexOf('/');
    if (i <= 0) return '/';
    return path.slice(0, i);
}

export function basename(path) {
    path = normalize(path);
    if (path === '/') return '';
    const i = path.lastIndexOf('/');
    return path.slice(i + 1);
}

export function extname(path) {
    const base = basename(path);
    const i = base.lastIndexOf('.');
    if (i <= 0) return '';
    return base.slice(i);
}

export function split(path) {
    path = normalize(path);
    const dir = dirname(path);
    const base = basename(path);
    const ext = extname(base);
    const name = ext ? base.slice(0, -ext.length) : base;
    return { dir, base, name, ext };
}

/**
 * Split a path into segments.
 */
export function segments(path) {
    path = normalize(path);
    if (path === '/') return [];
    return path.split('/').filter(Boolean);
}

/**
 * MIME type detection from extension.
 */
const MIME = {
    '.html': 'text/html', '.htm': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript', '.mjs': 'text/javascript', '.ts': 'text/typescript',
    '.json': 'application/json', '.xml': 'application/xml',
    '.txt': 'text/plain', '.md': 'text/markdown', '.markdown': 'text/markdown',
    '.csv': 'text/csv',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.m4a': 'audio/mp4',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg', '.mov': 'video/quicktime',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip', '.tar': 'application/x-tar', '.gz': 'application/gzip',
    '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

export function mimeType(name) {
    const ext = extname(name).toLowerCase();
    return MIME[ext] || 'application/octet-stream';
}

/**
 * File category for icon lookup.
 */
export function category(name) {
    const ext = extname(name).toLowerCase();
    if (!ext) return 'file';
    if (['.png','.jpg','.jpeg','.gif','.webp','.svg','.bmp'].includes(ext)) return 'image';
    if (['.mp3','.wav','.ogg','.flac','.m4a'].includes(ext)) return 'audio';
    if (['.mp4','.webm','.ogv','.mov'].includes(ext)) return 'video';
    if (['.txt','.md','.markdown','.log'].includes(ext)) return 'text';
    if (['.js','.ts','.json','.css','.html','.xml','.py','.java','.c','.cpp','.go','.rs'].includes(ext)) return 'code';
    if (['.zip','.tar','.gz','.rar','.7z'].includes(ext)) return 'archive';
    return 'file';
}

/**
 * Validate a path/name — prevent invalid characters and path traversal.
 */
export function isValidName(name) {
    if (!name || typeof name !== 'string') return false;
    if (name.length === 0 || name.length > 255) return false;
    if (name === '.' || name === '..') return false;
    if (/[\x00-\x1f]/.test(name)) return false;
    if (/[\\/]/.test(name)) return false;
    return true;
}

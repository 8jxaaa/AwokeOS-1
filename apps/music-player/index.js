/**
 * Music Player — play audio files from the VFS.
 */

import { h } from '../../utils/dom.js';
import { icon } from '../../assets/icons.js';
import { getVFS } from '../../filesystem/vfs.js';
import { bus, EVENTS } from '../../core/event-bus.js';
import { appData } from '../../services/persistence-service.js';

export default {
    id: 'music-player',
    name: 'Music Player',
    icon: 'music',
    category: 'Media',
    description: 'Play your music',
    defaultSize: { width: 800, height: 540 },
    minSize: { width: 360, height: 400 },

    async render({ args }) {
        const root = h('div', { class: 'app-root mp-root' });

        let playlist = [];
        let currentIdx = -1;
        let currentPath = args?.path || null;
        let audio = new Audio();
        let isPlaying = false;

        // Album art
        const albumArt = h('div', { class: 'mp-art', html: icon('music') });
        const titleEl = h('div', { class: 'mp-title' }, '—');
        const artistEl = h('div', { class: 'mp-artist' }, 'No track loaded');

        const progressBar = h('div', { class: 'mp-progress-bar' });
        const progressFill = h('div', { class: 'mp-progress-fill' });
        progressBar.appendChild(progressFill);
        const currentTimeEl = h('div', { class: 'mp-time' }, '0:00');
        const durationEl = h('div', { class: 'mp-time' }, '0:00');

        const playBtn = h('button', { class: 'mp-play', html: icon('play'), onClick: togglePlay });
        const prevBtn = h('button', { class: 'mp-ctrl', html: icon('arrow-left'), onClick: prev });
        const nextBtn = h('button', { class: 'mp-ctrl', html: icon('arrow-right'), onClick: next });
        const shuffleBtn = h('button', { class: 'mp-ctrl', html: icon('refresh'), onClick: shuffle });
        const repeatBtn = h('button', { class: 'mp-ctrl', html: icon('refresh'), onClick: () => {
            audio.loop = !audio.loop;
            repeatBtn.classList.toggle('active', audio.loop);
        }});

        const volumeSlider = h('input', { type: 'range', min: '0', max: '100', value: '70', class: 'mp-volume', onInput: (e) => {
            audio.volume = e.target.value / 100;
        }});
        audio.volume = 0.7;

        const openBtn = h('button', { class: 'btn btn-sm', onClick: openFolder }, 'Open folder');
        const playlistEl = h('div', { class: 'mp-playlist scroll-y' });

        const controls = h('div', { class: 'mp-controls' }, [
            h('div', { class: 'mp-info' }, [albumArt, h('div', { class: 'flex-1' }, [titleEl, artistEl])]),
            h('div', { class: 'mp-progress-row' }, [
                currentTimeEl, progressBar, durationEl
            ]),
            h('div', { class: 'mp-buttons' }, [shuffleBtn, prevBtn, playBtn, nextBtn, repeatBtn]),
            h('div', { class: 'mp-volume-row' }, [
                h('span', { html: icon('volume-2'), style: { width: '20px', height: '20px' } }),
                volumeSlider,
                h('button', { class: 'btn btn-sm', onClick: openFolder, html: icon('folder-open') })
            ])
        ]);

        const root2 = h('div', { class: 'mp-layout' }, [
            h('div', { class: 'mp-left' }, [controls, playlistEl])
        ]);
        root.appendChild(root2);

        // Progress click to seek
        progressBar.addEventListener('click', (e) => {
            if (!audio.duration) return;
            const rect = progressBar.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            audio.currentTime = pct * audio.duration;
        });

        audio.addEventListener('loadedmetadata', () => {
            durationEl.textContent = fmt(audio.duration);
        });
        audio.addEventListener('timeupdate', () => {
            const pct = (audio.currentTime / audio.duration) * 100 || 0;
            progressFill.style.width = pct + '%';
            currentTimeEl.textContent = fmt(audio.currentTime);
        });
        audio.addEventListener('ended', () => next());
        audio.addEventListener('play', () => {
            isPlaying = true;
            playBtn.innerHTML = icon('pause');
        });
        audio.addEventListener('pause', () => {
            isPlaying = false;
            playBtn.innerHTML = icon('play');
        });

        function fmt(s) {
            if (!isFinite(s)) return '0:00';
            const m = Math.floor(s / 60);
            const sec = Math.floor(s % 60);
            return `${m}:${sec.toString().padStart(2, '0')}`;
        }

        function togglePlay() {
            if (currentIdx < 0 && playlist.length > 0) playIdx(0);
            else if (audio.paused) audio.play();
            else audio.pause();
        }

        function prev() {
            if (currentIdx > 0) playIdx(currentIdx - 1);
            else if (playlist.length > 0) playIdx(playlist.length - 1);
        }
        function next() {
            if (currentIdx < playlist.length - 1) playIdx(currentIdx + 1);
            else playIdx(0);
        }
        function shuffle() {
            for (let i = playlist.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [playlist[i], playlist[j]] = [playlist[j], playlist[i]];
            }
            renderPlaylist();
        }

        async function playIdx(i) {
            if (i < 0 || i >= playlist.length) return;
            currentIdx = i;
            const item = playlist[i];
            try {
                const vfs = getVFS();
                const entry = await vfs.readFile(item.path);
                const blob = entry.content instanceof Blob ? entry.content : new Blob([entry.content], { type: entry.mimeType });
                const url = URL.createObjectURL(blob);
                if (audio.src) URL.revokeObjectURL(audio.src);
                audio.src = url;
                titleEl.textContent = item.name;
                artistEl.textContent = item.path;
                renderPlaylist();
                await audio.play();
            } catch (err) {
                bus.emit(EVENTS.TOAST, { type: 'error', message: 'Play failed: ' + err.message });
            }
        }

        function renderPlaylist() {
            playlistEl.innerHTML = '';
            playlist.forEach((item, i) => {
                const el = h('div', {
                    class: 'mp-track ' + (i === currentIdx ? 'active' : ''),
                    onDblclick: () => playIdx(i)
                }, [
                    h('span', { class: 'mp-track-num', html: i === currentIdx && isPlaying ? icon('music-note') : (i + 1) }),
                    h('div', { class: 'flex-1' }, [
                        h('div', { class: 'mp-track-name' }, item.name.replace(/\.[^/.]+$/, '')),
                        h('div', { class: 'mp-track-path' }, item.path)
                    ])
                ]);
                playlistEl.appendChild(el);
            });
        }

        async function openFolder() {
            bus.emit(EVENTS.APP_OPENED, { id: 'file-explorer', args: { pickFolder: true, onPick: async (path) => {
                await loadFolder(path);
            }}});
        }

        async function loadFolder(path) {
            try {
                const vfs = getVFS();
                const entries = await vfs.list(path);
                playlist = entries
                    .filter(e => e.type === 'file' && /\.(mp3|wav|ogg|m4a|flac)$/i.test(e.name))
                    .map(e => ({ path: e.path, name: e.name }));
                if (currentPath && playlist.find(p => p.path === currentPath)) {
                    currentIdx = playlist.findIndex(p => p.path === currentPath);
                } else {
                    currentIdx = playlist.length > 0 ? 0 : -1;
                }
                renderPlaylist();
                if (currentIdx >= 0) playIdx(currentIdx);
            } catch (err) {
                bus.emit(EVENTS.TOAST, { type: 'error', message: 'Load failed: ' + err.message });
            }
        }

        // Initial load from arg
        if (currentPath) {
            const dir = currentPath.split('/').slice(0, -1).join('/') || '/';
            await loadFolder(dir);
            currentIdx = playlist.findIndex(p => p.path === currentPath);
            if (currentIdx >= 0) await playIdx(currentIdx);
        } else {
            // Try Music folder by default
            await loadFolder('/Music');
        }

        // Keyboard
        const kbd = (e) => {
            if (!root.isConnected) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === ' ') { e.preventDefault(); togglePlay(); }
            else if (e.key === 'ArrowLeft') prev();
            else if (e.key === 'ArrowRight') next();
        };
        document.addEventListener('keydown', kbd);
        const observer = new MutationObserver(() => {
            if (!document.body.contains(root)) {
                audio.pause();
                document.removeEventListener('keydown', kbd);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        return root;
    }
};

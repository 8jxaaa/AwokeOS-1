/**
 * Video Player — play video files from the VFS.
 */

import { h } from '../../utils/dom.js';
import { icon } from '../../assets/icons.js';
import { getVFS } from '../../filesystem/vfs.js';
import { bus, EVENTS } from '../../core/event-bus.js';

export default {
    id: 'video-player',
    name: 'Video Player',
    icon: 'video',
    category: 'Media',
    description: 'Play video files',
    defaultSize: { width: 900, height: 600 },
    minSize: { width: 400, height: 300 },

    async render({ args }) {
        const root = h('div', { class: 'app-root vp-root' });
        let currentPath = args?.path || null;

        const video = h('video', { class: 'vp-video', controls: false });
        const playBtn = h('button', { class: 'vp-play', html: icon('play') });
        const progressBar = h('div', { class: 'vp-progress-bar' });
        const progressFill = h('div', { class: 'vp-progress-fill' });
        progressBar.appendChild(progressFill);
        const currentTimeEl = h('div', { class: 'vp-time' }, '0:00');
        const durationEl = h('div', { class: 'vp-time' }, '0:00');
        const volumeSlider = h('input', { type: 'range', min: '0', max: '100', value: '100', class: 'vp-volume', onInput: (e) => video.volume = e.target.value / 100 });
        const fullscreenBtn = h('button', { class: 'vp-ctrl', html: icon('maximize'), onClick: () => toggleFullscreen() });
        const openBtn = h('button', { class: 'vp-ctrl', html: icon('folder-open'), onClick: openFile });

        const controls = h('div', { class: 'vp-controls' }, [
            h('div', { class: 'vp-buttons' }, [playBtn]),
            currentTimeEl,
            progressBar,
            durationEl,
            h('span', { html: icon('volume-2') }),
            volumeSlider,
            fullscreenBtn,
            openBtn
        ]);

        const placeholder = h('div', { class: 'vp-placeholder' }, [
            h('div', { html: icon('video'), style: { width: '64px', height: '64px', opacity: '0.4' } }),
            h('div', {}, 'Open a video to play'),
            h('button', { class: 'btn btn-primary mt-2', onClick: openFile }, 'Open video')
        ]);

        const videoContainer = h('div', { class: 'vp-container' }, [video, controls, placeholder]);

        root.appendChild(videoContainer);

        function fmt(s) {
            if (!isFinite(s)) return '0:00';
            const m = Math.floor(s / 60);
            const sec = Math.floor(s % 60);
            return `${m}:${sec.toString().padStart(2, '0')}`;
        }

        function togglePlay() {
            if (video.paused) video.play();
            else video.pause();
        }
        function toggleFullscreen() {
            if (document.fullscreenElement) document.exitFullscreen();
            else videoContainer.requestFullscreen?.();
        }

        video.addEventListener('play', () => playBtn.innerHTML = icon('pause'));
        video.addEventListener('pause', () => playBtn.innerHTML = icon('play'));
        video.addEventListener('loadedmetadata', () => {
            durationEl.textContent = fmt(video.duration);
            placeholder.style.display = 'none';
        });
        video.addEventListener('timeupdate', () => {
            const pct = (video.currentTime / video.duration) * 100 || 0;
            progressFill.style.width = pct + '%';
            currentTimeEl.textContent = fmt(video.currentTime);
        });
        video.addEventListener('ended', () => playBtn.innerHTML = icon('play'));

        playBtn.addEventListener('click', togglePlay);
        video.addEventListener('click', togglePlay);

        progressBar.addEventListener('click', (e) => {
            if (!video.duration) return;
            const rect = progressBar.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            video.currentTime = pct * video.duration;
        });

        async function loadFile(path) {
            try {
                const vfs = getVFS();
                const entry = await vfs.readFile(path);
                const blob = entry.content instanceof Blob ? entry.content : new Blob([entry.content], { type: entry.mimeType });
                const url = URL.createObjectURL(blob);
                if (video.src) video.src = '';
                video.src = url;
                currentPath = path;
                await video.play().catch(() => {});
            } catch (err) {
                bus.emit(EVENTS.TOAST, { type: 'error', message: 'Failed: ' + err.message });
            }
        }

        function openFile() {
            bus.emit(EVENTS.APP_OPENED, { id: 'file-explorer', args: { pickFile: true, filter: 'video', onPick: loadFile }});
        }

        const kbd = (e) => {
            if (!root.isConnected) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === ' ') { e.preventDefault(); togglePlay(); }
            else if (e.key === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 5);
            else if (e.key === 'ArrowRight') video.currentTime = Math.min(video.duration, video.currentTime + 5);
            else if (e.key === 'f') toggleFullscreen();
            else if (e.key === 'm') video.muted = !video.muted;
        };
        document.addEventListener('keydown', kbd);

        const observer = new MutationObserver(() => {
            if (!document.body.contains(root)) {
                video.pause();
                document.removeEventListener('keydown', kbd);
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        if (currentPath) await loadFile(currentPath);

        return root;
    }
};

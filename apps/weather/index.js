/**
 * Weather — uses Open-Meteo (free, no API key) for geolocation-based weather.
 * Falls back to sample data if geolocation is denied.
 */

import { h } from '../../utils/dom.js';
import { icon } from '../../assets/icons.js';
import { bus, EVENTS } from '../../core/event-bus.js';

const WMO_CODES = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog',
    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
    80: 'Rain showers', 81: 'Heavy rain showers', 82: 'Violent rain showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail'
};

const WMO_ICONS = {
    0: 'weather-clear', 1: 'weather-partly-cloudy', 2: 'weather-partly-cloudy', 3: 'weather-cloudy',
    45: 'weather-fog', 48: 'weather-fog',
    51: 'weather-drizzle', 53: 'weather-drizzle', 55: 'weather-drizzle',
    61: 'weather-rain', 63: 'weather-rain', 65: 'weather-rain',
    71: 'weather-snow', 73: 'weather-snow', 75: 'weather-heavy-snow',
    80: 'weather-showers', 81: 'weather-showers', 82: 'weather-thunderstorm',
    95: 'weather-thunderstorm', 96: 'weather-thunderstorm', 99: 'weather-thunderstorm'
};

export default {
    id: 'weather',
    name: 'Weather',
    icon: 'weather',
    category: 'Utilities',
    description: 'Local weather conditions',
    defaultSize: { width: 600, height: 540 },
    minSize: { width: 360, height: 400 },

    async render() {
        const root = h('div', { class: 'app-root wx-root' });
        const content = h('div', { class: 'wx-content' });
        root.appendChild(content);

        // Show loading
        content.appendChild(h('div', { class: 'empty-state' }, [
            h('div', { class: 'spinner' }),
            h('div', { class: 'mt-2' }, 'Loading weather…')
        ]));

        async function load() {
            try {
                let lat = null, lon = null, city = 'Your location';
                try {
                    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
                    lat = pos.coords.latitude;
                    lon = pos.coords.longitude;
                } catch {
                    // Default: San Francisco
                    lat = 37.7749;
                    lon = -122.4194;
                    city = 'San Francisco';
                }
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`;
                const res = await fetch(url);
                const data = await res.json();
                content.innerHTML = '';
                content.appendChild(renderWeather(data, city));
            } catch (err) {
                content.innerHTML = '';
                content.appendChild(h('div', { class: 'empty-state' }, [
                    h('div', { html: icon('weather') }),
                    h('div', {}, 'Could not load weather'),
                    h('div', { class: 'text-sm' }, err.message)
                ]));
            }
        }

        function renderWeather(data, city) {
            const c = data.current;
            const d = data.daily;
            const cond = WMO_CODES[c.weather_code] || 'Unknown';
            const iconKey = WMO_ICONS[c.weather_code] || 'weather-thermometer';
            return h('div', { class: 'wx-layout' }, [
                h('div', { class: 'wx-current' }, [
                    h('div', { class: 'wx-emoji', html: icon(iconKey) }),
                    h('div', { class: 'wx-temp' }, Math.round(c.temperature_2m) + '°'),
                    h('div', { class: 'wx-cond' }, cond),
                    h('div', { class: 'wx-loc' }, city)
                ]),
                h('div', { class: 'wx-details' }, [
                    h('div', { class: 'wx-detail' }, [h('span', {}, 'Humidity'), h('span', {}, c.relative_humidity_2m + '%')]),
                    h('div', { class: 'wx-detail' }, [h('span', {}, 'Wind'), h('span', {}, Math.round(c.wind_speed_10m) + ' km/h')])
                ]),
                h('div', { class: 'wx-forecast' }, [
                    h('div', { class: 'wx-forecast-title' }, '7-day forecast'),
                    h('div', { class: 'wx-forecast-grid' },
                        d.time.map((t, i) => h('div', { class: 'wx-forecast-day' }, [
                            h('div', { class: 'wx-forecast-name' }, new Date(t).toLocaleDateString(undefined, { weekday: 'short' })),
                            h('div', { class: 'wx-forecast-emoji', html: icon(WMO_ICONS[d.weather_code[i]] || 'weather-thermometer') }),
                            h('div', { class: 'wx-forecast-temp' }, `${Math.round(d.temperature_2m_max[i])}° / ${Math.round(d.temperature_2m_min[i])}°`)
                        ]))
                    )
                ])
            ]);
        }

        load();
        return root;
    }
};

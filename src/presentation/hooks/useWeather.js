import { useEffect, useState } from 'react';
import { CHURCH } from '../church.config.js';

const { lat: KVBC_LAT, lon: KVBC_LON } = CHURCH.coords;
const REFRESH_MS = 15 * 60 * 1000;

function getWeatherType(code) {
  if (code === 0 || code === 1) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code <= 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return 'snow';
  if (code >= 95) return 'thunder';
  return 'clear';
}

/**
 * Live weather for the ambient scene. Fails silently to 'clear' —
 * the show must never depend on the network. Refetches on a 15-minute
 * interval and whenever the page becomes visible again (projector
 * machines sleep).
 */
export function useWeather() {
  const [weather, setWeather] = useState('clear');

  useEffect(() => {
    const controller = new AbortController();

    const fetchWeather = async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${KVBC_LAT}&longitude=${KVBC_LON}&current=weather_code`,
          { signal: controller.signal },
        );
        const data = await res.json();
        if (data.current?.weather_code !== undefined) {
          setWeather(getWeatherType(data.current.weather_code));
        }
      } catch {
        // silently fail — default 'clear' is acceptable
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchWeather();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return weather;
}

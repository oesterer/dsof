# DSOF Mobile

iOS-first, orientation-aware companion to Deep Sky Object Finder.

The first vertical slice includes live true-north heading and phone elevation, offline projection of the existing bright-star and constellation catalogs, tap-to-identify, a rear-camera aiming overlay, and compass-calibration feedback.

## Sky controls

- Pinch or use `+` / `−` to zoom from 1× to 6×.
- Drag the sky to explore manually. This pauses automatic orientation tracking.
- Drag below the gold horizon to inspect objects currently beneath the observer.
- Tap **Resume live** to align the view with the phone again.
- Use the clock control to preview the continuously advancing sky up to 72 hours in the future, then return to **Now**.
- Tap stars, planets, the Sun, or Messier objects to identify them.
- Search from the top-right menu to center the manual view on a star, constellation, planet, Moon, Sun, or Messier object.
- Open the top-right menu to toggle stars, planets, Moon and Sun, Messier deep-sky objects, constellation lines and names, the altitude/azimuth grid, horizon, ecliptic, aiming reticle, and camera view.

## Run on an iPhone

Sensor and camera behavior must be tested on a physical phone:

```bash
npm install
npx expo run:ios --device
```

The iOS Simulator can validate layout, but it does not provide useful real-world compass/camera data.

## Architecture

`src/astro.ts` contains platform-independent astronomy and projection math. `src/useSkySensors.ts` is the native sensor boundary. The app bundles a copy of the web bright-star catalog in `src/data/brightStars.ts`; refresh it when the source catalog changes.

Camera mode is an aiming overlay, not photographic plate solving. It identifies catalog objects from time, location, and sensor attitude. Image-based recognition or ARKit tracking is a later phase and can be added through an Expo development build with a custom native module.

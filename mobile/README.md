# DSOF Mobile

iOS-first, orientation-aware companion to Deep Sky Object Finder.

The first vertical slice includes live true-north heading and phone elevation, offline projection of the existing bright-star and constellation catalogs, tap-to-identify, a rear-camera aiming overlay, and compass-calibration feedback.

## Sky controls

- Pinch or use `+` / `−` to zoom from 1× to 6×.
- Drag the sky to explore manually. This pauses automatic orientation tracking.
- Tap **Resume live** to align the view with the phone again.
- Open the top-right menu to toggle stars, constellation lines, constellation names, the aiming reticle, and camera view.

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

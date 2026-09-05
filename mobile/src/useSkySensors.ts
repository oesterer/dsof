import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import * as ScreenOrientation from 'expo-screen-orientation';
import { DeviceMotion } from 'expo-sensors';

export type SensorState = { heading: number; elevation: number; latitude: number | null; longitude: number | null; headingAccuracy: number; ready: boolean; error: string | null };

const normalizeHeading = (value: number) => ((value % 360) + 360) % 360;
const headingDistance = (first: number, second: number) => Math.abs(((first - second + 540) % 360) - 180);
const signedHeadingDelta = (target: number, current: number) => ((target - current + 540) % 360) - 180;
const ELEVATION_DEADBAND = 0.18;

// Expo reports motion axes in the device's portrait coordinate system, while
// `orientation` tells us how that coordinate system is rotated relative to the
// screen. Convert readings so "top" always means the visible top of the map.
function screenOrientationDegrees(value: number | undefined) {
  return value === 90 || value === -90 || value === 180 ? value : 0;
}

function interfaceOrientationDegrees(value: ScreenOrientation.Orientation) {
  switch (value) {
    case ScreenOrientation.Orientation.PORTRAIT_DOWN: return 180;
    // UIInterfaceOrientation uses the direction of the interface rotation;
    // UIDeviceOrientation (and Expo DeviceMotion) names landscape directions
    // from the physical device, so the two landscape names are reversed.
    case ScreenOrientation.Orientation.LANDSCAPE_LEFT: return 90;
    case ScreenOrientation.Orientation.LANDSCAPE_RIGHT: return -90;
    default: return 0;
  }
}

export function elevationFromGravity(gravity: { x: number; y: number; z: number }, orientation = 0) {
  const radians = screenOrientationDegrees(orientation) * Math.PI / 180;
  const screenUpGravity = gravity.y * Math.cos(radians) - gravity.x * Math.sin(radians);
  return Math.atan2(gravity.z, -screenUpGravity) * 180 / Math.PI;
}

export function useSkySensors(): SensorState {
  const [state, setState] = useState<SensorState>({ heading: 0, elevation: 25, latitude: null, longitude: null, headingAccuracy: 0, ready: false, error: null });
  const lastHeading = useRef<number | null>(null);
  const currentElevation = useRef(25);
  const filteredElevation = useRef<number | null>(null);
  const publishedElevation = useRef(25);
  const screenOrientation = useRef(0);

  useEffect(() => {
    let active = true;
    let headingSubscription: Location.LocationSubscription | undefined;
    let motionSubscription: { remove(): void } | undefined;
    let orientationSubscription: { remove(): void } | undefined;
    async function start() {
      try {
        const locationPermission = await Location.requestForegroundPermissionsAsync();
        const motionPermission = await DeviceMotion.requestPermissionsAsync();
        if (!locationPermission.granted || !motionPermission.granted) throw new Error('Location and motion access are required to aim the sky map.');
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!active) return;
        setState((previous) => ({ ...previous, latitude: location.coords.latitude, longitude: location.coords.longitude }));
        const initialOrientation = await ScreenOrientation.getOrientationAsync();
        screenOrientation.current = interfaceOrientationDegrees(initialOrientation);
        orientationSubscription = ScreenOrientation.addOrientationChangeListener((event) => {
          const nextOrientation = interfaceOrientationDegrees(event.orientationInfo.orientation);
          if (nextOrientation === screenOrientation.current) return;
          screenOrientation.current = nextOrientation;
          lastHeading.current = null;
          filteredElevation.current = null;
        });
        headingSubscription = await Location.watchHeadingAsync((measurement) => {
          const portraitHeading = measurement.trueHeading >= 0 ? measurement.trueHeading : measurement.magHeading;
          const rawHeading = normalizeHeading(portraitHeading - screenOrientation.current);
          let heading = rawHeading;
          if (lastHeading.current !== null && currentElevation.current >= 35) {
            // Core Location can report the opposite compass solution when a
            // portrait phone is steeply tilted. Select the solution continuous
            // with the preceding reading. At zenith azimuth is undefined, so
            // retain the last useful heading until the phone tilts back down.
            if (currentElevation.current >= 88) {
              heading = lastHeading.current;
            } else {
              const oppositeHeading = normalizeHeading(rawHeading + 180);
              heading = headingDistance(oppositeHeading, lastHeading.current) < headingDistance(rawHeading, lastHeading.current)
                ? oppositeHeading
                : rawHeading;
            }
          }
          const previousHeading = lastHeading.current;
          if (previousHeading !== null) {
            const delta = signedHeadingDelta(heading, previousHeading);
            // Low-pass small compass jitter, but catch up quickly during an
            // intentional turn. Using the signed shortest arc keeps 359° → 0°
            // smooth instead of sending the map around the long way.
            const alpha = Math.abs(delta) > 30 ? 0.65 : Math.abs(delta) > 10 ? 0.42 : Math.abs(delta) > 3 ? 0.26 : 0.14;
            heading = normalizeHeading(previousHeading + delta * alpha);
          }
          lastHeading.current = heading;
          setState((previous) => ({ ...previous, heading, headingAccuracy: measurement.accuracy, ready: previous.latitude !== null }));
        });
        DeviceMotion.setUpdateInterval(40);
        motionSubscription = DeviceMotion.addListener((measurement) => {
          // DeviceMotion.orientation has proven unreliable on iPad in
          // landscape; use the actual interface orientation captured above.
          const orientation = screenOrientation.current;
          let elevation: number | null = null;
          if (measurement.accelerationIncludingGravity) {
            // Unlike Euler beta, the gravity vector does not fold when iOS
            // changes its angle representation near face-up. In portrait, this
            // is the directed angle from upright (-Y) toward the screen normal
            // (-Z). Angles beyond zenith remain > 90 and are clamped below.
            elevation = elevationFromGravity(measurement.accelerationIncludingGravity, orientation);
          } else if (measurement.rotation) {
            elevation = 90 - measurement.rotation.beta * 180 / Math.PI;
          }
          if (elevation === null || !Number.isFinite(elevation)) return;
          const rawElevation = Math.max(-10, Math.min(90, elevation));
          const previousFiltered = filteredElevation.current;
          if (previousFiltered === null) {
            filteredElevation.current = rawElevation;
          } else {
            const sensorDelta = rawElevation - previousFiltered;
            // Suppress gravity-sensor jitter while stationary, but increase
            // responsiveness as soon as the phone is deliberately tilted.
            const alpha = Math.abs(sensorDelta) > 6 ? 0.55 : Math.abs(sensorDelta) > 2 ? 0.3 : 0.12;
            filteredElevation.current = previousFiltered + sensorDelta * alpha;
          }
          const smoothedElevation = filteredElevation.current;
          currentElevation.current = smoothedElevation;
          if (Math.abs(smoothedElevation - publishedElevation.current) < ELEVATION_DEADBAND) return;
          publishedElevation.current = smoothedElevation;
          setState((previous) => ({ ...previous, elevation: smoothedElevation }));
        });
      } catch (error) {
        if (active) setState((previous) => ({ ...previous, error: error instanceof Error ? error.message : 'Unable to start sky sensors.' }));
      }
    }
    start();
    return () => { active = false; headingSubscription?.remove(); motionSubscription?.remove(); orientationSubscription?.remove(); };
  }, []);
  return state;
}

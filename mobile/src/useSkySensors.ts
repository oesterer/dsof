import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';

export type SensorState = { heading: number; elevation: number; latitude: number | null; longitude: number | null; headingAccuracy: number; ready: boolean; error: string | null };

const normalizeHeading = (value: number) => ((value % 360) + 360) % 360;
const headingDistance = (first: number, second: number) => Math.abs(((first - second + 540) % 360) - 180);
const ELEVATION_DEADBAND = 0.18;

export function useSkySensors(): SensorState {
  const [state, setState] = useState<SensorState>({ heading: 0, elevation: 25, latitude: null, longitude: null, headingAccuracy: 0, ready: false, error: null });
  const lastHeading = useRef<number | null>(null);
  const currentElevation = useRef(25);
  const filteredElevation = useRef<number | null>(null);
  const publishedElevation = useRef(25);

  useEffect(() => {
    let active = true;
    let headingSubscription: Location.LocationSubscription | undefined;
    let motionSubscription: { remove(): void } | undefined;
    async function start() {
      try {
        const locationPermission = await Location.requestForegroundPermissionsAsync();
        const motionPermission = await DeviceMotion.requestPermissionsAsync();
        if (!locationPermission.granted || !motionPermission.granted) throw new Error('Location and motion access are required to aim the sky map.');
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!active) return;
        setState((previous) => ({ ...previous, latitude: location.coords.latitude, longitude: location.coords.longitude }));
        headingSubscription = await Location.watchHeadingAsync((measurement) => {
          const rawHeading = normalizeHeading(measurement.trueHeading >= 0 ? measurement.trueHeading : measurement.magHeading);
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
          lastHeading.current = heading;
          setState((previous) => ({ ...previous, heading, headingAccuracy: measurement.accuracy, ready: previous.latitude !== null }));
        });
        DeviceMotion.setUpdateInterval(80);
        motionSubscription = DeviceMotion.addListener((measurement) => {
          let elevation: number | null = null;
          if (measurement.accelerationIncludingGravity) {
            // Unlike Euler beta, the gravity vector does not fold when iOS
            // changes its angle representation near face-up. In portrait, this
            // is the directed angle from upright (-Y) toward the screen normal
            // (-Z). Angles beyond zenith remain > 90 and are clamped below.
            const gravity = measurement.accelerationIncludingGravity;
            elevation = Math.atan2(gravity.z, -gravity.y) * 180 / Math.PI;
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
    return () => { active = false; headingSubscription?.remove(); motionSubscription?.remove(); };
  }, []);
  return state;
}

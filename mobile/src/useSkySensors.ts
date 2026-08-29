import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';

export type SensorState = { heading: number; elevation: number; latitude: number | null; longitude: number | null; headingAccuracy: number; ready: boolean; error: string | null };

export function useSkySensors(): SensorState {
  const [state, setState] = useState<SensorState>({ heading: 0, elevation: 25, latitude: null, longitude: null, headingAccuracy: 0, ready: false, error: null });

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
          const heading = measurement.trueHeading >= 0 ? measurement.trueHeading : measurement.magHeading;
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
            elevation = Math.atan2(-gravity.z, -gravity.y) * 180 / Math.PI;
          } else if (measurement.rotation) {
            elevation = 90 - measurement.rotation.beta * 180 / Math.PI;
          }
          if (elevation === null || !Number.isFinite(elevation)) return;
          setState((previous) => ({ ...previous, elevation: Math.max(-10, Math.min(90, elevation)) }));
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

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
          if (!measurement.rotation) return;
          const betaDegrees = (measurement.rotation.beta * 180) / Math.PI;
          // Keep elevation signed so crossing zenith cannot mirror the view into
          // the opposite hemisphere. Over-tilt is held at zenith instead.
          setState((previous) => ({ ...previous, elevation: Math.max(-10, Math.min(90, 90 - betaDegrees)) }));
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

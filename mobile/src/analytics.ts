import { getAnalytics, logEvent, logScreenView } from '@react-native-firebase/analytics';

type AnalyticsValue = string | number | boolean;
type AnalyticsParameters = Record<string, AnalyticsValue>;

function reportFailure(error: unknown) {
  if (__DEV__) console.warn('Analytics event was not recorded.', error);
}

export function trackEvent(name: string, parameters: AnalyticsParameters = {}) {
  try {
    logEvent(getAnalytics(), name, parameters);
  } catch (error) {
    reportFailure(error);
  }
}

export function trackSkyScreen() {
  try {
    void logScreenView(getAnalytics(), {
      firebase_screen: 'Sky Map',
      firebase_screen_class: 'SkyMap',
    }).catch(reportFailure);
  } catch (error) {
    reportFailure(error);
  }
}

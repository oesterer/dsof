import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, Linking, PanResponder, Pressable, SafeAreaView, ScrollView, StatusBar as NativeStatusBar, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { BRIGHT_STARS } from './src/data/brightStars';
import { CONSTELLATIONS } from './src/data/constellations';
import { MESSIER_OBJECTS } from './src/data/messier';
import { MESSIER_ASSETS, PLANET_ASSETS } from './src/data/imageAssets';
import { getConstellationInfo } from './src/data/constellationInfo';
import { CatalogStar, ProjectedPoint, ProjectedStar, cardinalDirection, eclipticToEquatorial, equatorialToHorizontal, projectHorizontalPoint, projectStar, toHorizontal } from './src/astro';
import { computeSolarSystem, SolarBody } from './src/solarSystem';
import { useSkySensors } from './src/useSkySensors';
import { trackEvent, trackSkyScreen } from './src/analytics';

type Constellation = { name: string; abbreviation: string; lines: { raHours: number; decDeg: number }[][]; label?: { raHours: number; decDeg: number } };
type DisplayOptions = { stars: boolean; constellations: boolean; constellationLabels: boolean; grid: boolean; horizon: boolean; ecliptic: boolean; planets: boolean; deepSky: boolean; reticle: boolean };
type ProjectedConstellation = { name: string; abbreviation: string; segments: [ProjectedPoint, ProjectedPoint][]; label: ProjectedPoint | null };
type MessierObject = { designation: string; name: string; type: string; raHours: number; decDeg: number };
type ProjectedMessier = MessierObject & ProjectedPoint;
type ProjectedBody = SolarBody & ProjectedPoint;
type Selection = { kind: 'star' | 'planet' | 'sun' | 'moon' | 'deepSky' | 'constellation'; id: string; name: string; details: string; wikipediaTitle?: string };
type SearchEntry = { id: string; name: string; kind: Selection['kind']; raHours: number; decDeg: number };

const CATALOG = (BRIGHT_STARS as CatalogStar[]).filter((star) => (
  Number.isFinite(star.hr)
  && Number.isFinite(star.raHours)
  && Number.isFinite(star.decDeg)
  && Number.isFinite(star.mag)
  && star.mag <= 5.2
));
const SKY_SHAPES = CONSTELLATIONS as Constellation[];
const CONSTELLATION_NAMES = new Map(SKY_SHAPES.map((constellation) => [constellation.abbreviation, constellation.name]));
const BASE_FOV = 62;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const normalizeHeading = (value: number) => ((value % 360) + 360) % 360;
const isSolarSelection = (kind: Selection['kind']) => kind === 'planet' || kind === 'sun' || kind === 'moon';
const wikipediaUrl = (title: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
const starWikipediaTitle = (star: CatalogStar) => {
  const name = star.properName || star.name;
  if (!name
    || /^HR \d+$/.test(name)
    || /^\d/.test(name)
    || /^(Alpha|Beta|Gamma|Delta|Epsilon|Zeta|Eta|Theta|Iota|Kappa|Lambda|Mu|Nu|Xi|Omicron|Pi|Rho|Sigma|Tau|Upsilon|Phi|Chi|Psi|Omega)(\s+\d+)?\s/.test(name)
    || /^Omi(?:\s|$)/.test(name)
    || /^[A-Za-z]{2,3}\d/i.test(name)) return undefined;
  return name;
};
const moonGlyph = (body: SolarBody) => {
  if ((body.illumination || 0) < 0.03) return '●';
  if ((body.illumination || 0) > 0.97) return '○';
  if ((body.illumination || 0) < 0.53) return body.waxing ? '◒' : '◓';
  return body.waxing ? '◐' : '◑';
};

export default function App() {
  const sensors = useSkySensors();
  const [cameraMode, setCameraMode] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [viewport, setViewport] = useState({ width: 390, height: 650 });
  const [selected, setSelected] = useState<Selection | null>(null);
  const [clockTime, setClockTime] = useState(() => new Date());
  const [timeOffsetMinutes, setTimeOffsetMinutes] = useState(0);
  const [timeOpen, setTimeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [displayOptionsOpen, setDisplayOptionsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tracking, setTracking] = useState(true);
  const [view, setView] = useState({ heading: 0, elevation: 25 });
  const [zoom, setZoom] = useState(1);
  const [display, setDisplay] = useState<DisplayOptions>({ stars: true, constellations: true, constellationLabels: true, grid: true, horizon: true, ecliptic: true, planets: true, deepSky: true, reticle: true });
  const gesture = useRef({ heading: 0, elevation: 0, zoom: 1, distance: 0, fieldOfView: BASE_FOV, width: 390, height: 650, moved: false, pinching: false });

  useEffect(() => {
    const timer = setInterval(() => setClockTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    trackSkyScreen();
  }, []);

  useEffect(() => {
    if (tracking && !menuOpen) {
      setView((current) => {
        if (Math.abs(current.heading - sensors.heading) < 0.01 && Math.abs(current.elevation - sensors.elevation) < 0.01) return current;
        return { heading: sensors.heading, elevation: sensors.elevation };
      });
    }
  }, [tracking, menuOpen, sensors.heading, sensors.elevation]);

  function updateViewport(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setViewport((current) => {
      if (Math.abs(current.width - width) < 0.5 && Math.abs(current.height - height) < 0.5) return current;
      return { width, height };
    });
  }

  const viewHeading = view.heading;
  const viewElevation = view.elevation;
  const fieldOfView = BASE_FOV / zoom;
  const observationTime = useMemo(() => new Date(clockTime.getTime() + timeOffsetMinutes * 60_000), [clockTime, timeOffsetMinutes]);

  const horizontalStars = useMemo(() => {
    if (sensors.latitude === null || sensors.longitude === null) return [];
    return CATALOG.map((star) => toHorizontal(star, sensors.latitude!, sensors.longitude!, observationTime));
  }, [sensors.latitude, sensors.longitude, observationTime]);

  const visibleStars = useMemo(() => horizontalStars
    .map((star) => projectStar(star, viewHeading, viewElevation, viewport.width, viewport.height, fieldOfView))
    .filter((star): star is ProjectedStar => star !== null),
  [horizontalStars, viewHeading, viewElevation, viewport, fieldOfView]);

  const { gridSegments, horizonSegments, eclipticSegments } = useMemo(() => {
    const project = (altitude: number, azimuth: number) => projectHorizontalPoint(
      { altitude, azimuth }, viewHeading, viewElevation, viewport.width, viewport.height, fieldOfView, false,
    );
    const makeSegments = (paths: { altitude: number; azimuth: number }[][]) => {
      const segments: [ProjectedPoint, ProjectedPoint][] = [];
      paths.forEach((path) => {
        for (let index = 1; index < path.length; index += 1) {
          const first = project(path[index - 1].altitude, path[index - 1].azimuth);
          const second = project(path[index].altitude, path[index].azimuth);
          if (first && second) segments.push([first, second]);
        }
      });
      return segments;
    };
    const equatorialGridPaths = sensors.latitude === null || sensors.longitude === null ? [] : [
      ...[-60, -30, 0, 30, 60].map((decDeg) =>
        Array.from({ length: 97 }, (_, index) => equatorialToHorizontal(index * 0.25, decDeg, sensors.latitude!, sensors.longitude!, observationTime)),
      ),
      ...[0, 4, 8, 12, 16, 20].map((raHours) =>
        Array.from({ length: 61 }, (_, index) => equatorialToHorizontal(raHours, -90 + index * 3, sensors.latitude!, sensors.longitude!, observationTime)),
      ),
    ];
    const horizonPath = [Array.from({ length: 181 }, (_, index) => ({ altitude: 0, azimuth: index * 2 }))];
    const eclipticPath = sensors.latitude === null || sensors.longitude === null ? [] : [
      Array.from({ length: 181 }, (_, index) => {
        const equatorial = eclipticToEquatorial(index * 2);
        return equatorialToHorizontal(equatorial.raHours, equatorial.decDeg, sensors.latitude!, sensors.longitude!, observationTime);
      }),
    ];
    return {
      gridSegments: makeSegments(equatorialGridPaths),
      horizonSegments: makeSegments(horizonPath),
      eclipticSegments: makeSegments(eclipticPath),
    };
  }, [viewHeading, viewElevation, viewport, fieldOfView, sensors.latitude, sensors.longitude, observationTime]);

  const solarCatalog = useMemo(() => computeSolarSystem(observationTime), [observationTime]);

  const visibleBodies = useMemo<ProjectedBody[]>(() => {
    if (!display.planets || sensors.latitude === null || sensors.longitude === null) return [];
    return solarCatalog.map((body) => {
      const horizontal = equatorialToHorizontal(body.raHours, body.decDeg, sensors.latitude!, sensors.longitude!, observationTime);
      const projected = projectHorizontalPoint(horizontal, viewHeading, viewElevation, viewport.width, viewport.height, fieldOfView);
      return projected ? { ...body, ...projected } : null;
    }).filter((body): body is ProjectedBody => body !== null);
  }, [display.planets, sensors.latitude, sensors.longitude, observationTime, viewHeading, viewElevation, viewport, fieldOfView, solarCatalog]);

  const visibleDeepSky = useMemo<ProjectedMessier[]>(() => {
    if (!display.deepSky || sensors.latitude === null || sensors.longitude === null) return [];
    return (MESSIER_OBJECTS as MessierObject[]).map((object) => {
      const horizontal = equatorialToHorizontal(object.raHours, object.decDeg, sensors.latitude!, sensors.longitude!, observationTime);
      const projected = projectHorizontalPoint(horizontal, viewHeading, viewElevation, viewport.width, viewport.height, fieldOfView);
      return projected ? { ...object, ...projected } : null;
    }).filter((object): object is ProjectedMessier => object !== null);
  }, [display.deepSky, sensors.latitude, sensors.longitude, observationTime, viewHeading, viewElevation, viewport, fieldOfView]);

  const visibleConstellations = useMemo<ProjectedConstellation[]>(() => {
    if (sensors.latitude === null || sensors.longitude === null || (!display.constellations && !display.constellationLabels)) return [];
    return SKY_SHAPES.map((constellation) => {
      const segments: [ProjectedPoint, ProjectedPoint][] = [];
      constellation.lines.forEach((path) => {
        for (let index = 1; index < path.length; index += 1) {
          const points = [path[index - 1], path[index]].map((point) => projectHorizontalPoint(
            equatorialToHorizontal(point.raHours, point.decDeg, sensors.latitude!, sensors.longitude!, observationTime),
            viewHeading, viewElevation, viewport.width, viewport.height, fieldOfView, false,
          ));
          if (points[0] && points[1]) segments.push(points as [ProjectedPoint, ProjectedPoint]);
        }
      });
      const catalogLabel = constellation.label ? projectHorizontalPoint(
        equatorialToHorizontal(constellation.label.raHours, constellation.label.decDeg, sensors.latitude!, sensors.longitude!, observationTime),
        viewHeading, viewElevation, viewport.width, viewport.height, fieldOfView,
      ) : null;
      const labelCandidates = segments.flatMap(([first, second]) => [
        first,
        second,
        { ...first, x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
      ]).filter((point) => point.x >= 18 && point.x <= viewport.width - 18 && point.y >= 18 && point.y <= viewport.height - 18);
      const nearestCandidate = labelCandidates.reduce<ProjectedPoint | null>((best, point) => {
        if (!best) return point;
        const distance = Math.hypot(point.x - viewport.width / 2, point.y - viewport.height / 2);
        const bestDistance = Math.hypot(best.x - viewport.width / 2, best.y - viewport.height / 2);
        return distance < bestDistance ? point : best;
      }, null);
      const fallbackSegment = segments.reduce<[ProjectedPoint, ProjectedPoint] | null>((best, segment) => {
        if (!best) return segment;
        const distance = Math.hypot((segment[0].x + segment[1].x) / 2 - viewport.width / 2, (segment[0].y + segment[1].y) / 2 - viewport.height / 2);
        const bestDistance = Math.hypot((best[0].x + best[1].x) / 2 - viewport.width / 2, (best[0].y + best[1].y) / 2 - viewport.height / 2);
        return distance < bestDistance ? segment : best;
      }, null);
      const fallbackLabel = nearestCandidate || (fallbackSegment ? {
        ...fallbackSegment[0],
        x: clamp((fallbackSegment[0].x + fallbackSegment[1].x) / 2, 24, viewport.width - 24),
        y: clamp((fallbackSegment[0].y + fallbackSegment[1].y) / 2, 24, viewport.height - 24),
      } : null);
      return { name: constellation.name, abbreviation: constellation.abbreviation, segments, label: catalogLabel || fallbackLabel };
    }).filter((constellation) => constellation.segments.length > 0 || constellation.label);
  }, [sensors.latitude, sensors.longitude, observationTime, viewHeading, viewElevation, viewport, fieldOfView, display.constellations, display.constellationLabels]);

  const selectedProjected = useMemo(() => {
    if (!selected) return null;
    if (isSolarSelection(selected.kind)) return visibleBodies.find((body) => body.name === selected.id) || null;
    if (selected.kind === 'deepSky') return visibleDeepSky.find((object) => object.designation === selected.id) || null;
    if (selected.kind === 'constellation') return visibleConstellations.find((constellation) => constellation.abbreviation === selected.id)?.label || null;
    return visibleStars.find((star) => String(star.hr) === selected.id) || null;
  }, [selected, visibleBodies, visibleDeepSky, visibleStars, visibleConstellations]);

  useEffect(() => {
    if (selected && !selectedProjected) setSelected(null);
  }, [selected, selectedProjected]);

  const selectedImage = selected && isSolarSelection(selected.kind)
    ? PLANET_ASSETS[selected.id]
    : selected?.kind === 'deepSky' ? MESSIER_ASSETS[selected.id] : undefined;
  const selectedConstellation = selected?.kind === 'constellation' ? SKY_SHAPES.find((constellation) => constellation.abbreviation === selected.id) : undefined;

  const searchResults = useMemo<SearchEntry[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    const entries: SearchEntry[] = [];
    CATALOG.forEach((star) => {
      const name = star.properName || star.name;
      if (name?.toLowerCase().includes(query)) entries.push({ id: String(star.hr), name, kind: 'star', raHours: star.raHours, decDeg: star.decDeg });
    });
    (MESSIER_OBJECTS as MessierObject[]).forEach((object) => {
      if (`${object.designation} ${object.name}`.toLowerCase().includes(query)) entries.push({ id: object.designation, name: `${object.designation} · ${object.name}`, kind: 'deepSky', raHours: object.raHours, decDeg: object.decDeg });
    });
    SKY_SHAPES.forEach((constellation) => {
      if (`${constellation.name} ${constellation.abbreviation}`.toLowerCase().includes(query)) {
        const point = constellation.label || constellation.lines[0]?.[0];
        if (point) entries.push({ id: constellation.abbreviation, name: constellation.name, kind: 'constellation', raHours: point.raHours, decDeg: point.decDeg });
      }
    });
    solarCatalog.forEach((body) => {
      if (body.name.toLowerCase().includes(query)) entries.push({ id: body.name, name: body.name, kind: body.name === 'Sun' ? 'sun' : body.name === 'Moon' ? 'moon' : 'planet', raHours: body.raHours, decDeg: body.decDeg });
    });
    return entries.sort((first, second) => Number(!first.name.toLowerCase().startsWith(query)) - Number(!second.name.toLowerCase().startsWith(query)) || first.name.localeCompare(second.name)).slice(0, 8);
  }, [searchQuery, solarCatalog]);

  function centerSearchResult(entry: SearchEntry) {
    if (sensors.latitude === null || sensors.longitude === null) return;
    const horizontal = equatorialToHorizontal(entry.raHours, entry.decDeg, sensors.latitude, sensors.longitude, observationTime);
    setView({ heading: horizontal.azimuth, elevation: horizontal.altitude });
    setTracking(false);
    setDisplay((current) => ({
      ...current,
      stars: entry.kind === 'star' ? true : current.stars,
      deepSky: entry.kind === 'deepSky' ? true : current.deepSky,
      planets: isSolarSelection(entry.kind) ? true : current.planets,
      constellations: entry.kind === 'constellation' ? true : current.constellations,
      constellationLabels: entry.kind === 'constellation' ? true : current.constellationLabels,
    }));
    setSelected(null);
    setSearchQuery('');
    setMenuOpen(false);
    trackEvent('search_result_selected', { object_type: entry.kind, object_id: entry.id });
  }

  function identifyAt(x: number, y: number) {
    const candidates: Selection[] = [];
    if (display.planets) visibleBodies.forEach((body) => candidates.push({
      kind: body.name === 'Sun' ? 'sun' : body.name === 'Moon' ? 'moon' : 'planet', id: body.name, name: body.name, wikipediaTitle: body.name, details: body.name === 'Moon'
        ? `${body.phaseName} · ${Math.round((body.illumination || 0) * 100)}% lit · alt ${Math.round(body.altitude)}°`
        : body.name === 'Sun' ? `Star · alt ${Math.round(body.altitude)}°` : `Planet · alt ${Math.round(body.altitude)}°`,
    }));
    if (display.deepSky) visibleDeepSky.forEach((object) => candidates.push({
      kind: 'deepSky', id: object.designation, name: `${object.designation} · ${object.name}`, wikipediaTitle: `Messier ${object.designation.slice(1)}`, details: `${object.type.replace(/_/g, ' ')} · alt ${Math.round(object.altitude)}°`,
    }));
    if (display.stars) visibleStars.forEach((star) => candidates.push({
      kind: 'star', id: String(star.hr), name: star.properName || star.name, wikipediaTitle: starWikipediaTitle(star), details: `${star.constellation ? `Constellation: ${CONSTELLATION_NAMES.get(star.constellation) || star.constellation}` : 'Star'} · mag ${Number.isFinite(star.mag) ? star.mag.toFixed(2) : 'unknown'} · alt ${Math.round(star.altitude)}°`,
    }));
    if (display.constellationLabels) visibleConstellations.forEach((constellation) => {
      if (constellation.label) candidates.push({ kind: 'constellation', id: constellation.abbreviation, name: constellation.name, wikipediaTitle: `${constellation.name} (constellation)`, details: getConstellationInfo(constellation.name) });
    });
    const nearest = candidates.reduce<{ object: Selection; distance: number } | null>((best, object) => {
      const projected = isSolarSelection(object.kind)
        ? visibleBodies.find((body) => body.name === object.id)
        : object.kind === 'deepSky' ? visibleDeepSky.find((entry) => entry.designation === object.id)
          : object.kind === 'constellation' ? visibleConstellations.find((entry) => entry.abbreviation === object.id)?.label
            : visibleStars.find((star) => String(star.hr) === object.id);
      if (!projected) return best;
      const distance = Math.hypot(projected.x - x, projected.y - y);
      if (distance > (isSolarSelection(object.kind) ? 34 : object.kind === 'constellation' ? 42 : 28)) return best;
      return !best || distance < best.distance ? { object, distance } : best;
    }, null);
    setSelected(nearest?.object || null);
    if (nearest) trackEvent('object_selected', { object_type: nearest.object.kind, object_id: nearest.object.id });
  }

  const interaction = useRef({ menuOpen, timeOpen, viewHeading, viewElevation, zoom, fieldOfView, viewport, identifyAt });
  interaction.current = { menuOpen, timeOpen, viewHeading, viewElevation, zoom, fieldOfView, viewport, identifyAt };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !interaction.current.menuOpen && !interaction.current.timeOpen,
    onMoveShouldSetPanResponder: (_, state) => Math.abs(state.dx) + Math.abs(state.dy) > 3,
    onPanResponderGrant: (event) => {
      const touches = event.nativeEvent.touches;
      const distance = touches.length > 1 ? Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY) : 0;
      const current = interaction.current;
      gesture.current = {
        heading: current.viewHeading,
        elevation: current.viewElevation,
        zoom: current.zoom,
        distance,
        fieldOfView: current.fieldOfView,
        width: current.viewport.width,
        height: current.viewport.height,
        moved: false,
        pinching: touches.length > 1,
      };
    },
    onPanResponderMove: (event, state) => {
      const touches = event.nativeEvent.touches;
      if (touches.length > 1) {
        const distance = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
        if (!gesture.current.pinching || gesture.current.distance <= 0) {
          gesture.current.pinching = true;
          gesture.current.distance = distance;
          gesture.current.zoom = interaction.current.zoom;
        } else {
          setZoom(clamp(gesture.current.zoom * distance / gesture.current.distance, 1, 6));
        }
        gesture.current.moved = true;
        return;
      }
      if (gesture.current.pinching) return;
      if (Math.abs(state.dx) + Math.abs(state.dy) > 4) {
        const start = gesture.current;
        const verticalFov = start.fieldOfView * start.height / start.width;
        setView({
          heading: normalizeHeading(start.heading - state.dx * start.fieldOfView / start.width),
          elevation: clamp(start.elevation + state.dy * verticalFov / start.height, -90, 90),
        });
        setTracking(false);
        gesture.current.moved = true;
      }
    },
    onPanResponderRelease: (event) => {
      if (!gesture.current.moved) {
        interaction.current.identifyAt(event.nativeEvent.locationX, event.nativeEvent.locationY);
      } else {
        trackEvent('sky_gesture', { gesture_type: gesture.current.pinching ? 'pinch_zoom' : 'drag' });
      }
    },
    onPanResponderTerminationRequest: () => false,
  })).current;

  async function toggleCamera() {
    if (!cameraMode && !cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        trackEvent('camera_permission_denied');
        return;
      }
    }
    const enabled = !cameraMode;
    setCameraMode(enabled);
    trackEvent('camera_view_toggled', { enabled });
  }

  function changeDisplay(option: keyof DisplayOptions, value: boolean) {
    setDisplay((current) => ({ ...current, [option]: value }));
    if (!value && ((option === 'stars' && selected?.kind === 'star') || (option === 'planets' && selected && isSolarSelection(selected.kind)) || (option === 'deepSky' && selected?.kind === 'deepSky') || (option === 'constellationLabels' && selected?.kind === 'constellation'))) setSelected(null);
    trackEvent('display_option_changed', { option, enabled: value });
  }

  const direction = cardinalDirection(viewHeading);
  const labelScale = clamp(1 + (zoom - 1) * 0.24, 1, 2);
  const offsetHours = timeOffsetMinutes / 60;
  const timeOffsetLabel = timeOffsetMinutes === 0 ? 'Now' : `+${Number.isInteger(offsetHours) ? offsetHours : offsetHours.toFixed(1)}h`;
  const observationTimeLabel = observationTime.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  const adjustTime = (minutes: number) => {
    const next = clamp(timeOffsetMinutes + minutes, 0, 72 * 60);
    setTimeOffsetMinutes(next);
    trackEvent('observation_time_changed', { step_minutes: minutes, offset_minutes: next });
  };
  const returnToNow = () => {
    setTimeOffsetMinutes(0);
    trackEvent('observation_time_reset');
  };
  const changeZoom = (direction: 'in' | 'out') => {
    const next = clamp(direction === 'in' ? zoom * 1.35 : zoom / 1.35, 1, 6);
    setZoom(next);
    trackEvent('zoom_button_used', { direction, zoom_level: Number(next.toFixed(2)) });
  };
  const resumeTracking = () => {
    setView({ heading: sensors.heading, elevation: sensors.elevation });
    setTracking(true);
    trackEvent('tracking_resumed');
  };
  const openWikipedia = (selection: Selection) => {
    if (!selection.wikipediaTitle) return;
    trackEvent('wikipedia_opened', { object_type: selection.kind, object_id: selection.id });
    void Linking.openURL(wikipediaUrl(selection.wikipediaTitle));
  };
  return (
    <View style={styles.app}>
      <StatusBar style="light" />
      {cameraMode && cameraPermission?.granted ? <CameraView style={StyleSheet.absoluteFill} facing="back" /> : null}
      <View style={[StyleSheet.absoluteFill, !cameraMode && styles.nightBackground]} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.orientationPill}>
            <Text style={styles.eyebrow}>{tracking ? 'LIVE ORIENTATION' : 'MANUAL VIEW'}</Text>
            <View style={styles.orientationValues}>
              <Text style={styles.heading}>{Math.round(viewHeading)}° {direction}</Text>
              <View style={styles.orientationDivider} />
              <View style={styles.elevationReadout}>
                <Text style={styles.elevationLabel}>ELEV</Text>
                <Text style={styles.elevationValue}>{Math.round(viewElevation)}°</Text>
              </View>
            </View>
          </View>
          <Pressable accessibilityLabel="Display options" style={styles.menuButton} onPress={() => { setTimeOpen(false); setMenuOpen(!menuOpen); trackEvent('sky_menu_toggled', { opened: !menuOpen }); }}>
            <Text style={styles.menuButtonText}>☰</Text>
          </Pressable>
        </View>

        {menuOpen ? <ScrollView style={styles.menu} contentContainerStyle={styles.menuContent} keyboardShouldPersistTaps="handled">
          <View style={styles.menuHeadingRow}>
            <Text style={styles.menuTitle}>Sky menu</Text>
            <Pressable accessibilityLabel="Close menu" hitSlop={10} onPress={() => setMenuOpen(false)}><Text style={styles.menuClose}>×</Text></Pressable>
          </View>
          <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Find star, planet, M42…" placeholderTextColor="#668296" autoCorrect={false} returnKeyType="search" style={styles.searchInput} />
          {searchQuery.trim() ? <View style={styles.searchResults}>
            {searchResults.length ? searchResults.map((entry) => <Pressable key={`${entry.kind}-${entry.id}`} style={styles.searchResult} onPress={() => centerSearchResult(entry)}><Text style={styles.searchResultName}>{entry.name}</Text><Text style={styles.searchResultKind}>{entry.kind === 'deepSky' ? 'deep sky' : entry.kind}</Text></Pressable>) : <Text style={styles.searchEmpty}>No matching object</Text>}
          </View> : <>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: displayOptionsOpen }} style={styles.submenuButton} onPress={() => { setDisplayOptionsOpen(!displayOptionsOpen); trackEvent('display_options_toggled', { opened: !displayOptionsOpen }); }}>
            <Text style={styles.submenuTitle}>Display Options</Text>
            <Text style={styles.submenuChevron}>{displayOptionsOpen ? '⌃' : '⌄'}</Text>
          </Pressable>
          {displayOptionsOpen ? <View style={styles.displayOptions}>
            <MenuSwitch label="Stars" value={display.stars} onChange={(value) => changeDisplay('stars', value)} />
            <MenuSwitch label="Planets, Moon & Sun" value={display.planets} onChange={(value) => changeDisplay('planets', value)} />
            <MenuSwitch label="Deep-sky objects" value={display.deepSky} onChange={(value) => changeDisplay('deepSky', value)} />
            <MenuSwitch label="Constellation lines" value={display.constellations} onChange={(value) => changeDisplay('constellations', value)} />
            <MenuSwitch label="Constellation names" value={display.constellationLabels} onChange={(value) => changeDisplay('constellationLabels', value)} />
            <MenuSwitch label="RA / Dec grid" value={display.grid} onChange={(value) => changeDisplay('grid', value)} />
            <MenuSwitch label="Horizon" value={display.horizon} onChange={(value) => changeDisplay('horizon', value)} />
            <MenuSwitch label="Ecliptic" value={display.ecliptic} onChange={(value) => changeDisplay('ecliptic', value)} />
            <MenuSwitch label="Aiming reticle" value={display.reticle} onChange={(value) => changeDisplay('reticle', value)} />
          </View> : null}
          </>}
        </ScrollView> : null}

        <View style={styles.sky} onLayout={updateViewport}>
          <Svg width="100%" height="100%">
            {display.grid ? gridSegments.map((segment, index) =>
              <Line key={`grid-${index}`} x1={segment[0].x} y1={segment[0].y} x2={segment[1].x} y2={segment[1].y} stroke="#315369" strokeWidth={0.7} strokeOpacity={cameraMode ? 0.58 : 0.38} />,
            ) : null}
            {display.horizon ? horizonSegments.map((segment, index) =>
              <Line key={`horizon-${index}`} x1={segment[0].x} y1={segment[0].y} x2={segment[1].x} y2={segment[1].y} stroke="#d9b35f" strokeWidth={1.6} strokeOpacity={0.82} />,
            ) : null}
            {display.ecliptic ? eclipticSegments.map((segment, index) =>
              <Line key={`ecliptic-${index}`} x1={segment[0].x} y1={segment[0].y} x2={segment[1].x} y2={segment[1].y} stroke="#65d58b" strokeWidth={1.5} strokeOpacity={0.82} />,
            ) : null}
            {display.constellations ? visibleConstellations.flatMap((constellation) => constellation.segments.map((segment, index) =>
              <Line key={`${constellation.name}-${index}`} x1={segment[0].x} y1={segment[0].y} x2={segment[1].x} y2={segment[1].y} stroke="#5288a7" strokeWidth={1} strokeOpacity={cameraMode ? 0.9 : 0.68} />,
            )) : null}
            {display.constellationLabels ? visibleConstellations.map((constellation) => constellation.label ?
              <SvgText key={constellation.name} x={constellation.label.x} y={constellation.label.y} fill={selected?.kind === 'constellation' && selected.id === constellation.abbreviation ? '#86efdf' : '#70a8c8'} fontSize={11 * labelScale} fontWeight={selected?.kind === 'constellation' && selected.id === constellation.abbreviation ? '800' : '500'} textAnchor="middle" opacity={0.95}>{constellation.name}</SvgText> : null,
            ) : null}
            {display.deepSky ? visibleDeepSky.map((object) => <Fragment key={object.designation}>
              <Rect x={object.x - 4} y={object.y - 4} width={8} height={8} rotation={45} origin={`${object.x}, ${object.y}`} fill="none" stroke={selected?.kind === 'deepSky' && selected.id === object.designation ? '#86efdf' : '#d68cff'} strokeWidth={selected?.kind === 'deepSky' && selected.id === object.designation ? 2.2 : 1.3} />
              <SvgText x={object.x + 7} y={object.y + 4} fill={selected?.kind === 'deepSky' && selected.id === object.designation ? '#86efdf' : '#d9a4f2'} fontSize={9 * labelScale} fontWeight={selected?.kind === 'deepSky' && selected.id === object.designation ? '700' : '400'}>{object.designation}</SvgText>
            </Fragment>) : null}
            {display.stars ? visibleStars.map((star) => <Circle key={star.hr} cx={star.x} cy={star.y} r={star.radius} fill={star.mag < 1.5 ? '#fff4d6' : '#e8f3ff'} opacity={Math.max(star.altitude < 0 ? 0.22 : 0.45, (1 - star.mag / 8) * (star.altitude < 0 ? 0.55 : 1))} />) : null}
            {display.planets ? visibleBodies.map((body) => <Fragment key={body.name}>
              {body.name === 'Moon'
                ? <SvgText x={body.x} y={body.y + 6} fill={selected && isSolarSelection(selected.kind) && selected.id === body.name ? '#86efdf' : '#eef2f5'} fontSize={19} textAnchor="middle">{moonGlyph(body)}</SvgText>
                : <Circle cx={body.x} cy={body.y} r={body.name === 'Sun' ? 8 : Math.max(4, body.size / 2)} fill={body.color} stroke={selected && isSolarSelection(selected.kind) && selected.id === body.name ? '#86efdf' : '#ffffff'} strokeOpacity={0.9} strokeWidth={selected && isSolarSelection(selected.kind) && selected.id === body.name ? 2.5 : body.name === 'Sun' ? 1.5 : 0.7} />}
              <SvgText x={body.x} y={body.y - 11 - (labelScale - 1) * 4} fill={selected && isSolarSelection(selected.kind) && selected.id === body.name ? '#86efdf' : body.name === 'Sun' ? '#ffe39a' : '#ffffff'} fontSize={11 * labelScale} fontWeight={selected && isSolarSelection(selected.kind) && selected.id === body.name ? '800' : '600'} textAnchor="middle">{body.name}</SvgText>
            </Fragment>) : null}
            {display.reticle ? <>
              <Line x1={viewport.width / 2} y1={viewport.height * 0.47} x2={viewport.width / 2} y2={viewport.height * 0.53} stroke="#86efdf" strokeOpacity={0.65} />
              <Line x1={viewport.width * 0.46} y1={viewport.height / 2} x2={viewport.width * 0.54} y2={viewport.height / 2} stroke="#86efdf" strokeOpacity={0.65} />
            </> : null}
            {selectedProjected ? <Circle cx={selectedProjected.x} cy={selectedProjected.y} r={15} fill="none" stroke="#86efdf" strokeWidth={1.5} /> : null}
          </Svg>
          <View accessibilityLabel="Interactive sky map" style={styles.gestureSurface} {...panResponder.panHandlers} />
          {!sensors.ready ? <View style={styles.centerMessage}><Text style={styles.centerTitle}>{sensors.error ? 'Sensors unavailable' : 'Finding your sky…'}</Text><Text style={styles.centerCopy}>{sensors.error || 'Allow location and motion access when prompted.'}</Text></View> : null}
          <Pressable accessibilityLabel={cameraMode ? 'Disable camera view' : 'Enable camera view'} accessibilityState={{ selected: cameraMode }} style={[styles.cameraButton, cameraMode && styles.cameraButtonActive]} onPress={toggleCamera}>
            <ApertureIcon active={cameraMode} />
          </Pressable>
          <Pressable style={[styles.timeButton, timeOffsetMinutes > 0 && styles.timeButtonActive]} onPress={() => { setMenuOpen(false); setTimeOpen(!timeOpen); trackEvent('time_panel_toggled', { opened: !timeOpen }); }}>
            <Text style={styles.timeButtonLabel}>◷ {timeOffsetLabel}</Text>
          </Pressable>
          {timeOpen ? <View style={styles.timePanel}>
            <View style={styles.timeHeadingRow}><View><Text style={styles.timeTitle}>Observation time</Text><Text style={styles.timeDate}>{observationTimeLabel}</Text></View><Pressable hitSlop={10} onPress={() => setTimeOpen(false)}><Text style={styles.timeClose}>×</Text></Pressable></View>
            <View style={styles.timeSteps}>
              <TimeStep label="−1h" onPress={() => adjustTime(-60)} disabled={timeOffsetMinutes === 0} />
              <TimeStep label="+1h" onPress={() => adjustTime(60)} />
              <TimeStep label="+6h" onPress={() => adjustTime(360)} />
              <TimeStep label="+12h" onPress={() => adjustTime(720)} />
            </View>
            <Pressable style={styles.nowButton} onPress={returnToNow}><Text style={styles.nowButtonText}>Return to now</Text></Pressable>
          </View> : null}
          <View style={styles.zoomControls}>
            <Pressable style={styles.zoomButton} onPress={() => changeZoom('in')}><Text style={styles.zoomText}>+</Text></Pressable>
            <Text style={styles.zoomValue}>{zoom.toFixed(1)}×</Text>
            <Pressable style={styles.zoomButton} onPress={() => changeZoom('out')}><Text style={styles.zoomText}>−</Text></Pressable>
          </View>
          {!tracking ? <Pressable style={styles.resumeButton} onPress={resumeTracking}><Text style={styles.resumeText}>Resume tracking</Text></Pressable> : null}
        </View>

        <View style={styles.bottomPanel}>
          {selected ? <View style={styles.objectCard}>
            {selectedImage ? <Image source={selectedImage} style={styles.objectImage} resizeMode="cover" /> : null}
            {selectedConstellation ? <ConstellationPreview constellation={selectedConstellation} /> : null}
            <View style={styles.objectCopy}><Text style={styles.objectKind}>{selected.kind === 'deepSky' ? 'DEEP-SKY OBJECT' : selected.kind === 'planet' ? 'PLANET' : selected.kind === 'sun' ? 'STAR' : selected.kind === 'moon' ? 'MOON' : selected.kind === 'constellation' ? 'CONSTELLATION' : 'STAR'}</Text><Text style={styles.objectName}>{selected.name}</Text><Text style={styles.objectMeta}>{selected.details}</Text>{selected.wikipediaTitle ? <Pressable accessibilityRole="link" onPress={() => openWikipedia(selected)}><Text style={styles.wikipediaLink}>Wikipedia ↗</Text></Pressable> : null}</View>
            <Pressable onPress={() => setSelected(null)}><Text style={styles.close}>×</Text></Pressable>
          </View> : <Text style={styles.hint}>{tracking ? 'Aim your phone. Pinch to zoom or drag to explore.' : 'Manual view active. Tap Resume tracking to follow your phone.'}</Text>}
          {sensors.headingAccuracy < 2 && sensors.ready && tracking ? <Text style={styles.calibration}>Move the phone in a figure eight to calibrate the compass.</Text> : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

function MenuSwitch({ label, value, onChange }: { label: string; value: boolean; onChange(value: boolean): void }) {
  return <View style={styles.menuRow}><Text style={styles.menuLabel}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ false: '#243c4d', true: '#2b766f' }} thumbColor={value ? '#86efdf' : '#91a4b2'} /></View>;
}

function ApertureIcon({ active }: { active: boolean }) {
  const color = active ? '#071526' : '#dcecf7';
  return <Svg width={25} height={25} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={9} fill="none" stroke={color} strokeWidth={1.7} />
    <Path d="M14.3 8h6.1M9.7 8l3.1-5.3M7.4 12 4.3 6.7M9.7 16H3.6M14.3 16l-3.1 5.3M16.6 12l3.1 5.3" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

function TimeStep({ label, onPress, disabled = false }: { label: string; onPress(): void; disabled?: boolean }) {
  return <Pressable disabled={disabled} style={[styles.timeStep, disabled && styles.timeStepDisabled]} onPress={onPress}><Text style={styles.timeStepText}>{label}</Text></Pressable>;
}

function ConstellationPreview({ constellation }: { constellation: Constellation }) {
  const paths = useMemo(() => {
    const vertices = constellation.lines.flat();
    if (!vertices.length) return [];
    const vectorFor = (point: { raHours: number; decDeg: number }) => {
      const ra = point.raHours * 15 * Math.PI / 180;
      const dec = point.decDeg * Math.PI / 180;
      return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
    };
    const mean = vertices.map(vectorFor).reduce((sum, vector) => sum.map((value, index) => value + vector[index]), [0, 0, 0]);
    const meanLength = Math.hypot(...mean) || 1;
    const centerVector = mean.map((value) => value / meanLength);
    const centerRa = Math.atan2(centerVector[1], centerVector[0]);
    const east = [-Math.sin(centerRa), Math.cos(centerRa), 0];
    const northLength = Math.hypot(centerVector[0] * centerVector[2], centerVector[1] * centerVector[2], 1 - centerVector[2] ** 2) || 1;
    const north = [-centerVector[0] * centerVector[2] / northLength, -centerVector[1] * centerVector[2] / northLength, (1 - centerVector[2] ** 2) / northLength];
    const dot = (first: number[], second: number[]) => first.reduce((sum, value, index) => sum + value * second[index], 0);
    const project = (point: { raHours: number; decDeg: number }) => {
      const vector = vectorFor(point);
      const depth = Math.max(0.05, dot(vector, centerVector));
      return { x: -dot(vector, east) / depth, y: dot(vector, north) / depth };
    };
    const coordinates = vertices.map(project);
    const minX = Math.min(...coordinates.map((point) => point.x));
    const maxX = Math.max(...coordinates.map((point) => point.x));
    const minY = Math.min(...coordinates.map((point) => point.y));
    const maxY = Math.max(...coordinates.map((point) => point.y));
    const scale = Math.min(82 / Math.max(maxX - minX, 0.01), 82 / Math.max(maxY - minY, 0.01));
    return constellation.lines.map((path) => path.map((point) => {
      const projected = project(point);
      return {
        x: 50 + (projected.x - (minX + maxX) / 2) * scale,
        y: 50 - (projected.y - (minY + maxY) / 2) * scale,
      };
    }));
  }, [constellation]);
  return <View style={styles.constellationPreview}><Svg width="100%" height="100%" viewBox="0 0 100 100">
    {paths.flatMap((path, pathIndex) => path.slice(1).map((point, index) => <Line key={`${pathIndex}-${index}`} x1={path[index].x} y1={path[index].y} x2={point.x} y2={point.y} stroke="#86efdf" strokeWidth={2} />))}
    {paths.flatMap((path, pathIndex) => path.map((point, index) => <Circle key={`p-${pathIndex}-${index}`} cx={point.x} cy={point.y} r={2.2} fill="#fff" />))}
  </Svg></View>;
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#030812' }, nightBackground: { backgroundColor: '#071526' }, safeArea: { flex: 1, paddingTop: NativeStatusBar.currentHeight || 0 },
  header: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 5 },
  orientationPill: { minWidth: 190, borderWidth: 1, borderColor: '#29465c', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: 'rgba(3,8,18,0.78)' }, orientationValues: { flexDirection: 'row', alignItems: 'center', marginTop: 1 }, orientationDivider: { width: 1, height: 25, marginHorizontal: 11, backgroundColor: '#29465c' }, elevationReadout: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  eyebrow: { color: '#7d9bb3', fontSize: 8, fontWeight: '700', letterSpacing: 1.5 }, heading: { color: '#fff', fontSize: 24, fontWeight: '300', fontVariant: ['tabular-nums'] },
  elevationLabel: { color: '#7290a6', fontSize: 7, fontWeight: '700', letterSpacing: 0.8 }, elevationValue: { color: '#86efdf', fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  menuButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#29465c', backgroundColor: 'rgba(3,8,18,0.82)' }, menuButtonText: { color: '#dcecf7', fontSize: 20 },
  menu: { position: 'absolute', zIndex: 20, top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#091725' }, menuContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 64, paddingBottom: 24 }, menuHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }, menuTitle: { color: '#fff', fontWeight: '700', fontSize: 21 }, menuClose: { color: '#a9becd', fontSize: 32, lineHeight: 32, paddingLeft: 20, paddingVertical: 6 }, searchInput: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#31546b', backgroundColor: '#0d2030', color: '#fff', paddingHorizontal: 13, fontSize: 15, marginBottom: 12 }, searchResults: { paddingTop: 3 }, searchResult: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#213a4b' }, searchResultName: { color: '#eef7fc', fontSize: 14, flex: 1, paddingRight: 8 }, searchResultKind: { color: '#7895a9', fontSize: 10, textTransform: 'uppercase' }, searchEmpty: { color: '#7895a9', textAlign: 'center', paddingVertical: 22 }, submenuButton: { minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#31546b', borderRadius: 13, backgroundColor: '#0d2030' }, submenuTitle: { color: '#eef7fc', fontSize: 16, fontWeight: '700' }, submenuChevron: { color: '#86efdf', fontSize: 21 }, displayOptions: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1, borderColor: '#213a4b', borderRadius: 13, backgroundColor: 'rgba(13,32,48,0.58)' }, menuRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, menuLabel: { color: '#d6e5ee', fontSize: 14 },
  sky: { flex: 1, overflow: 'hidden' }, gestureSurface: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, centerMessage: { position: 'absolute', top: '40%', left: 30, right: 30, alignItems: 'center', padding: 20, borderRadius: 18, backgroundColor: 'rgba(3,8,18,0.82)' }, centerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' }, centerCopy: { color: '#9bb1c3', textAlign: 'center', marginTop: 6, lineHeight: 19 },
  cameraButton: { position: 'absolute', left: 14, bottom: 14, width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, borderWidth: 1, borderColor: '#29465c', backgroundColor: 'rgba(3,8,18,0.82)' }, cameraButtonActive: { borderColor: '#86efdf', backgroundColor: '#86efdf' },
  timeButton: { position: 'absolute', right: 14, bottom: 14, minWidth: 72, height: 40, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: '#29465c', backgroundColor: 'rgba(3,8,18,0.82)' }, timeButtonActive: { borderColor: '#d9b35f', backgroundColor: 'rgba(65,48,17,0.9)' }, timeButtonLabel: { color: '#e8f2f8', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timePanel: { position: 'absolute', zIndex: 8, right: 14, bottom: 62, width: 282, padding: 15, borderRadius: 17, borderWidth: 1, borderColor: '#31546b', backgroundColor: '#091725', shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } }, timeHeadingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, timeTitle: { color: '#fff', fontSize: 16, fontWeight: '700' }, timeDate: { color: '#d9b35f', fontSize: 13, fontWeight: '600', marginTop: 3 }, timeClose: { color: '#a9becd', fontSize: 27, lineHeight: 27, paddingLeft: 14 }, timeSteps: { flexDirection: 'row', gap: 6, marginTop: 14 }, timeStep: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#183247', borderWidth: 1, borderColor: '#31546b' }, timeStepDisabled: { opacity: 0.35 }, timeStepText: { color: '#eef8ff', fontSize: 12, fontWeight: '700' }, nowButton: { alignItems: 'center', paddingTop: 13, paddingBottom: 2 }, nowButtonText: { color: '#86efdf', fontSize: 13, fontWeight: '700' },
  zoomControls: { position: 'absolute', right: 14, top: 14, alignItems: 'center', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#29465c', backgroundColor: 'rgba(3,8,18,0.78)' }, zoomButton: { width: 42, height: 40, alignItems: 'center', justifyContent: 'center' }, zoomText: { color: '#fff', fontSize: 25, fontWeight: '300' }, zoomValue: { color: '#86a0b4', fontSize: 10, fontVariant: ['tabular-nums'] },
  resumeButton: { position: 'absolute', top: 16, alignSelf: 'center', paddingHorizontal: 17, paddingVertical: 10, borderRadius: 22, backgroundColor: '#17665f', borderWidth: 1, borderColor: '#86efdf' }, resumeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  bottomPanel: { paddingHorizontal: 18, paddingTop: 7, paddingBottom: 12 }, hint: { color: '#9bb1c3', textAlign: 'center', fontSize: 13, marginBottom: 4 }, calibration: { color: '#efc87a', textAlign: 'center', fontSize: 11, marginTop: 5 }, objectCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(3,8,18,0.94)', borderWidth: 1, borderColor: '#31546b', borderRadius: 17, padding: 10, overflow: 'hidden' }, objectImage: { width: 88, height: 88, borderRadius: 11, marginRight: 12, backgroundColor: '#0d1b29' }, constellationPreview: { width: 96, height: 96, borderRadius: 11, marginRight: 12, padding: 5, backgroundColor: '#0d1b29' }, objectCopy: { flex: 1, paddingRight: 4 }, objectKind: { color: '#86efdf', fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginBottom: 3 }, objectName: { color: '#fff', fontSize: 17, fontWeight: '600' }, objectMeta: { color: '#86a0b4', fontSize: 12, marginTop: 4, textTransform: 'capitalize' }, wikipediaLink: { color: '#86efdf', fontSize: 12, fontWeight: '700', marginTop: 7, textDecorationLine: 'underline' }, close: { color: '#86a0b4', fontSize: 27, paddingHorizontal: 7, alignSelf: 'flex-start' },
});

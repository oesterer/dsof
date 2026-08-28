import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Pressable, SafeAreaView, StatusBar as NativeStatusBar, StyleSheet, Switch, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { BRIGHT_STARS } from './src/data/brightStars';
import { CONSTELLATIONS } from './src/data/constellations';
import { CatalogStar, ProjectedPoint, ProjectedStar, cardinalDirection, equatorialToHorizontal, projectHorizontalPoint, projectStar, toHorizontal } from './src/astro';
import { useSkySensors } from './src/useSkySensors';

type Constellation = { name: string; abbreviation: string; lines: { raHours: number; decDeg: number }[][]; label?: { raHours: number; decDeg: number } };
type DisplayOptions = { stars: boolean; constellations: boolean; constellationLabels: boolean; reticle: boolean };
type ProjectedConstellation = { name: string; segments: [ProjectedPoint, ProjectedPoint][]; label: ProjectedPoint | null };

const CATALOG = (BRIGHT_STARS as CatalogStar[]).filter((star) => star.mag <= 5.2);
const SKY_SHAPES = CONSTELLATIONS as Constellation[];
const BASE_FOV = 62;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const normalizeHeading = (value: number) => ((value % 360) + 360) % 360;

export default function App() {
  const sensors = useSkySensors();
  const [cameraMode, setCameraMode] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [viewport, setViewport] = useState({ width: 390, height: 650 });
  const [selected, setSelected] = useState<ProjectedStar | null>(null);
  const [observationTime, setObservationTime] = useState(() => new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const [tracking, setTracking] = useState(true);
  const [view, setView] = useState({ heading: 0, elevation: 25 });
  const [zoom, setZoom] = useState(1);
  const [display, setDisplay] = useState<DisplayOptions>({ stars: true, constellations: true, constellationLabels: true, reticle: true });
  const gesture = useRef({ heading: 0, elevation: 0, zoom: 1, distance: 0, moved: false });

  useEffect(() => {
    const timer = setInterval(() => setObservationTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (tracking) setView({ heading: sensors.heading, elevation: sensors.elevation });
  }, [tracking, sensors.heading, sensors.elevation]);

  const viewHeading = view.heading;
  const viewElevation = view.elevation;
  const fieldOfView = BASE_FOV / zoom;

  const horizontalStars = useMemo(() => {
    if (sensors.latitude === null || sensors.longitude === null) return [];
    return CATALOG.map((star) => toHorizontal(star, sensors.latitude!, sensors.longitude!, observationTime)).filter((star) => star.altitude > -8);
  }, [sensors.latitude, sensors.longitude, observationTime]);

  const visibleStars = useMemo(() => horizontalStars
    .map((star) => projectStar(star, viewHeading, viewElevation, viewport.width, viewport.height, fieldOfView))
    .filter((star): star is ProjectedStar => star !== null),
  [horizontalStars, viewHeading, viewElevation, viewport, fieldOfView]);

  const visibleConstellations = useMemo<ProjectedConstellation[]>(() => {
    if (sensors.latitude === null || sensors.longitude === null || (!display.constellations && !display.constellationLabels)) return [];
    return SKY_SHAPES.map((constellation) => {
      const segments: [ProjectedPoint, ProjectedPoint][] = [];
      constellation.lines.forEach((path) => {
        for (let index = 1; index < path.length; index += 1) {
          const points = [path[index - 1], path[index]].map((point) => projectHorizontalPoint(
            equatorialToHorizontal(point.raHours, point.decDeg, sensors.latitude!, sensors.longitude!, observationTime),
            viewHeading, viewElevation, viewport.width, viewport.height, fieldOfView,
          ));
          if (points[0] && points[1]) segments.push(points as [ProjectedPoint, ProjectedPoint]);
        }
      });
      const label = constellation.label ? projectHorizontalPoint(
        equatorialToHorizontal(constellation.label.raHours, constellation.label.decDeg, sensors.latitude!, sensors.longitude!, observationTime),
        viewHeading, viewElevation, viewport.width, viewport.height, fieldOfView,
      ) : null;
      return { name: constellation.name, segments, label };
    }).filter((constellation) => constellation.segments.length > 0 || constellation.label);
  }, [sensors.latitude, sensors.longitude, observationTime, viewHeading, viewElevation, viewport, fieldOfView, display.constellations, display.constellationLabels]);

  function identifyAt(x: number, y: number) {
    if (!display.stars) return;
    const nearest = visibleStars.reduce<ProjectedStar | null>((best, star) => {
      const distance = Math.hypot(star.x - x, star.y - y);
      if (distance > 28) return best;
      return !best || distance < Math.hypot(best.x - x, best.y - y) ? star : best;
    }, null);
    setSelected(nearest);
  }

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !menuOpen,
    onMoveShouldSetPanResponder: (_, state) => Math.abs(state.dx) + Math.abs(state.dy) > 3,
    onPanResponderGrant: (event) => {
      const touches = event.nativeEvent.touches;
      const distance = touches.length > 1 ? Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY) : 0;
      gesture.current = { heading: viewHeading, elevation: viewElevation, zoom, distance, moved: false };
    },
    onPanResponderMove: (event, state) => {
      const touches = event.nativeEvent.touches;
      if (touches.length > 1) {
        const distance = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
        if (gesture.current.distance > 0) setZoom(clamp(gesture.current.zoom * distance / gesture.current.distance, 1, 6));
        gesture.current.moved = true;
        return;
      }
      if (Math.abs(state.dx) + Math.abs(state.dy) > 4) {
        const verticalFov = fieldOfView * viewport.height / viewport.width;
        setView({
          heading: normalizeHeading(gesture.current.heading - state.dx * fieldOfView / viewport.width),
          elevation: clamp(gesture.current.elevation - state.dy * verticalFov / viewport.height, -25, 90),
        });
        setTracking(false);
        gesture.current.moved = true;
      }
    },
    onPanResponderRelease: (event) => {
      if (!gesture.current.moved) identifyAt(event.nativeEvent.locationX, event.nativeEvent.locationY);
    },
    onPanResponderTerminationRequest: () => false,
  }), [menuOpen, viewHeading, viewElevation, zoom, fieldOfView, viewport, visibleStars, display.stars]);

  async function toggleCamera() {
    if (!cameraMode && !cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) return;
    }
    setCameraMode((current) => !current);
  }

  function changeDisplay(option: keyof DisplayOptions, value: boolean) {
    setDisplay((current) => ({ ...current, [option]: value }));
    if (option === 'stars' && !value) setSelected(null);
  }

  const direction = cardinalDirection(viewHeading);
  return (
    <View style={styles.app}>
      <StatusBar style="light" />
      {cameraMode && cameraPermission?.granted ? <CameraView style={StyleSheet.absoluteFill} facing="back" /> : null}
      <View style={[StyleSheet.absoluteFill, !cameraMode && styles.nightBackground]} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{tracking ? 'LIVE ORIENTATION' : 'MANUAL VIEW'}</Text>
            <Text style={styles.heading}>{Math.round(viewHeading)}° {direction}</Text>
          </View>
          <View style={styles.headerActions}>
            <View style={styles.elevationPill}>
              <Text style={styles.elevationLabel}>ELEVATION</Text>
              <Text style={styles.elevationValue}>{Math.round(viewElevation)}°</Text>
            </View>
            <Pressable accessibilityLabel="Display options" style={styles.menuButton} onPress={() => setMenuOpen((open) => !open)}>
              <Text style={styles.menuButtonText}>☰</Text>
            </Pressable>
          </View>
        </View>

        {menuOpen ? <Pressable accessibilityLabel="Close display menu" style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} /> : null}
        {menuOpen ? <View style={styles.menu}>
          <View style={styles.menuHeadingRow}>
            <Text style={styles.menuTitle}>Display</Text>
            <Pressable accessibilityLabel="Close menu" hitSlop={10} onPress={() => setMenuOpen(false)}><Text style={styles.menuClose}>×</Text></Pressable>
          </View>
          <MenuSwitch label="Stars" value={display.stars} onChange={(value) => changeDisplay('stars', value)} />
          <MenuSwitch label="Constellation lines" value={display.constellations} onChange={(value) => changeDisplay('constellations', value)} />
          <MenuSwitch label="Constellation names" value={display.constellationLabels} onChange={(value) => changeDisplay('constellationLabels', value)} />
          <MenuSwitch label="Aiming reticle" value={display.reticle} onChange={(value) => changeDisplay('reticle', value)} />
          <View style={styles.menuDivider} />
          <Pressable style={styles.menuCamera} onPress={toggleCamera}><Text style={styles.menuCameraText}>{cameraMode ? 'Disable camera view' : 'Enable camera view'}</Text></Pressable>
        </View> : null}

        <View style={styles.sky} onLayout={(event: LayoutChangeEvent) => setViewport(event.nativeEvent.layout)} {...panResponder.panHandlers}>
          <Svg width="100%" height="100%">
            {display.constellations ? visibleConstellations.flatMap((constellation) => constellation.segments.map((segment, index) =>
              <Line key={`${constellation.name}-${index}`} x1={segment[0].x} y1={segment[0].y} x2={segment[1].x} y2={segment[1].y} stroke="#5288a7" strokeWidth={1} strokeOpacity={cameraMode ? 0.85 : 0.55} />,
            )) : null}
            {display.constellationLabels ? visibleConstellations.map((constellation) => constellation.label ?
              <SvgText key={constellation.name} x={constellation.label.x} y={constellation.label.y} fill="#70a8c8" fontSize={11} textAnchor="middle" opacity={0.85}>{constellation.name}</SvgText> : null,
            ) : null}
            {display.stars ? visibleStars.map((star) => <Circle key={star.hr} cx={star.x} cy={star.y} r={star.radius} fill={star.mag < 1.5 ? '#fff4d6' : '#e8f3ff'} opacity={Math.max(0.45, 1 - star.mag / 8)} />) : null}
            {display.reticle ? <><Line x1="50%" y1="47%" x2="50%" y2="53%" stroke="#86efdf" strokeOpacity={0.65} /><Line x1="46%" y1="50%" x2="54%" y2="50%" stroke="#86efdf" strokeOpacity={0.65} /></> : null}
            {selected ? <><Circle cx={selected.x} cy={selected.y} r={13} fill="none" stroke="#86efdf" strokeWidth={1.5} /><SvgText x={selected.x} y={selected.y - 19} fill="#ffffff" fontSize={13} textAnchor="middle">{selected.properName || selected.name}</SvgText></> : null}
          </Svg>
          {!sensors.ready ? <View style={styles.centerMessage}><Text style={styles.centerTitle}>{sensors.error ? 'Sensors unavailable' : 'Finding your sky…'}</Text><Text style={styles.centerCopy}>{sensors.error || 'Allow location and motion access when prompted.'}</Text></View> : null}
          <View style={styles.zoomControls}>
            <Pressable style={styles.zoomButton} onPress={() => setZoom((value) => clamp(value * 1.35, 1, 6))}><Text style={styles.zoomText}>+</Text></Pressable>
            <Text style={styles.zoomValue}>{zoom.toFixed(1)}×</Text>
            <Pressable style={styles.zoomButton} onPress={() => setZoom((value) => clamp(value / 1.35, 1, 6))}><Text style={styles.zoomText}>−</Text></Pressable>
          </View>
          {!tracking ? <Pressable style={styles.resumeButton} onPress={() => { setView({ heading: sensors.heading, elevation: sensors.elevation }); setTracking(true); }}><Text style={styles.resumeText}>⌁ Resume live</Text></Pressable> : null}
        </View>

        <View style={styles.bottomPanel}>
          {selected ? <View style={styles.objectCard}><View><Text style={styles.objectName}>{selected.properName || selected.name}</Text><Text style={styles.objectMeta}>{selected.constellation || 'Star'} · mag {selected.mag.toFixed(2)} · alt {Math.round(selected.altitude)}°</Text></View><Pressable onPress={() => setSelected(null)}><Text style={styles.close}>×</Text></Pressable></View> : <Text style={styles.hint}>{tracking ? 'Aim your phone. Pinch to zoom or drag to explore.' : 'Manual view active. Tap Resume live to follow your phone.'}</Text>}
          {sensors.headingAccuracy < 2 && sensors.ready && tracking ? <Text style={styles.calibration}>Move the phone in a figure eight to calibrate the compass.</Text> : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

function MenuSwitch({ label, value, onChange }: { label: string; value: boolean; onChange(value: boolean): void }) {
  return <View style={styles.menuRow}><Text style={styles.menuLabel}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ false: '#243c4d', true: '#2b766f' }} thumbColor={value ? '#86efdf' : '#91a4b2'} /></View>;
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#030812' }, nightBackground: { backgroundColor: '#071526' }, safeArea: { flex: 1, paddingTop: NativeStatusBar.currentHeight || 0 },
  header: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 5 }, headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: { color: '#7d9bb3', fontSize: 10, fontWeight: '700', letterSpacing: 1.8 }, heading: { color: '#fff', fontSize: 29, fontWeight: '300', marginTop: 2, fontVariant: ['tabular-nums'] },
  elevationPill: { borderWidth: 1, borderColor: '#29465c', borderRadius: 14, paddingHorizontal: 11, paddingVertical: 7, alignItems: 'flex-end', backgroundColor: 'rgba(3,8,18,0.72)' }, elevationLabel: { color: '#7290a6', fontSize: 7, fontWeight: '700', letterSpacing: 1 }, elevationValue: { color: '#86efdf', fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  menuButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#29465c', backgroundColor: 'rgba(3,8,18,0.82)' }, menuButtonText: { color: '#dcecf7', fontSize: 20 },
  menuBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.22)' }, menu: { position: 'absolute', zIndex: 20, top: 72, right: 16, width: 270, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#31546b', backgroundColor: '#091725', shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }, menuHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }, menuTitle: { color: '#fff', fontWeight: '700', fontSize: 17 }, menuClose: { color: '#a9becd', fontSize: 28, lineHeight: 28, paddingLeft: 16 }, menuRow: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, menuLabel: { color: '#d6e5ee', fontSize: 14 }, menuDivider: { height: 1, backgroundColor: '#213a4b', marginVertical: 9 }, menuCamera: { paddingVertical: 9 }, menuCameraText: { color: '#86efdf', fontWeight: '600' },
  sky: { flex: 1, overflow: 'hidden' }, centerMessage: { position: 'absolute', top: '40%', left: 30, right: 30, alignItems: 'center', padding: 20, borderRadius: 18, backgroundColor: 'rgba(3,8,18,0.82)' }, centerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' }, centerCopy: { color: '#9bb1c3', textAlign: 'center', marginTop: 6, lineHeight: 19 },
  zoomControls: { position: 'absolute', right: 14, top: 14, alignItems: 'center', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#29465c', backgroundColor: 'rgba(3,8,18,0.78)' }, zoomButton: { width: 42, height: 40, alignItems: 'center', justifyContent: 'center' }, zoomText: { color: '#fff', fontSize: 25, fontWeight: '300' }, zoomValue: { color: '#86a0b4', fontSize: 10, fontVariant: ['tabular-nums'] },
  resumeButton: { position: 'absolute', top: 16, alignSelf: 'center', paddingHorizontal: 17, paddingVertical: 10, borderRadius: 22, backgroundColor: '#17665f', borderWidth: 1, borderColor: '#86efdf' }, resumeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  bottomPanel: { paddingHorizontal: 18, paddingTop: 7, paddingBottom: 12 }, hint: { color: '#9bb1c3', textAlign: 'center', fontSize: 13, marginBottom: 4 }, calibration: { color: '#efc87a', textAlign: 'center', fontSize: 11, marginTop: 5 }, objectCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(3,8,18,0.88)', borderWidth: 1, borderColor: '#29465c', borderRadius: 15, padding: 14 }, objectName: { color: '#fff', fontSize: 17, fontWeight: '600' }, objectMeta: { color: '#86a0b4', fontSize: 12, marginTop: 3 }, close: { color: '#86a0b4', fontSize: 27, paddingHorizontal: 8 },
});

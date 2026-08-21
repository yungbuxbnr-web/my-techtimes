
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  runOnJS,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SW, height: SH } = Dimensions.get('window');

interface SplashScreenProps {
  onComplete: () => void;
  mode?: 'full' | 'quick' | 'off';
  reduceMotion?: boolean;
}

export function SplashScreen({ onComplete, mode = 'full', reduceMotion = false }: SplashScreenProps) {
  const insets = useSafeAreaInsets();
  const isMounted = useRef(true);

  // Shared values — full mode
  const headlightOpacity = useSharedValue(0);
  const headlightScale = useSharedValue(0.3);
  const carRevealWidth = useSharedValue(0);
  const carOpacity = useSharedValue(0);
  const ring1Scale = useSharedValue(0);
  const ring1Opacity = useSharedValue(0);
  const ring2Scale = useSharedValue(0);
  const ring2Opacity = useSharedValue(0);
  const ring3Scale = useSharedValue(0);
  const ring3Opacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(12);
  const subtitleOpacity = useSharedValue(0);
  const creditOpacity = useSharedValue(0);
  const streakTranslateX = useSharedValue(-SW);
  const streakOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const containerOpacity = useSharedValue(1);

  const carWidth = Math.min(SW * 0.82, 500);
  const carHeight = carWidth * (160 / 400);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      cancelAnimation(headlightOpacity);
      cancelAnimation(headlightScale);
      cancelAnimation(carRevealWidth);
      cancelAnimation(carOpacity);
      cancelAnimation(ring1Scale);
      cancelAnimation(ring1Opacity);
      cancelAnimation(ring2Scale);
      cancelAnimation(ring2Opacity);
      cancelAnimation(ring3Scale);
      cancelAnimation(ring3Opacity);
      cancelAnimation(titleOpacity);
      cancelAnimation(titleTranslateY);
      cancelAnimation(subtitleOpacity);
      cancelAnimation(creditOpacity);
      cancelAnimation(streakTranslateX);
      cancelAnimation(streakOpacity);
      cancelAnimation(flashOpacity);
      cancelAnimation(containerOpacity);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const safeComplete = () => {
        if (isMounted.current) {
          console.log('SplashScreen: Animation complete, calling onComplete');
          onComplete();
        }
      };

      // OFF mode — immediate
      if (mode === 'off') {
        console.log('SplashScreen: mode=off, skipping animation');
        safeComplete();
        return;
      }

      // QUICK mode or reduceMotion
      if (mode === 'quick' || reduceMotion) {
        console.log('SplashScreen: mode=quick/reduceMotion, running quick animation');
        if (reduceMotion) {
          // Simple cross-fade only
          titleOpacity.value = withTiming(1, { duration: 300 });
          subtitleOpacity.value = withDelay(200, withTiming(1, { duration: 200 }));
          containerOpacity.value = withDelay(
            500,
            withTiming(0, { duration: 100 }, (finished) => {
              if (finished) runOnJS(safeComplete)();
            })
          );
        } else {
          // Quick mode: title → subtitle → streak → fade out
          titleOpacity.value = withTiming(1, { duration: 150 });
          subtitleOpacity.value = withDelay(150, withTiming(1, { duration: 150 }));
          // Light streak at 300ms
          streakOpacity.value = withDelay(300, withTiming(1, { duration: 30 }));
          streakTranslateX.value = withDelay(
            300,
            withTiming(SW, { duration: 180, easing: Easing.in(Easing.quad) })
          );
          flashOpacity.value = withDelay(
            300,
            withSequence(
              withTiming(0.08, { duration: 90 }),
              withTiming(0, { duration: 90 })
            )
          );
          containerOpacity.value = withDelay(
            450,
            withTiming(0, { duration: 100 }, (finished) => {
              if (finished) runOnJS(safeComplete)();
            })
          );
        }
        return;
      }

      // FULL mode
      console.log('SplashScreen: mode=full, running full Ignition Sweep animation');

      // Phase 2 — 0ms: Headlights emerge
      headlightOpacity.value = withTiming(1, { duration: 150 });
      headlightScale.value = withSpring(1, { damping: 12, stiffness: 180 });

      // Phase 3 — 150ms: Car silhouette reveal
      carOpacity.value = withDelay(150, withTiming(1, { duration: 50 }));
      carRevealWidth.value = withDelay(
        150,
        withTiming(carWidth, { duration: 500, easing: Easing.out(Easing.cubic) })
      );

      // Phase 4 — 650ms: Rings appear
      ring1Scale.value = withDelay(650, withSpring(1, { damping: 14, stiffness: 120 }));
      ring1Opacity.value = withDelay(650, withTiming(0.6, { duration: 100 }));
      ring2Scale.value = withDelay(730, withSpring(1, { damping: 14, stiffness: 120 }));
      ring2Opacity.value = withDelay(730, withTiming(0.4, { duration: 100 }));
      ring3Scale.value = withDelay(810, withSpring(1, { damping: 14, stiffness: 120 }));
      ring3Opacity.value = withDelay(810, withTiming(0.25, { duration: 100 }));

      // Phase 6 — 950ms: Title
      titleOpacity.value = withDelay(950, withTiming(1, { duration: 250 }));
      titleTranslateY.value = withDelay(950, withSpring(0, { damping: 14, stiffness: 120 }));

      // Phase 7 — 1100ms: Subtitle
      subtitleOpacity.value = withDelay(1100, withTiming(1, { duration: 200 }));

      // Phase 8 — 1200ms: Credit
      creditOpacity.value = withDelay(1200, withTiming(0.7, { duration: 200 }));

      // Phase 9 — 1450ms: Light streak
      streakOpacity.value = withDelay(1450, withTiming(1, { duration: 30 }));
      streakTranslateX.value = withDelay(
        1450,
        withTiming(SW, { duration: 280, easing: Easing.in(Easing.quad) })
      );
      flashOpacity.value = withDelay(
        1450,
        withSequence(
          withTiming(0.08, { duration: 140 }),
          withTiming(0, { duration: 140 })
        )
      );

      // Phase 10 — 1650ms: Fade out
      containerOpacity.value = withDelay(
        1650,
        withTiming(0, { duration: 200 }, (finished) => {
          if (finished) runOnJS(safeComplete)();
        })
      );
    } catch (e) {
      console.warn('IgnitionSweep: animation error, skipping', e);
      onComplete();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({ opacity: containerOpacity.value }));

  const headlightStyle = useAnimatedStyle(() => ({
    opacity: headlightOpacity.value,
    transform: [{ scaleX: headlightScale.value }],
  }));

  const carRevealStyle = useAnimatedStyle(() => ({
    width: carRevealWidth.value,
    opacity: carOpacity.value,
  }));

  const ring1Style = useAnimatedStyle(() => ({
    opacity: ring1Opacity.value,
    transform: [{ scale: ring1Scale.value }],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: ring2Opacity.value,
    transform: [{ scale: ring2Scale.value }],
  }));

  const ring3Style = useAnimatedStyle(() => ({
    opacity: ring3Opacity.value,
    transform: [{ scale: ring3Scale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));
  const creditStyle = useAnimatedStyle(() => ({ opacity: creditOpacity.value }));

  const streakStyle = useAnimatedStyle(() => ({
    opacity: streakOpacity.value,
    transform: [{ translateX: streakTranslateX.value }],
  }));

  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOpacity.value }));

  const isQuick = mode === 'quick' || reduceMotion;
  const isOff = mode === 'off';

  // For off mode, render nothing (effect fires immediately)
  if (isOff) {
    return <View style={[styles.container, { backgroundColor: '#050d1a' }]} />;
  }

  // Car vertical centre position (relative to content area)
  const carCentreY = SH * 0.42;

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <LinearGradient
        colors={['#050d1a', '#0a1f3d', '#050d1a']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Rings — behind car */}
      {!isQuick && (
        <View style={[styles.ringsContainer, { top: carCentreY - 95 - 10 }]}>
          <Animated.View style={[styles.ringWrapper, ring3Style]}>
            <Svg width={190} height={190} viewBox="0 0 190 190">
              <Circle
                cx="95"
                cy="95"
                r="95"
                stroke="#b3e5fc"
                strokeWidth="0.8"
                fill="none"
              />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.ringWrapper, ring2Style]}>
            <Svg width={150} height={150} viewBox="0 0 150 150">
              <Circle
                cx="75"
                cy="75"
                r="75"
                stroke="#81d4fa"
                strokeWidth="1"
                fill="none"
              />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.ringWrapper, ring1Style]}>
            <Svg width={110} height={110} viewBox="0 0 110 110">
              <Circle
                cx="55"
                cy="55"
                r="55"
                stroke="#4fc3f7"
                strokeWidth="1"
                fill="none"
              />
            </Svg>
          </Animated.View>
        </View>
      )}

      {/* Headlights */}
      {!isQuick && (
        <View style={[styles.headlightsContainer, { top: carCentreY - 20 }]}>
          <Animated.View style={[styles.headlightLeft, headlightStyle]} />
          <Animated.View style={[styles.headlightLeftGlow, headlightStyle]} />
          <Animated.View style={[styles.headlightRight, headlightStyle]} />
          <Animated.View style={[styles.headlightRightGlow, headlightStyle]} />
        </View>
      )}

      {/* Car silhouette */}
      {!isQuick && (
        <View style={[styles.carContainer, { top: carCentreY - carHeight / 2 }]}>
          <Animated.View style={[{ height: carHeight, overflow: 'hidden' }, carRevealStyle]}>
            <Svg
              width={carWidth}
              height={carHeight}
              viewBox="0 0 400 160"
            >
              <Path
                d="M 20,120 L 20,110 Q 20,100 30,100 L 80,100 Q 100,60 130,50 L 200,42 L 270,42 Q 300,42 320,55 L 360,100 L 370,100 Q 380,100 380,110 L 380,120 L 340,120 Q 340,140 320,140 Q 300,140 300,120 L 100,120 Q 100,140 80,140 Q 60,140 60,120 Z"
                stroke="#4fc3f7"
                strokeWidth="1.5"
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </Svg>
          </Animated.View>
        </View>
      )}

      {/* Text content */}
      <View style={[styles.textContainer, { top: isQuick ? SH * 0.42 : carCentreY + carHeight / 2 + 30 }]}>
        <Animated.Text style={[styles.title, titleStyle]}>
          TECH TIMES
        </Animated.Text>
        <Animated.Text style={[styles.subtitle, subtitleStyle]}>
          Workshop Performance &amp; Productivity
        </Animated.Text>
        {!isQuick && (
          <Animated.Text style={[styles.credit, creditStyle]}>
            Created by BNR
          </Animated.Text>
        )}
      </View>

      {/* Light streak */}
      <Animated.View style={[styles.streak, { top: isQuick ? SH * 0.42 : carCentreY }, streakStyle]} />

      {/* Flash overlay */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
    backgroundColor: '#050d1a',
  },
  ringsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headlightsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  headlightLeft: {
    width: 60,
    height: 2,
    backgroundColor: '#4fc3f7',
    marginRight: 30,
    borderRadius: 1,
  },
  headlightLeftGlow: {
    position: 'absolute',
    width: 80,
    height: 6,
    backgroundColor: '#4fc3f7',
    opacity: 0.15,
    marginRight: 30,
    borderRadius: 3,
    left: SW / 2 - 110,
  },
  headlightRight: {
    width: 60,
    height: 2,
    backgroundColor: '#4fc3f7',
    marginLeft: 30,
    borderRadius: 1,
  },
  headlightRightGlow: {
    position: 'absolute',
    width: 80,
    height: 6,
    backgroundColor: '#4fc3f7',
    opacity: 0.15,
    marginLeft: 30,
    borderRadius: 3,
    right: SW / 2 - 110,
  },
  carContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  textContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  title: {
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 6,
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#7ab8d4',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 10,
  },
  credit: {
    fontSize: 11,
    color: '#4a7a94',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 14,
  },
  streak: {
    position: 'absolute',
    left: -SW,
    width: SW,
    height: 1.5,
    backgroundColor: '#ffffff',
  },
  flash: {
    backgroundColor: '#ffffff',
    zIndex: 9999,
  },
});

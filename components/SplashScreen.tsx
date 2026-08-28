
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

  // Shared values
  const headlightOpacity = useSharedValue(0);
  const headlightScale = useSharedValue(0.3);
  const carRevealWidth = useSharedValue(0);
  const carOpacity = useSharedValue(0);

  // Rings — scale + rotate for sweep feel
  const ring1Scale = useSharedValue(0);
  const ring1Opacity = useSharedValue(0);
  const ring1Rotate = useSharedValue(-90);
  const ring2Scale = useSharedValue(0);
  const ring2Opacity = useSharedValue(0);
  const ring2Rotate = useSharedValue(-90);
  const ring3Scale = useSharedValue(0);
  const ring3Opacity = useSharedValue(0);
  const ring3Rotate = useSharedValue(-90);

  // Scan line
  const scanY = useSharedValue(0);
  const scanOpacity = useSharedValue(0);

  // Scan status text
  const scanTextOpacity = useSharedValue(0);

  // Title / subtitle / credit
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(12);
  const subtitleOpacity = useSharedValue(0);
  const creditOpacity = useSharedValue(0);

  // Light streak + flash
  const streakTranslateX = useSharedValue(-SW);
  const streakOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);

  // Container
  const containerOpacity = useSharedValue(1);

  const carWidth = Math.min(SW * 0.82, 500);
  const carHeight = carWidth * (180 / 500);

  // Cleanup on unmount
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
      cancelAnimation(ring1Rotate);
      cancelAnimation(ring2Scale);
      cancelAnimation(ring2Opacity);
      cancelAnimation(ring2Rotate);
      cancelAnimation(ring3Scale);
      cancelAnimation(ring3Opacity);
      cancelAnimation(ring3Rotate);
      cancelAnimation(scanY);
      cancelAnimation(scanOpacity);
      cancelAnimation(scanTextOpacity);
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

      // reduceMotion — simple cross-fade
      if (reduceMotion) {
        console.log('SplashScreen: reduceMotion=true, running minimal animation');
        titleOpacity.value = withTiming(1, { duration: 300 });
        subtitleOpacity.value = withDelay(200, withTiming(1, { duration: 200 }));
        containerOpacity.value = withDelay(
          500,
          withTiming(0, { duration: 100 }, (finished) => {
            if (finished) runOnJS(safeComplete)();
          })
        );
        return;
      }

      // QUICK mode — deliberate short premium sequence
      if (mode === 'quick') {
        console.log('SplashScreen: mode=quick, running quick animation');
        // 0ms: headlights flash on
        headlightOpacity.value = withTiming(1, { duration: 80 });
        headlightScale.value = withTiming(1, { duration: 80 });
        // 80ms: title fades in
        titleOpacity.value = withDelay(80, withTiming(1, { duration: 120 }));
        titleTranslateY.value = withDelay(80, withTiming(0, { duration: 120 }));
        // 150ms: subtitle fades in
        subtitleOpacity.value = withDelay(150, withTiming(1, { duration: 100 }));
        // 220ms: light streak fires
        streakOpacity.value = withDelay(220, withTiming(1, { duration: 20 }));
        streakTranslateX.value = withDelay(
          220,
          withTiming(SW, { duration: 180, easing: Easing.in(Easing.quad) })
        );
        flashOpacity.value = withDelay(
          220,
          withSequence(
            withTiming(0.07, { duration: 80 }),
            withTiming(0, { duration: 80 })
          )
        );
        // 350ms: fade out → onComplete
        containerOpacity.value = withDelay(
          350,
          withTiming(0, { duration: 80 }, (finished) => {
            if (finished) runOnJS(safeComplete)();
          })
        );
        return;
      }

      // FULL mode — Ignition Sweep
      console.log('SplashScreen: mode=full, running full Ignition Sweep animation');

      // 0ms: Headlights illuminate
      headlightOpacity.value = withTiming(1, { duration: 150 });
      headlightScale.value = withSpring(1, { damping: 12, stiffness: 180 });

      // 150ms: Car silhouette reveal
      carOpacity.value = withDelay(150, withTiming(1, { duration: 50 }));
      carRevealWidth.value = withDelay(
        150,
        withTiming(carWidth, { duration: 500, easing: Easing.out(Easing.cubic) })
      );

      // 650ms: Rings sweep in (staggered 80ms)
      ring1Scale.value = withDelay(650, withSpring(1, { damping: 14, stiffness: 120 }));
      ring1Opacity.value = withDelay(650, withTiming(0.55, { duration: 100 }));
      ring1Rotate.value = withDelay(
        650,
        withTiming(270, { duration: 600, easing: Easing.out(Easing.cubic) })
      );

      ring2Scale.value = withDelay(730, withSpring(1, { damping: 14, stiffness: 120 }));
      ring2Opacity.value = withDelay(730, withTiming(0.35, { duration: 100 }));
      ring2Rotate.value = withDelay(
        730,
        withTiming(270, { duration: 600, easing: Easing.out(Easing.cubic) })
      );

      ring3Scale.value = withDelay(810, withSpring(1, { damping: 14, stiffness: 120 }));
      ring3Opacity.value = withDelay(810, withTiming(0.2, { duration: 100 }));
      ring3Rotate.value = withDelay(
        810,
        withTiming(270, { duration: 600, easing: Easing.out(Easing.cubic) })
      );

      // 750ms: Scan line animates across car
      const halfH = carHeight / 2;
      scanY.value = -halfH;
      scanOpacity.value = withDelay(750, withTiming(0.7, { duration: 60 }));
      scanY.value = withDelay(
        750,
        withTiming(halfH, { duration: 300, easing: Easing.inOut(Easing.quad) })
      );

      // 850ms: Scan status text fades in, then out at 1000ms
      scanTextOpacity.value = withDelay(
        850,
        withSequence(
          withTiming(0.6, { duration: 100 }),
          withTiming(0.6, { duration: 200 }),
          withTiming(0, { duration: 150 })
        )
      );

      // Scan line fades out after sweep
      scanOpacity.value = withDelay(
        1050,
        withTiming(0, { duration: 100 })
      );

      // 950ms: Title fades + slides in
      titleOpacity.value = withDelay(950, withTiming(1, { duration: 250 }));
      titleTranslateY.value = withDelay(950, withSpring(0, { damping: 14, stiffness: 120 }));

      // 1100ms: Subtitle
      subtitleOpacity.value = withDelay(1100, withTiming(1, { duration: 200 }));

      // 1200ms: Credit
      creditOpacity.value = withDelay(1200, withTiming(0.7, { duration: 200 }));

      // 1450ms: Light streak
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

      // 1650ms: Fade out → onComplete
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
    transform: [
      { scale: ring1Scale.value },
      { rotate: `${ring1Rotate.value}deg` },
    ],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: ring2Opacity.value,
    transform: [
      { scale: ring2Scale.value },
      { rotate: `${ring2Rotate.value}deg` },
    ],
  }));

  const ring3Style = useAnimatedStyle(() => ({
    opacity: ring3Opacity.value,
    transform: [
      { scale: ring3Scale.value },
      { rotate: `${ring3Rotate.value}deg` },
    ],
  }));

  const scanLineStyle = useAnimatedStyle(() => ({
    opacity: scanOpacity.value,
    transform: [{ translateY: scanY.value }],
  }));

  const scanTextStyle = useAnimatedStyle(() => ({ opacity: scanTextOpacity.value }));

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

  if (isOff) {
    return <View style={[styles.container, { backgroundColor: '#050d1a' }]} />;
  }

  const carCentreY = SH * 0.42;

  // Headlight horizontal positions
  const leftDRLCentreX = SW * 0.5 - carWidth * 0.32;
  const rightDRLLeft = SW * 0.5 + carWidth * 0.32 - 40;

  // Scan line sits at carCentreY, translateY drives it from -halfH to +halfH
  const scanLineTop = carCentreY;

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <LinearGradient
        colors={['#050d1a', '#0a1f3d', '#050d1a']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Rings — behind car */}
      {!isQuick && (
        <View style={[styles.ringsContainer, { top: carCentreY - 95 }]}>
          <Animated.View style={[styles.ringWrapper, ring3Style]}>
            <Svg width={190} height={190} viewBox="0 0 190 190">
              <Circle cx="95" cy="95" r="92" stroke="#b3e5fc" strokeWidth="0.7" fill="none" />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.ringWrapper, ring2Style]}>
            <Svg width={150} height={150} viewBox="0 0 150 150">
              <Circle cx="75" cy="75" r="72" stroke="#81d4fa" strokeWidth="0.9" fill="none" />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.ringWrapper, ring1Style]}>
            <Svg width={110} height={110} viewBox="0 0 110 110">
              <Circle cx="55" cy="55" r="52" stroke="#4fc3f7" strokeWidth="1.2" fill="none" />
            </Svg>
          </Animated.View>
        </View>
      )}

      {/* DRL Headlights */}
      {!isQuick && (
        <>
          {/* Left DRL */}
          <Animated.View
            style={[
              styles.drlGroup,
              { top: carCentreY - 18, left: leftDRLCentreX - 20 },
              headlightStyle,
            ]}
          >
            {/* Glow behind */}
            <View style={styles.drlGlow} />
            {/* Main DRL bar */}
            <View style={styles.drlBar} />
            {/* Lower angled strip */}
            <View style={styles.drlLower} />
          </Animated.View>

          {/* Right DRL */}
          <Animated.View
            style={[
              styles.drlGroup,
              { top: carCentreY - 18, left: rightDRLLeft },
              headlightStyle,
            ]}
          >
            <View style={styles.drlGlow} />
            <View style={styles.drlBar} />
            <View style={styles.drlLower} />
          </Animated.View>
        </>
      )}

      {/* Car silhouette */}
      {!isQuick && (
        <View style={[styles.carContainer, { top: carCentreY - carHeight / 2 }]}>
          <Animated.View style={[{ height: carHeight, overflow: 'hidden' }, carRevealStyle]}>
            <Svg width={carWidth} height={carHeight} viewBox="0 0 500 180">
              {/* Floor reflection — mirrored body, very low opacity */}
              <Path
                d="M 30,148 L 30,138 Q 30,128 42,128 L 88,128 Q 108,128 118,122 L 148,90 Q 168,68 200,60 L 260,54 L 310,54 Q 340,54 358,66 L 390,100 L 408,110 Q 418,114 428,114 L 458,114 Q 468,114 470,124 L 470,138 L 470,148 Z"
                stroke="#4fc3f7"
                strokeWidth="0.5"
                fill="none"
                opacity="0.12"
                transform="scale(1,-1) translate(0,-296)"
              />
              {/* Main body */}
              <Path
                d="M 30,148 L 30,138 Q 30,128 42,128 L 88,128 Q 108,128 118,122 L 148,90 Q 168,68 200,60 L 260,54 L 310,54 Q 340,54 358,66 L 390,100 L 408,110 Q 418,114 428,114 L 458,114 Q 468,114 470,124 L 470,138 L 470,148 Z"
                stroke="#4fc3f7"
                strokeWidth="1.8"
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Left wheel arch */}
              <Circle cx="110" cy="148" r="28" stroke="#3a9cc4" strokeWidth="1.2" fill="none" />
              {/* Right wheel arch */}
              <Circle cx="390" cy="148" r="28" stroke="#3a9cc4" strokeWidth="1.2" fill="none" />
            </Svg>
          </Animated.View>
        </View>
      )}

      {/* Scan line */}
      {!isQuick && (
        <Animated.View
          style={[
            styles.scanLine,
            { top: scanLineTop, width: carWidth, left: (SW - carWidth) / 2 },
            scanLineStyle,
          ]}
        />
      )}

      {/* Scan status text */}
      {!isQuick && (
        <Animated.View
          style={[
            styles.scanTextContainer,
            { top: carCentreY + carHeight / 2 + 8 },
            scanTextStyle,
          ]}
        >
          <Text style={styles.scanTextLine1}>WORKSHOP SYSTEM</Text>
          <Text style={styles.scanTextLine2}>
            JOBS READY  ·  BILLING READY  ·  SCHEDULE READY
          </Text>
        </Animated.View>
      )}

      {/* Text content */}
      <View
        style={[
          styles.textContainer,
          { top: isQuick ? SH * 0.42 : carCentreY + carHeight / 2 + 44 },
        ]}
      >
        <Animated.Text style={[styles.title, titleStyle]}>TECH TIMES</Animated.Text>
        <Animated.Text style={[styles.subtitle, subtitleStyle]}>
          Workshop Performance &amp; Productivity
        </Animated.Text>
        {!isQuick && (
          <Animated.Text style={[styles.credit, creditStyle]}>Created by BNR</Animated.Text>
        )}
      </View>

      {/* Light streak */}
      <Animated.View
        style={[
          styles.streak,
          { top: isQuick ? SH * 0.42 : carCentreY },
          streakStyle,
        ]}
      />

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
  // DRL headlight group
  drlGroup: {
    position: 'absolute',
    width: 40,
    alignItems: 'center',
  },
  drlGlow: {
    position: 'absolute',
    width: 52,
    height: 14,
    backgroundColor: '#4fc3f7',
    opacity: 0.12,
    borderRadius: 7,
    top: -4,
  },
  drlBar: {
    width: 40,
    height: 2,
    backgroundColor: '#4fc3f7',
    borderRadius: 1,
  },
  drlLower: {
    width: 28,
    height: 1.5,
    backgroundColor: '#81d4fa',
    borderRadius: 1,
    marginTop: 4,
    opacity: 0.7,
    transform: [{ rotate: '-4deg' }],
  },
  carContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scanLine: {
    position: 'absolute',
    height: 1.5,
    backgroundColor: '#4fc3f7',
  },
  scanTextContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scanTextLine1: {
    fontSize: 9,
    letterSpacing: 2,
    color: '#4fc3f7',
    textAlign: 'center',
    fontWeight: '600',
  },
  scanTextLine2: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: '#4fc3f7',
    textAlign: 'center',
    marginTop: 3,
    fontWeight: '400',
  },
  textContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 7,
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#7ab8d4',
    letterSpacing: 2.5,
    textAlign: 'center',
    marginTop: 10,
  },
  credit: {
    fontSize: 10,
    color: '#4a7a94',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 16,
    opacity: 0.7,
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

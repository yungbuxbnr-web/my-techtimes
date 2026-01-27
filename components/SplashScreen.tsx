
import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  Easing,
  withRepeat,
} from 'react-native-reanimated';
import { Svg, Path, Circle, Rect, Line, Polygon, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SplashScreenProps {
  onComplete: () => void;
}

// Animated rotating gear
function AnimatedGear({ delay = 0, size = 80, x = 0, y = 0 }: { delay?: number; size?: number; x?: number; y?: number }) {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    // Scale in
    scale.value = withDelay(
      delay,
      withSpring(1, {
        damping: 10,
        stiffness: 100,
      })
    );

    // Continuous rotation
    rotation.value = withDelay(
      delay + 300,
      withRepeat(
        withTiming(360, {
          duration: 3000,
          easing: Easing.linear,
        }),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${rotation.value}deg` },
        { scale: scale.value },
      ],
    };
  });

  return (
    <Animated.View style={[{ width: size, height: size, position: 'absolute' }, animatedStyle]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Gear teeth */}
        <Path
          d="M50 10 L55 15 L55 25 L45 25 L45 15 Z
             M75 15 L80 20 L75 30 L65 25 Z
             M90 40 L90 50 L80 50 L80 40 Z
             M75 70 L80 80 L70 80 L65 75 Z
             M50 90 L55 85 L55 75 L45 75 L45 85 Z
             M25 70 L30 80 L20 80 L15 75 Z
             M10 40 L10 50 L20 50 L20 40 Z
             M25 15 L30 20 L25 30 L15 25 Z"
          fill="#FF6B35"
          stroke="#D84315"
          strokeWidth="1"
        />
        {/* Center circle */}
        <Circle cx="50" cy="50" r="25" fill="#FF6B35" stroke="#D84315" strokeWidth="2" />
        <Circle cx="50" cy="50" r="15" fill="#2c2c2c" stroke="#D84315" strokeWidth="2" />
        <Circle cx="50" cy="50" r="8" fill="#FF6B35" />
      </Svg>
    </Animated.View>
  );
}

// Animated wrench that swings in
function AnimatedWrench({ delay = 0 }: { delay?: number }) {
  const rotation = useSharedValue(-90);
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 200 }));
    
    translateY.value = withDelay(
      delay,
      withSpring(0, {
        damping: 8,
        stiffness: 80,
      })
    );

    rotation.value = withDelay(
      delay,
      withSequence(
        withSpring(15, { damping: 8 }),
        withSpring(-10, { damping: 8 }),
        withSpring(5, { damping: 8 }),
        withSpring(0, { damping: 10 })
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { rotate: `${rotation.value}deg` },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View style={[{ width: 60, height: 60, position: 'absolute', left: -80, top: -20 }, animatedStyle]}>
      <Svg width="60" height="60" viewBox="0 0 60 60">
        <Path
          d="M20 10 L20 35 L25 40 L30 35 L30 10 Z"
          fill="#2196F3"
          stroke="#1565C0"
          strokeWidth="2"
        />
        <Circle cx="25" cy="8" r="8" fill="#2196F3" stroke="#1565C0" strokeWidth="2" />
        <Circle cx="25" cy="8" r="4" fill="none" stroke="#1565C0" strokeWidth="2" />
        <Path
          d="M22 40 L22 50 L28 50 L28 40 Z"
          fill="#2196F3"
          stroke="#1565C0"
          strokeWidth="2"
        />
      </Svg>
    </Animated.View>
  );
}

// Animated screwdriver
function AnimatedScrewdriver({ delay = 0 }: { delay?: number }) {
  const translateX = useSharedValue(100);
  const rotation = useSharedValue(45);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 200 }));
    
    translateX.value = withDelay(
      delay,
      withSpring(0, {
        damping: 8,
        stiffness: 80,
      })
    );

    rotation.value = withDelay(
      delay,
      withSequence(
        withSpring(-15, { damping: 8 }),
        withSpring(10, { damping: 8 }),
        withSpring(-5, { damping: 8 }),
        withSpring(0, { damping: 10 })
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { rotate: `${rotation.value}deg` },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View style={[{ width: 60, height: 60, position: 'absolute', right: -80, top: -20 }, animatedStyle]}>
      <Svg width="60" height="60" viewBox="0 0 60 60">
        <Rect x="22" y="5" width="6" height="30" rx="1" fill="#FFC107" stroke="#F57C00" strokeWidth="1.5" />
        <Path
          d="M20 35 L20 50 L30 50 L30 35 Z"
          fill="#D84315"
          stroke="#BF360C"
          strokeWidth="1.5"
        />
        <Rect x="23" y="48" width="4" height="8" fill="#BF360C" />
      </Svg>
    </Animated.View>
  );
}

// Animated spark particles
function AnimatedSpark({ delay = 0, x = 0, y = 0 }: { delay?: number; x?: number; y?: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(1.5, { duration: 200 }),
        withTiming(0, { duration: 300 })
      )
    );

    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 400 })
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View style={[{ width: 20, height: 20, position: 'absolute' }, animatedStyle]}>
      <Svg width="20" height="20" viewBox="0 0 20 20">
        <Circle cx="10" cy="10" r="3" fill="#FFD700" />
        <Line x1="10" y1="2" x2="10" y2="6" stroke="#FFD700" strokeWidth="2" />
        <Line x1="10" y1="14" x2="10" y2="18" stroke="#FFD700" strokeWidth="2" />
        <Line x1="2" y1="10" x2="6" y2="10" stroke="#FFD700" strokeWidth="2" />
        <Line x1="14" y1="10" x2="18" y2="10" stroke="#FFD700" strokeWidth="2" />
      </Svg>
    </Animated.View>
  );
}

// Animated piston
function AnimatedPiston({ delay = 0 }: { delay?: number }) {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withSpring(1, {
        damping: 10,
        stiffness: 100,
      })
    );

    translateY.value = withDelay(
      delay + 500,
      withRepeat(
        withSequence(
          withTiming(-15, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  return (
    <Animated.View style={[{ width: 40, height: 80, position: 'absolute', bottom: -100 }, animatedStyle]}>
      <Svg width="40" height="80" viewBox="0 0 40 80">
        <Rect x="12" y="0" width="16" height="50" rx="2" fill="#9E9E9E" stroke="#616161" strokeWidth="2" />
        <Circle cx="20" cy="55" r="12" fill="#424242" stroke="#212121" strokeWidth="2" />
        <Circle cx="20" cy="55" r="6" fill="#9E9E9E" />
      </Svg>
    </Animated.View>
  );
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.8);
  const subtitleOpacity = useSharedValue(0);
  const subtitleTranslateY = useSharedValue(20);
  const fadeOut = useSharedValue(1);

  useEffect(() => {
    console.log('SplashScreen: Starting mechanic-themed startup animation');

    // Animate title in (after gears and tools appear)
    titleOpacity.value = withDelay(
      1800,
      withTiming(1, { duration: 600 })
    );
    titleScale.value = withDelay(
      1800,
      withSpring(1, { damping: 10, stiffness: 100 })
    );

    // Animate subtitle in
    subtitleOpacity.value = withDelay(
      2200,
      withTiming(1, { duration: 600 })
    );
    subtitleTranslateY.value = withDelay(
      2200,
      withSpring(0, { damping: 12 })
    );

    // Fade out entire splash screen
    fadeOut.value = withDelay(
      3800,
      withTiming(0, { duration: 500 }, (finished) => {
        if (finished) {
          runOnJS(onComplete)();
        }
      })
    );
  }, []);

  const titleStyle = useAnimatedStyle(() => {
    return {
      opacity: titleOpacity.value,
      transform: [{ scale: titleScale.value }],
    };
  });

  const subtitleStyle = useAnimatedStyle(() => {
    return {
      opacity: subtitleOpacity.value,
      transform: [{ translateY: subtitleTranslateY.value }],
    };
  });

  const containerStyle = useAnimatedStyle(() => {
    return {
      opacity: fadeOut.value,
    };
  });

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <LinearGradient
        colors={['#1a1a1a', '#2c2c2c', '#1a1a1a']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.content}>
        {/* Central gear cluster */}
        <View style={styles.gearCluster}>
          <AnimatedGear delay={200} size={100} x={0} y={0} />
          <AnimatedGear delay={400} size={70} x={60} y={-30} />
          <AnimatedGear delay={600} size={60} x={-50} y={40} />
          
          {/* Tools */}
          <AnimatedWrench delay={800} />
          <AnimatedScrewdriver delay={1000} />
          
          {/* Piston */}
          <AnimatedPiston delay={1200} />
          
          {/* Sparks */}
          <AnimatedSpark delay={1400} x={-40} y={-50} />
          <AnimatedSpark delay={1500} x={50} y={-40} />
          <AnimatedSpark delay={1600} x={0} y={60} />
        </View>
        
        <Animated.View style={[styles.titleContainer, titleStyle]}>
          <Text style={styles.title}>TechTimes</Text>
        </Animated.View>
        
        <Animated.View style={subtitleStyle}>
          <Text style={styles.subtitle}>Vehicle Technician Job Tracker</Text>
        </Animated.View>
      </View>
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
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gearCluster: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  titleContainer: {
    marginTop: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2,
    textShadowColor: '#FF6B35',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#cccccc',
    letterSpacing: 1,
    marginTop: 12,
  },
});


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
} from 'react-native-reanimated';
import { Svg, Path, Circle, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SplashScreenProps {
  onComplete: () => void;
}

// Animated car component
function AnimatedCar() {
  const translateX = useSharedValue(-200);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Car drives across the screen
    translateX.value = withTiming(SCREEN_WIDTH + 100, {
      duration: 2000,
      easing: Easing.inOut(Easing.ease),
    });

    // Fade out near the end
    opacity.value = withDelay(
      1600,
      withTiming(0, { duration: 400 })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View style={[{ width: 120, height: 60 }, animatedStyle]}>
      <Svg width="120" height="60" viewBox="0 0 120 60">
        {/* Car body */}
        <Path
          d="M20 35 L30 20 L70 20 L80 35 Z"
          fill="#2196F3"
          stroke="#1976D2"
          strokeWidth="2"
        />
        <Rect
          x="15"
          y="35"
          width="75"
          height="10"
          rx="2"
          fill="#2196F3"
          stroke="#1976D2"
          strokeWidth="2"
        />
        
        {/* Windows */}
        <Path
          d="M35 25 L40 25 L40 33 L35 33 Z"
          fill="#64B5F6"
        />
        <Path
          d="M55 25 L65 25 L65 33 L55 33 Z"
          fill="#64B5F6"
        />
        
        {/* Wheels */}
        <Circle cx="30" cy="50" r="8" fill="#333" stroke="#000" strokeWidth="2" />
        <Circle cx="30" cy="50" r="4" fill="#666" />
        <Circle cx="70" cy="50" r="8" fill="#333" stroke="#000" strokeWidth="2" />
        <Circle cx="70" cy="50" r="4" fill="#666" />
        
        {/* Headlight */}
        <Circle cx="88" cy="38" r="3" fill="#FFD700" />
      </Svg>
    </Animated.View>
  );
}

// Animated wrench icon
function AnimatedWrench() {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    // Scale in
    scale.value = withDelay(
      2200,
      withSpring(1, {
        damping: 10,
        stiffness: 100,
      })
    );

    // Rotate animation
    rotation.value = withSequence(
      withDelay(2500, withSpring(15, { damping: 8 })),
      withSpring(-15, { damping: 8 }),
      withSpring(10, { damping: 8 }),
      withSpring(0, { damping: 8 })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${rotation.value}deg` },
        { scale: scale.value },
      ],
    };
  });

  return (
    <Animated.View style={[{ width: 120, height: 120 }, animatedStyle]}>
      <Svg width="120" height="120" viewBox="0 0 120 120">
        {/* Wrench body */}
        <Path
          d="M40 30 L40 70 L50 80 L60 70 L60 30 Z"
          fill="#2196F3"
          stroke="#1976D2"
          strokeWidth="2"
        />
        {/* Wrench head */}
        <Circle cx="50" cy="25" r="15" fill="#2196F3" stroke="#1976D2" strokeWidth="2" />
        <Circle cx="50" cy="25" r="8" fill="none" stroke="#1976D2" strokeWidth="2" />
        {/* Wrench handle */}
        <Path
          d="M45 80 L45 95 L55 95 L55 80 Z"
          fill="#2196F3"
          stroke="#1976D2"
          strokeWidth="2"
        />
      </Svg>
    </Animated.View>
  );
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const subtitleOpacity = useSharedValue(0);
  const subtitleTranslateY = useSharedValue(20);
  const fadeOut = useSharedValue(1);

  useEffect(() => {
    console.log('SplashScreen: Starting startup animation with car drive-by');

    // Animate title in (after car passes)
    titleOpacity.value = withDelay(
      2700,
      withTiming(1, { duration: 600 })
    );
    titleTranslateY.value = withDelay(
      2700,
      withSpring(0, { damping: 12 })
    );

    // Animate subtitle in
    subtitleOpacity.value = withDelay(
      3000,
      withTiming(1, { duration: 600 })
    );
    subtitleTranslateY.value = withDelay(
      3000,
      withSpring(0, { damping: 12 })
    );

    // Fade out entire splash screen
    fadeOut.value = withDelay(
      4200,
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
      transform: [{ translateY: titleTranslateY.value }],
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
      
      {/* Car drive-by animation at the top */}
      <View style={styles.carContainer}>
        <AnimatedCar />
      </View>
      
      <View style={styles.content}>
        <AnimatedWrench />
        
        <Animated.View style={titleStyle}>
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
  carContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    height: 60,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 16,
    color: '#cccccc',
    letterSpacing: 1,
  },
});

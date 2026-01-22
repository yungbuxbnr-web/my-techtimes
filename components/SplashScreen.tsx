
import React, { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { Svg, Path, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

interface SplashScreenProps {
  onComplete: () => void;
}

// Animated wrench icon
function AnimatedWrench() {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    // Scale in
    scale.value = withSpring(1, {
      damping: 10,
      stiffness: 100,
    });

    // Rotate animation
    rotation.value = withSequence(
      withDelay(300, withSpring(15, { damping: 8 })),
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
    console.log('SplashScreen: Starting startup animation');

    // Animate title in
    titleOpacity.value = withDelay(
      500,
      withTiming(1, { duration: 600 })
    );
    titleTranslateY.value = withDelay(
      500,
      withSpring(0, { damping: 12 })
    );

    // Animate subtitle in
    subtitleOpacity.value = withDelay(
      800,
      withTiming(1, { duration: 600 })
    );
    subtitleTranslateY.value = withDelay(
      800,
      withSpring(0, { damping: 12 })
    );

    // Fade out entire splash screen
    fadeOut.value = withDelay(
      2000,
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

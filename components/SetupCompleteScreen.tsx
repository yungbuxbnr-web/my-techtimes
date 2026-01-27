
import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Svg, Path, Circle, Rect, Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SetupCompleteScreenProps {
  technicianName: string;
  onComplete: () => void;
}

// Engine component parts
function EnginePart({ 
  children, 
  delay, 
  targetX, 
  targetY 
}: { 
  children: React.ReactNode; 
  delay: number; 
  targetX: number; 
  targetY: number;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Explode outward
    translateX.value = withDelay(
      delay,
      withSpring(targetX, {
        damping: 12,
        stiffness: 80,
      })
    );
    translateY.value = withDelay(
      delay,
      withSpring(targetY, {
        damping: 12,
        stiffness: 80,
      })
    );

    // Fade back in (implode back to center)
    translateX.value = withDelay(
      delay + 1500,
      withSpring(0, {
        damping: 15,
        stiffness: 100,
      })
    );
    translateY.value = withDelay(
      delay + 1500,
      withSpring(0, {
        damping: 15,
        stiffness: 100,
      })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
      opacity: opacity.value,
    };
  });

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

// Animated exploded engine view
function ExplodedEngineView() {
  const containerScale = useSharedValue(0);

  useEffect(() => {
    // Scale in the entire engine
    containerScale.value = withSpring(1, {
      damping: 10,
      stiffness: 100,
    });
  }, []);

  const containerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: containerScale.value }],
    };
  });

  return (
    <Animated.View style={[{ width: 200, height: 200 }, containerStyle]}>
      <Svg width="200" height="200" viewBox="0 0 200 200">
        {/* Center engine block (doesn't move) */}
        <Rect
          x="75"
          y="75"
          width="50"
          height="50"
          rx="4"
          fill="#424242"
          stroke="#212121"
          strokeWidth="2"
        />
        
        {/* Piston 1 - Top Left */}
        <EnginePart delay={200} targetX={-40} targetY={-40}>
          <Svg width="200" height="200" viewBox="0 0 200 200">
            <Circle cx="70" cy="70" r="12" fill="#2196F3" stroke="#1976D2" strokeWidth="2" />
            <Rect x="64" y="70" width="12" height="20" fill="#2196F3" stroke="#1976D2" strokeWidth="1" />
          </Svg>
        </EnginePart>
        
        {/* Piston 2 - Top Right */}
        <EnginePart delay={300} targetX={40} targetY={-40}>
          <Svg width="200" height="200" viewBox="0 0 200 200">
            <Circle cx="130" cy="70" r="12" fill="#2196F3" stroke="#1976D2" strokeWidth="2" />
            <Rect x="124" y="70" width="12" height="20" fill="#2196F3" stroke="#1976D2" strokeWidth="1" />
          </Svg>
        </EnginePart>
        
        {/* Spark Plug - Top */}
        <EnginePart delay={400} targetX={0} targetY={-50}>
          <Svg width="200" height="200" viewBox="0 0 200 200">
            <Rect x="95" y="40" width="10" height="30" fill="#FFD700" stroke="#FFA000" strokeWidth="2" />
            <Circle cx="100" cy="38" r="6" fill="#FFD700" stroke="#FFA000" strokeWidth="2" />
          </Svg>
        </EnginePart>
        
        {/* Oil Filter - Left */}
        <EnginePart delay={500} targetX={-60} targetY={0}>
          <Svg width="200" height="200" viewBox="0 0 200 200">
            <Circle cx="40" cy="100" r="15" fill="#FF5722" stroke="#D84315" strokeWidth="2" />
            <Line x1="30" y1="100" x2="50" y2="100" stroke="#D84315" strokeWidth="2" />
            <Line x1="40" y1="90" x2="40" y2="110" stroke="#D84315" strokeWidth="2" />
          </Svg>
        </EnginePart>
        
        {/* Alternator - Right */}
        <EnginePart delay={600} targetX={60} targetY={0}>
          <Svg width="200" height="200" viewBox="0 0 200 200">
            <Circle cx="160" cy="100" r="18" fill="#4CAF50" stroke="#388E3C" strokeWidth="2" />
            <Circle cx="160" cy="100" r="10" fill="none" stroke="#388E3C" strokeWidth="2" />
          </Svg>
        </EnginePart>
        
        {/* Exhaust Manifold - Bottom Left */}
        <EnginePart delay={700} targetX={-40} targetY={40}>
          <Svg width="200" height="200" viewBox="0 0 200 200">
            <Path
              d="M60 130 Q50 140 60 150"
              fill="none"
              stroke="#9E9E9E"
              strokeWidth="6"
            />
          </Svg>
        </EnginePart>
        
        {/* Intake Manifold - Bottom Right */}
        <EnginePart delay={800} targetX={40} targetY={40}>
          <Svg width="200" height="200" viewBox="0 0 200 200">
            <Path
              d="M140 130 Q150 140 140 150"
              fill="none"
              stroke="#9E9E9E"
              strokeWidth="6"
            />
          </Svg>
        </EnginePart>
        
        {/* Timing Belt - Bottom */}
        <EnginePart delay={900} targetX={0} targetY={50}>
          <Svg width="200" height="200" viewBox="0 0 200 200">
            <Rect x="85" y="140" width="30" height="8" rx="2" fill="#212121" stroke="#000" strokeWidth="1" />
          </Svg>
        </EnginePart>
      </Svg>
    </Animated.View>
  );
}

export function SetupCompleteScreen({ technicianName, onComplete }: SetupCompleteScreenProps) {
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(20);
  const welcomeOpacity = useSharedValue(0);
  const welcomeScale = useSharedValue(0.8);
  const fadeOut = useSharedValue(1);

  useEffect(() => {
    console.log('SetupCompleteScreen: Starting exploded engine animation');

    // Animate title in (after engine explodes)
    titleOpacity.value = withDelay(
      2800,
      withTiming(1, { duration: 600 })
    );
    titleTranslateY.value = withDelay(
      2800,
      withSpring(0, { damping: 12 })
    );

    // Animate welcome message
    welcomeOpacity.value = withDelay(
      3200,
      withTiming(1, { duration: 600 })
    );
    welcomeScale.value = withDelay(
      3200,
      withSpring(1, { damping: 10 })
    );

    // Fade out entire screen
    fadeOut.value = withDelay(
      5000,
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

  const welcomeStyle = useAnimatedStyle(() => {
    return {
      opacity: welcomeOpacity.value,
      transform: [{ scale: welcomeScale.value }],
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
        <ExplodedEngineView />
        
        <Animated.View style={titleStyle}>
          <Text style={styles.title}>App Now Set Up!</Text>
        </Animated.View>
        
        <Animated.View style={welcomeStyle}>
          <Text style={styles.welcomeText}>Welcome,</Text>
          <Text style={styles.nameText}>{technicianName}</Text>
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
    gap: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4CAF50',
    letterSpacing: 1,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 24,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 8,
  },
  nameText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2196F3',
    textAlign: 'center',
    letterSpacing: 1,
  },
});

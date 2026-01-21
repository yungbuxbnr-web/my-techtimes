
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { IconSymbol } from './IconSymbol';
import * as Haptics from 'expo-haptics';
import { Svg, Path } from 'react-native-svg';

interface ProcessNotificationProps {
  visible: boolean;
  title: string;
  message?: string;
  progress?: number;
  total?: number;
  onComplete?: () => void;
  type?: 'loading' | 'success' | 'error';
}

// Doodle animation component
function DoodleAnimation() {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withSequence(
        withTiming(10, { duration: 500 }),
        withTiming(-10, { duration: 500 })
      ),
      -1,
      true
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 600 }),
        withTiming(0.9, { duration: 600 })
      ),
      -1,
      true
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
    <Animated.View style={[{ width: 80, height: 80 }, animatedStyle]}>
      <Svg width="80" height="80" viewBox="0 0 80 80">
        <Path
          d="M40 10 C20 10, 10 20, 10 40 C10 60, 20 70, 40 70 C60 70, 70 60, 70 40 C70 20, 60 10, 40 10 M30 35 L35 35 M45 35 L50 35 M30 50 Q40 55, 50 50"
          stroke="#2196F3"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
}

export function ProcessNotification({
  visible,
  title,
  message,
  progress,
  total,
  onComplete,
  type = 'loading',
}: ProcessNotificationProps) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      console.log('ProcessNotification: Showing notification -', title);
      
      // Haptic feedback on show
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Animate in
      scale.value = withSpring(1, {
        damping: 12,
        stiffness: 150,
      });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      // Animate out
      scale.value = withTiming(0, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 }, () => {
        if (onComplete) {
          runOnJS(onComplete)();
        }
      });
    }
  }, [visible, title]);

  useEffect(() => {
    if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [type]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    };
  });

  if (!visible) {
    return null;
  }

  const progressPercentage = progress !== undefined && total !== undefined && total > 0
    ? Math.round((progress / total) * 100)
    : 0;

  const progressText = progress !== undefined && total !== undefined
    ? `${progress} / ${total}`
    : '';

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <View style={styles.content}>
          {type === 'loading' && <DoodleAnimation />}
          {type === 'success' && (
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={48}
              color="#4CAF50"
            />
          )}
          {type === 'error' && (
            <IconSymbol
              ios_icon_name="xmark.circle.fill"
              android_material_icon_name="error"
              size={48}
              color="#f44336"
            />
          )}
          
          <Text style={styles.title}>{title}</Text>
          
          {message && <Text style={styles.message}>{message}</Text>}
          
          {progress !== undefined && total !== undefined && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressPercentage}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{progressText}</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 32,
    minWidth: 280,
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    gap: 8,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
    textAlign: 'center',
  },
});

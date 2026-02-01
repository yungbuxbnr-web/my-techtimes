
import React, { useRef, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  View,
  StyleSheet,
  ScrollView,
  ViewStyle,
  Animated,
  Keyboard,
} from 'react-native';
import { useKeyboard, calculateSafeAreaInsets } from '@/utils/keyboardManager';

interface AdaptiveKeyboardViewProps {
  children: React.ReactNode;
  hasTabBar?: boolean;
  hasHeader?: boolean;
  inputPosition?: 'top' | 'middle' | 'bottom';
  customOffset?: number;
  style?: ViewStyle;
  scrollEnabled?: boolean;
  contentContainerStyle?: ViewStyle;
}

/**
 * AI-powered adaptive keyboard view that automatically adjusts layout
 * to prevent keyboard from covering inputs, buttons, and tabs
 */
export function AdaptiveKeyboardView({
  children,
  hasTabBar = false,
  hasHeader = true,
  inputPosition = 'bottom',
  customOffset = 0,
  style,
  scrollEnabled = true,
  contentContainerStyle,
}: AdaptiveKeyboardViewProps) {
  const {
    isKeyboardVisible,
    keyboardHeight,
    optimalOffset,
    screenDimensions,
  } = useKeyboard({
    hasTabBar,
    hasHeader,
    inputPosition,
    customOffset,
  });
  
  const safeAreaInsets = calculateSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const animatedPadding = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    console.log('AdaptiveKeyboardView: Keyboard visibility changed:', isKeyboardVisible);
    
    // Animate padding when keyboard appears/disappears
    Animated.timing(animatedPadding, {
      toValue: isKeyboardVisible ? keyboardHeight : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
    
    // Auto-scroll to bottom when keyboard appears (for bottom inputs)
    if (isKeyboardVisible && scrollEnabled && inputPosition === 'bottom') {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [isKeyboardVisible, keyboardHeight, inputPosition, scrollEnabled, animatedPadding]);
  
  // Calculate dynamic padding to prevent content from being hidden
  const dynamicPaddingBottom = isKeyboardVisible
    ? Math.max(keyboardHeight - safeAreaInsets.bottom, 0)
    : safeAreaInsets.bottom;
  
  const containerStyle: ViewStyle = {
    flex: 1,
    paddingTop: safeAreaInsets.top,
    paddingLeft: safeAreaInsets.left,
    paddingRight: safeAreaInsets.right,
  };
  
  const contentStyle: ViewStyle = {
    paddingBottom: dynamicPaddingBottom + (hasTabBar ? 60 : 0),
  };
  
  console.log('AdaptiveKeyboardView: Rendering with offset:', optimalOffset, 'keyboard height:', keyboardHeight);
  
  if (Platform.OS === 'ios') {
    // iOS: Use KeyboardAvoidingView with padding behavior
    return (
      <KeyboardAvoidingView
        behavior="padding"
        style={[containerStyle, style]}
        keyboardVerticalOffset={optimalOffset}
      >
        {scrollEnabled ? (
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={[contentStyle, contentContainerStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={(width, height) => {
              setContentHeight(height);
              console.log('AdaptiveKeyboardView: Content size changed:', height);
            }}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.container, contentStyle, contentContainerStyle]}>
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    );
  } else {
    // Android: Use custom implementation with animated padding
    return (
      <View style={[containerStyle, style]}>
        {scrollEnabled ? (
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={[contentStyle, contentContainerStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={(width, height) => {
              setContentHeight(height);
              console.log('AdaptiveKeyboardView: Content size changed:', height);
            }}
          >
            {children}
          </ScrollView>
        ) : (
          <Animated.View
            style={[
              styles.container,
              contentStyle,
              contentContainerStyle,
              { paddingBottom: animatedPadding },
            ]}
          >
            {children}
          </Animated.View>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
});

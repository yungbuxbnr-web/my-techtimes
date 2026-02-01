
import React, { useRef, useEffect, useState } from 'react';
import {
  TextInput,
  TextInputProps,
  View,
  StyleSheet,
  Animated,
  Platform,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { KeyboardManager } from '@/utils/keyboardManager';

interface SmartTextInputProps extends TextInputProps {
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  autoAdjust?: boolean;
  minVisibleHeight?: number;
}

/**
 * Smart text input that automatically adjusts its position
 * to stay visible above the keyboard
 */
export function SmartTextInput({
  containerStyle,
  inputStyle,
  autoAdjust = true,
  minVisibleHeight = 100,
  onFocus,
  onBlur,
  ...textInputProps
}: SmartTextInputProps) {
  const inputRef = useRef<TextInput>(null);
  const containerRef = useRef<View>(null);
  const [isFocused, setIsFocused] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (!autoAdjust) {
      return;
    }
    
    const manager = KeyboardManager.getInstance();
    
    const unsubscribe = manager.subscribe((keyboardState) => {
      if (!isFocused || !keyboardState.isVisible) {
        // Reset position when keyboard hides or input loses focus
        Animated.timing(translateY, {
          toValue: 0,
          duration: keyboardState.duration,
          useNativeDriver: true,
        }).start();
        return;
      }
      
      // Measure input position
      containerRef.current?.measureInWindow((x, y, width, height) => {
        console.log('SmartTextInput: Measured position:', { x, y, width, height });
        
        const isElementCovered = manager.isElementCovered(y, height);
        
        if (isElementCovered) {
          const scrollOffset = manager.calculateScrollOffset(y, height, minVisibleHeight);
          
          console.log('SmartTextInput: Input is covered, adjusting by:', -scrollOffset);
          
          Animated.timing(translateY, {
            toValue: -scrollOffset,
            duration: keyboardState.duration,
            useNativeDriver: true,
          }).start();
        }
      });
    });
    
    return () => {
      unsubscribe();
    };
  }, [isFocused, autoAdjust, minVisibleHeight, translateY]);
  
  const handleFocus = (e: any) => {
    console.log('SmartTextInput: Input focused');
    setIsFocused(true);
    onFocus?.(e);
  };
  
  const handleBlur = (e: any) => {
    console.log('SmartTextInput: Input blurred');
    setIsFocused(false);
    onBlur?.(e);
  };
  
  return (
    <Animated.View
      ref={containerRef}
      style={[
        styles.container,
        containerStyle,
        autoAdjust && { transform: [{ translateY }] },
      ]}
    >
      <TextInput
        ref={inputRef}
        style={[styles.input, inputStyle]}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...textInputProps}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  input: {
    width: '100%',
  },
});

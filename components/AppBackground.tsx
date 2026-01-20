
import React, { ReactNode } from 'react';
import { View, ImageBackground, StyleSheet, ViewStyle } from 'react-native';
import { useThemeContext } from '@/contexts/ThemeContext';

interface AppBackgroundProps {
  children: ReactNode;
  style?: ViewStyle;
}

export default function AppBackground({ children, style }: AppBackgroundProps) {
  const { backgroundImage, overlayStrength, isDarkMode } = useThemeContext();

  return (
    <ImageBackground
      source={backgroundImage}
      style={[styles.background, style]}
      resizeMode="cover"
    >
      <View 
        style={[
          styles.overlay, 
          { 
            backgroundColor: isDarkMode 
              ? `rgba(0, 0, 0, ${overlayStrength})` 
              : `rgba(255, 255, 255, ${overlayStrength})`
          }
        ]} 
      />
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});

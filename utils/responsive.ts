
import { useState, useEffect } from 'react';
import { Dimensions, Platform, ScaledSize } from 'react-native';

export interface ResponsiveLayout {
  isLandscape: boolean;
  isTablet: boolean;
  isPhone: boolean;
  screenWidth: number;
  screenHeight: number;
  smallestWidth: number;
}

export function useResponsiveLayout(): ResponsiveLayout {
  const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    
    return () => subscription?.remove();
  }, []);
  
  const { width, height } = dimensions;
  const smallestWidth = Math.min(width, height);
  
  const isLandscape = width > height;
  const isTablet = smallestWidth >= 600 || width >= 768;
  const isPhone = !isTablet;
  
  return {
    isLandscape,
    isTablet,
    isPhone,
    screenWidth: width,
    screenHeight: height,
    smallestWidth,
  };
}

export function getResponsiveValue<T>(
  phone: T,
  tablet: T,
  landscape: T | undefined,
  layout: ResponsiveLayout
): T {
  if (layout.isLandscape && landscape !== undefined) {
    return landscape;
  }
  
  return layout.isTablet ? tablet : phone;
}

export function getCardWidth(layout: ResponsiveLayout): string | number {
  if (layout.isTablet) {
    return layout.isLandscape ? '48%' : '100%';
  }
  return layout.isLandscape ? '48%' : '100%';
}

export function getColumnCount(layout: ResponsiveLayout): number {
  if (layout.isTablet) {
    return layout.isLandscape ? 3 : 2;
  }
  return layout.isLandscape ? 2 : 1;
}

export function getPadding(layout: ResponsiveLayout): number {
  if (layout.isTablet) {
    return 24;
  }
  return 16;
}

export function getFontSize(base: number, layout: ResponsiveLayout): number {
  if (layout.isTablet) {
    return base * 1.2;
  }
  return base;
}

export function getSpacing(layout: ResponsiveLayout): number {
  if (layout.isTablet) {
    return layout.isLandscape ? 32 : 24;
  }
  return layout.isLandscape ? 20 : 16;
}

export function getCardPadding(layout: ResponsiveLayout): number {
  if (layout.isTablet) {
    return 24;
  }
  return 20;
}

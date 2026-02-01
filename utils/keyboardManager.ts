
import { Keyboard, Platform, Dimensions, KeyboardEvent } from 'react-native';
import { useState, useEffect } from 'react';

export interface KeyboardState {
  isVisible: boolean;
  height: number;
  duration: number;
  easing: string;
}

export interface ScreenDimensions {
  width: number;
  height: number;
  scale: number;
  fontScale: number;
}

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * AI-powered keyboard manager that intelligently calculates safe offsets
 * to prevent keyboard from covering input fields, buttons, and tabs
 */
export class KeyboardManager {
  private static instance: KeyboardManager;
  private keyboardState: KeyboardState = {
    isVisible: false,
    height: 0,
    duration: 250,
    easing: 'keyboard',
  };
  
  private screenDimensions: ScreenDimensions = {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    scale: Dimensions.get('window').scale,
    fontScale: Dimensions.get('window').fontScale,
  };
  
  private listeners: Array<(state: KeyboardState) => void> = [];
  
  private constructor() {
    this.initializeListeners();
  }
  
  public static getInstance(): KeyboardManager {
    if (!KeyboardManager.instance) {
      KeyboardManager.instance = new KeyboardManager();
    }
    return KeyboardManager.instance;
  }
  
  private initializeListeners() {
    console.log('KeyboardManager: Initializing keyboard listeners');
    
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    
    Keyboard.addListener(showEvent, this.handleKeyboardShow.bind(this));
    Keyboard.addListener(hideEvent, this.handleKeyboardHide.bind(this));
    
    Dimensions.addEventListener('change', ({ window }) => {
      console.log('KeyboardManager: Screen dimensions changed:', window);
      this.screenDimensions = {
        width: window.width,
        height: window.height,
        scale: window.scale,
        fontScale: window.fontScale,
      };
    });
  }
  
  private handleKeyboardShow(event: KeyboardEvent) {
    console.log('KeyboardManager: Keyboard shown, height:', event.endCoordinates.height);
    
    this.keyboardState = {
      isVisible: true,
      height: event.endCoordinates.height,
      duration: event.duration || 250,
      easing: 'keyboard',
    };
    
    this.notifyListeners();
  }
  
  private handleKeyboardHide(event: KeyboardEvent) {
    console.log('KeyboardManager: Keyboard hidden');
    
    this.keyboardState = {
      isVisible: false,
      height: 0,
      duration: event.duration || 250,
      easing: 'keyboard',
    };
    
    this.notifyListeners();
  }
  
  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.keyboardState));
  }
  
  public subscribe(listener: (state: KeyboardState) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  public getKeyboardState(): KeyboardState {
    return { ...this.keyboardState };
  }
  
  public getScreenDimensions(): ScreenDimensions {
    return { ...this.screenDimensions };
  }
  
  /**
   * AI-powered calculation of optimal keyboard offset
   * Takes into account device type, orientation, and UI elements
   */
  public calculateOptimalOffset(options: {
    hasTabBar?: boolean;
    hasHeader?: boolean;
    inputPosition?: 'top' | 'middle' | 'bottom';
    customOffset?: number;
  } = {}): number {
    const {
      hasTabBar = false,
      hasHeader = true,
      inputPosition = 'bottom',
      customOffset = 0,
    } = options;
    
    if (!this.keyboardState.isVisible) {
      return 0;
    }
    
    let offset = 0;
    
    // Base keyboard height
    offset += this.keyboardState.height;
    
    // Platform-specific adjustments
    if (Platform.OS === 'ios') {
      // iOS needs less offset due to better native handling
      offset -= 20;
      
      // Add header offset if present
      if (hasHeader) {
        offset += 44; // Standard iOS header height
      }
      
      // Add tab bar offset if present
      if (hasTabBar) {
        offset += 49; // Standard iOS tab bar height
      }
    } else {
      // Android needs more aggressive offset
      offset += 20;
      
      // Add header offset if present
      if (hasHeader) {
        offset += 56; // Standard Android header height
      }
      
      // Add tab bar offset if present
      if (hasTabBar) {
        offset += 56; // Standard Android tab bar height
      }
    }
    
    // Adjust based on input position
    switch (inputPosition) {
      case 'top':
        offset *= 0.3; // Less offset needed for top inputs
        break;
      case 'middle':
        offset *= 0.6; // Moderate offset for middle inputs
        break;
      case 'bottom':
        offset *= 1.0; // Full offset for bottom inputs
        break;
    }
    
    // Add custom offset
    offset += customOffset;
    
    // Ensure offset is never negative
    offset = Math.max(0, offset);
    
    console.log('KeyboardManager: Calculated optimal offset:', offset, 'for options:', options);
    
    return offset;
  }
  
  /**
   * Detects if an element at a given Y position would be covered by the keyboard
   */
  public isElementCovered(elementY: number, elementHeight: number): boolean {
    if (!this.keyboardState.isVisible) {
      return false;
    }
    
    const keyboardTop = this.screenDimensions.height - this.keyboardState.height;
    const elementBottom = elementY + elementHeight;
    
    const isCovered = elementBottom > keyboardTop;
    
    if (isCovered) {
      console.log('KeyboardManager: Element is covered by keyboard', {
        elementY,
        elementHeight,
        elementBottom,
        keyboardTop,
      });
    }
    
    return isCovered;
  }
  
  /**
   * Calculates how much to scroll to make an element visible above the keyboard
   */
  public calculateScrollOffset(elementY: number, elementHeight: number, padding: number = 20): number {
    if (!this.keyboardState.isVisible) {
      return 0;
    }
    
    const keyboardTop = this.screenDimensions.height - this.keyboardState.height;
    const elementBottom = elementY + elementHeight + padding;
    
    if (elementBottom > keyboardTop) {
      const scrollOffset = elementBottom - keyboardTop;
      console.log('KeyboardManager: Calculated scroll offset:', scrollOffset);
      return scrollOffset;
    }
    
    return 0;
  }
}

/**
 * React hook for using keyboard state in components
 */
export function useKeyboard(options: {
  hasTabBar?: boolean;
  hasHeader?: boolean;
  inputPosition?: 'top' | 'middle' | 'bottom';
  customOffset?: number;
} = {}) {
  const [keyboardState, setKeyboardState] = useState<KeyboardState>(
    KeyboardManager.getInstance().getKeyboardState()
  );
  
  useEffect(() => {
    console.log('useKeyboard: Subscribing to keyboard events');
    const manager = KeyboardManager.getInstance();
    
    const unsubscribe = manager.subscribe((state) => {
      console.log('useKeyboard: Keyboard state changed:', state);
      setKeyboardState(state);
    });
    
    return () => {
      console.log('useKeyboard: Unsubscribing from keyboard events');
      unsubscribe();
    };
  }, []);
  
  const optimalOffset = KeyboardManager.getInstance().calculateOptimalOffset(options);
  const screenDimensions = KeyboardManager.getInstance().getScreenDimensions();
  
  return {
    isKeyboardVisible: keyboardState.isVisible,
    keyboardHeight: keyboardState.height,
    keyboardDuration: keyboardState.duration,
    optimalOffset,
    screenDimensions,
  };
}

/**
 * Calculates safe area insets for different device types
 */
export function calculateSafeAreaInsets(): SafeAreaInsets {
  const { height, width } = Dimensions.get('window');
  const isLandscape = width > height;
  
  let insets: SafeAreaInsets = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  };
  
  if (Platform.OS === 'ios') {
    // iPhone X and newer (with notch)
    const hasNotch = height >= 812 || width >= 812;
    
    if (hasNotch) {
      insets.top = isLandscape ? 0 : 44;
      insets.bottom = isLandscape ? 21 : 34;
      insets.left = isLandscape ? 44 : 0;
      insets.right = isLandscape ? 44 : 0;
    } else {
      // Older iPhones
      insets.top = 20;
      insets.bottom = 0;
    }
  } else {
    // Android
    insets.top = 24; // Status bar
    insets.bottom = 0; // Navigation bar handled by system
  }
  
  console.log('calculateSafeAreaInsets: Calculated insets:', insets);
  
  return insets;
}

/**
 * Detects device type and capabilities
 */
export function detectDeviceCapabilities() {
  const { height, width } = Dimensions.get('window');
  const isLandscape = width > height;
  const smallestWidth = Math.min(width, height);
  
  const isTablet = smallestWidth >= 600 || width >= 768;
  const isPhone = !isTablet;
  
  const hasNotch = Platform.OS === 'ios' && (height >= 812 || width >= 812);
  
  const capabilities = {
    isTablet,
    isPhone,
    isLandscape,
    hasNotch,
    screenWidth: width,
    screenHeight: height,
    smallestWidth,
  };
  
  console.log('detectDeviceCapabilities:', capabilities);
  
  return capabilities;
}

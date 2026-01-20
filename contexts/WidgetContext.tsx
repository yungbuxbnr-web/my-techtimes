
import * as React from "react";
import { createContext, useCallback, useContext, useEffect } from "react";
import { ExtensionStorage } from "@bacons/apple-targets";
import { Platform } from "react-native";

// Initialize storage with your group ID
const storage = new ExtensionStorage(
  "group.com.<user_name>.<app_name>"
);

type WidgetContextType = {
  refreshWidget: () => void;
};

const WidgetContext = createContext<WidgetContextType | null>(null);

export function WidgetProvider({ children }: { children: React.ReactNode }) {
  // Update widget state whenever what we want to show changes
  useEffect(() => {
    // Only run on iOS where widgets are supported
    if (Platform.OS === 'ios') {
      try {
        // set widget_state to null if we want to reset the widget
        // storage.set("widget_state", null);

        // Refresh widget
        ExtensionStorage.reloadWidget();
      } catch (error) {
        console.log('WidgetContext: Error reloading widget (expected on non-iOS platforms):', error);
      }
    }
  }, []);

  const refreshWidget = useCallback(() => {
    if (Platform.OS === 'ios') {
      try {
        ExtensionStorage.reloadWidget();
      } catch (error) {
        console.log('WidgetContext: Error refreshing widget:', error);
      }
    }
  }, []);

  return (
    <WidgetContext.Provider value={{ refreshWidget }}>
      {children}
    </WidgetContext.Provider>
  );
}

export const useWidget = () => {
  const context = useContext(WidgetContext);
  if (!context) {
    throw new Error("useWidget must be used within a WidgetProvider");
  }
  return context;
};

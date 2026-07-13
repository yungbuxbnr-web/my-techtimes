
import * as React from "react";
import { createContext, useCallback, useContext, useEffect } from "react";
import { Platform } from "react-native";

type WidgetContextType = {
  refreshWidget: () => void;
};

const WidgetContext = createContext<WidgetContextType | null>(null);

async function reloadWidgetIfIOS() {
  if (Platform.OS !== 'ios') return;
  try {
    const mod = await import('@bacons/apple-targets');
    mod.ExtensionStorage.reloadWidget();
  } catch (e) {
    console.warn('WidgetContext: apple-targets not available', e);
  }
}

export function WidgetProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    console.log('[WidgetContext] WidgetProvider mounted, reloading widget on iOS');
    reloadWidgetIfIOS();
  }, []);

  const refreshWidget = useCallback(() => {
    console.log('[WidgetContext] refreshWidget called');
    reloadWidgetIfIOS();
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

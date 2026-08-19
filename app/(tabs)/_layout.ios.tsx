
import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { useThemeContext } from '@/contexts/ThemeContext';

export default function TabLayout() {
  const { theme } = useThemeContext();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          borderTopWidth: 0.5,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'android' ? 20 : 8,
          height: Platform.OS === 'android' ? 88 : 64,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol ios_icon_name="house.fill" android_material_icon_name="home" size={size + 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol ios_icon_name="wrench.and.screwdriver.fill" android_material_icon_name="build" size={size + 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: 'Billing',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol ios_icon_name="creditcard.fill" android_material_icon_name="receipt" size={size + 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol ios_icon_name="chart.bar.fill" android_material_icon_name="bar-chart" size={size + 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol ios_icon_name="ellipsis.circle.fill" android_material_icon_name="more-horiz" size={size + 2} color={color} />
          ),
        }}
      />
      {/* Hidden from tab bar — still accessible via router.push */}
      <Tabs.Screen name="insights" options={{ href: null }} />
      <Tabs.Screen name="job-store" options={{ href: null }} />
      <Tabs.Screen name="media" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="ai" options={{ href: null }} />
      <Tabs.Screen name="add-job" options={{ href: null }} />
      <Tabs.Screen name="(home)" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="profile.ios" options={{ href: null }} />
    </Tabs>
  );
}

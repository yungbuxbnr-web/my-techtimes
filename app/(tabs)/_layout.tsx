
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
          paddingTop: 8,
          paddingBottom: Platform.OS === 'android' ? 12 : 8,
          height: Platform.OS === 'android' ? 80 : 64,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol
              ios_icon_name="chart.bar.fill"
              android_material_icon_name="dashboard"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Job Records',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol
              ios_icon_name="list.bullet"
              android_material_icon_name="list"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="job-store"
        options={{
          title: 'Job Store',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol
              ios_icon_name="magnifyingglass"
              android_material_icon_name="search"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol
              ios_icon_name="chart.pie.fill"
              android_material_icon_name="pie-chart"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol
              ios_icon_name="gearshape.fill"
              android_material_icon_name="settings"
              size={size}
              color={color}
            />
          ),
        }}
      />
      {/* Hide these from tabs */}
      <Tabs.Screen
        name="add-job"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="(home)"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile.ios"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

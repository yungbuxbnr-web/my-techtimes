import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconSymbol } from "@/components/IconSymbol";
import { GlassView } from "expo-glass-effect";
import { useTheme } from "@react-navigation/native";
import { offlineStorage, TechnicianProfile } from "@/utils/offlineStorage";

export default function ProfileScreen() {
  const theme = useTheme();
  const subtleColor = theme.dark ? '#98989D' : '#666';
  const placeholderColor = theme.dark ? '#555' : '#aaa';
  const inputBg = theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const glassBg = theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';

  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [profile, setProfile] = useState<TechnicianProfile>({ name: '' });
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLocation, setEditLocation] = useState('');

  const loadProfile = useCallback(async () => {
    console.log('ProfileScreen: Loading profile from storage');
    const saved = await offlineStorage.getTechnicianProfile();
    console.log('ProfileScreen: Profile loaded:', saved);
    setProfile(saved);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleEditPress = () => {
    console.log('ProfileScreen: Edit button pressed');
    setEditName(profile.name || '');
    setEditPhone(profile.phone || '');
    setEditLocation(profile.location || '');
    setEditMode(true);
  };

  const handleSave = async () => {
    console.log('ProfileScreen: Save button pressed, saving profile:', { name: editName, phone: editPhone, location: editLocation });
    const updated: TechnicianProfile = {
      name: editName.trim(),
      phone: editPhone.trim() || undefined,
      location: editLocation.trim() || undefined,
    };
    await offlineStorage.updateTechnicianProfile(updated);
    console.log('ProfileScreen: Profile saved successfully');
    setProfile(updated);
    setEditMode(false);
  };

  const handleCancel = () => {
    console.log('ProfileScreen: Cancel edit pressed');
    setEditMode(false);
  };

  const displayName = profile.name || 'Technician';
  const hasPhone = Boolean(profile.phone);
  const hasLocation = Boolean(profile.location);
  const showInfoSection = editMode || hasPhone || hasLocation;

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          Platform.OS !== 'ios' && styles.contentContainerWithTabBar,
        ]}
      >
        {/* Header card */}
        <GlassView
          style={[styles.profileHeader, { backgroundColor: glassBg }]}
          glassEffectStyle="regular"
        >
          <View style={styles.editButtonRow}>
            <View style={styles.editButtonSpacer} />
            {!editMode && (
              <TouchableOpacity onPress={handleEditPress} style={styles.editButton} accessibilityLabel="Edit profile">
                <IconSymbol ios_icon_name="pencil" android_material_icon_name="edit" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          <IconSymbol
            ios_icon_name="person.circle.fill"
            android_material_icon_name="person"
            size={80}
            color={theme.colors.primary}
          />

          {editMode ? (
            <TextInput
              style={[styles.nameInput, { color: theme.colors.text, borderColor: theme.colors.primary, backgroundColor: inputBg }]}
              value={editName}
              onChangeText={(text) => {
                console.log('ProfileScreen: Name field changed');
                setEditName(text);
              }}
              placeholder="Your name"
              placeholderTextColor={placeholderColor}
              autoCapitalize="words"
            />
          ) : (
            <Text style={[styles.name, { color: theme.colors.text }]}>{displayName}</Text>
          )}
        </GlassView>

        {/* Info section */}
        {showInfoSection && (
          <GlassView
            style={[styles.section, { backgroundColor: glassBg }]}
            glassEffectStyle="regular"
          >
            {/* Phone row */}
            <View style={styles.infoRow}>
              <IconSymbol
                ios_icon_name="phone.fill"
                android_material_icon_name="phone"
                size={20}
                color={subtleColor}
              />
              {editMode ? (
                <TextInput
                  style={[styles.infoInput, { color: theme.colors.text, borderColor: theme.dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)', backgroundColor: inputBg }]}
                  value={editPhone}
                  onChangeText={(text) => {
                    console.log('ProfileScreen: Phone field changed');
                    setEditPhone(text);
                  }}
                  placeholder="Add phone number"
                  placeholderTextColor={placeholderColor}
                  keyboardType="phone-pad"
                />
              ) : hasPhone ? (
                <Text style={[styles.infoText, { color: theme.colors.text }]}>{profile.phone}</Text>
              ) : null}
            </View>

            {/* Location row */}
            <View style={styles.infoRow}>
              <IconSymbol
                ios_icon_name="location.fill"
                android_material_icon_name="location-on"
                size={20}
                color={subtleColor}
              />
              {editMode ? (
                <TextInput
                  style={[styles.infoInput, { color: theme.colors.text, borderColor: theme.dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)', backgroundColor: inputBg }]}
                  value={editLocation}
                  onChangeText={(text) => {
                    console.log('ProfileScreen: Location field changed');
                    setEditLocation(text);
                  }}
                  placeholder="Add location"
                  placeholderTextColor={placeholderColor}
                />
              ) : hasLocation ? (
                <Text style={[styles.infoText, { color: theme.colors.text }]}>{profile.location}</Text>
              ) : null}
            </View>

            {/* Save / Cancel buttons */}
            {editMode && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={handleCancel}
                  style={[styles.cancelButton, { borderColor: subtleColor }]}
                  accessibilityLabel="Cancel"
                >
                  <Text style={[styles.cancelButtonText, { color: subtleColor }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
                  accessibilityLabel="Save profile"
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            )}
          </GlassView>
        )}

        {/* Save/Cancel when info section is hidden (no phone/location yet, not in edit mode) */}
        {editMode && !showInfoSection && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={handleCancel}
              style={[styles.cancelButton, { borderColor: subtleColor }]}
            >
              <Text style={[styles.cancelButtonText, { color: subtleColor }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    padding: 20,
    gap: 16,
  },
  contentContainerWithTabBar: {
    paddingBottom: 100,
  },
  profileHeader: {
    alignItems: 'center',
    borderRadius: 12,
    padding: 32,
    gap: 12,
  },
  editButtonRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'flex-end',
  },
  editButtonSpacer: {
    flex: 1,
  },
  editButton: {
    padding: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  nameInput: {
    fontSize: 20,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  section: {
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 16,
    flex: 1,
  },
  infoInput: {
    fontSize: 15,
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});

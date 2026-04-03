
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  StyleSheet,
  useWindowDimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeContext } from '@/contexts/ThemeContext';
import { getAllImages, getImageStorageStats, deleteJobImage, StoredImage } from '@/utils/imageStorage';
import { offlineStorage, Job } from '@/utils/offlineStorage';

function resolveImageSource(source: string | number | ImageSourcePropType | undefined): ImageSourcePropType {
  if (!source) return { uri: '' };
  if (typeof source === 'string') return { uri: source };
  return source as ImageSourcePropType;
}

interface EnrichedImage extends StoredImage {
  vehicleReg: string;
  wipNumber: string;
}

export default function MediaScreen() {
  const { theme } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const [images, setImages] = useState<EnrichedImage[]>([]);
  const [stats, setStats] = useState({ count: 0, totalSizeBytes: 0, totalSizeMB: '0.00' });
  const [selectedImage, setSelectedImage] = useState<EnrichedImage | null>(null);
  const [loading, setLoading] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const cellSize = screenWidth / 3;

  const loadData = useCallback(async () => {
    try {
      console.log('MediaScreen: Loading images and jobs');
      setLoading(true);

      const [allImages, allJobs, storageStats] = await Promise.all([
        getAllImages(),
        offlineStorage.getAllJobs(),
        getImageStorageStats(),
      ]);

      const jobMap = new Map<string, Job>();
      allJobs.forEach(job => jobMap.set(job.id, job));

      const enriched: EnrichedImage[] = allImages.map(img => {
        const job = jobMap.get(img.jobId);
        return {
          ...img,
          vehicleReg: job?.vehicleReg ?? 'Unknown',
          wipNumber: job?.wipNumber ?? '—',
        };
      });

      setImages(enriched);
      setStats(storageStats);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error('MediaScreen: Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [fadeAnim]);

  useFocusEffect(
    useCallback(() => {
      fadeAnim.setValue(0);
      loadData();
    }, [loadData, fadeAnim])
  );

  const handleLongPress = useCallback((image: EnrichedImage) => {
    console.log('MediaScreen: Long press on image:', image.id, 'for job:', image.jobId);
    Alert.alert(
      'Delete Image',
      `Remove this photo for ${image.vehicleReg}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('MediaScreen: Deleting image:', image.id);
              await deleteJobImage(image.id);
              await loadData();
            } catch (error) {
              console.error('MediaScreen: Error deleting image:', error);
              Alert.alert('Error', 'Failed to delete image.');
            }
          },
        },
      ]
    );
  }, [loadData]);

  const handleCellPress = useCallback((image: EnrichedImage) => {
    console.log('MediaScreen: Opening image viewer for:', image.id, 'vehicle:', image.vehicleReg);
    setSelectedImage(image);
  }, []);

  const handleCloseModal = useCallback(() => {
    console.log('MediaScreen: Closing image viewer');
    setSelectedImage(null);
  }, []);

  const renderCell = useCallback(({ item }: { item: EnrichedImage }) => {
    const cellFade = fadeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    });
    const cellScale = fadeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.92, 1],
    });

    return (
      <Animated.View
        style={[
          { width: cellSize, height: cellSize },
          { opacity: cellFade, transform: [{ scale: cellScale }] },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => handleCellPress(item)}
          onLongPress={() => handleLongPress(item)}
          delayLongPress={400}
          style={styles.cellTouchable}
        >
          <Image
            source={resolveImageSource(item.uri)}
            style={styles.thumbnail}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.cellOverlay}>
            <Text style={styles.cellReg} numberOfLines={1}>{item.vehicleReg}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [fadeAnim, cellSize, handleCellPress, handleLongPress]);

  const keyExtractor = useCallback((item: EnrichedImage) => item.id, []);

  const countText = stats.count.toString();
  const sizeMBText = stats.totalSizeMB + ' MB';
  const selectedReg = selectedImage?.vehicleReg ?? '';
  const selectedWip = selectedImage?.wipNumber ?? '';
  const containerStyle = [styles.container, { backgroundColor: theme.background }];
  const headerStyle = [styles.header, { paddingTop: insets.top + 12 }];
  const statsBarStyle = [styles.statsBar, { backgroundColor: theme.card, borderColor: theme.border }];
  const emptyIconWrapStyle = [styles.emptyIconWrap, { backgroundColor: theme.card, borderColor: theme.border }];
  const modalHeaderStyle = [styles.modalHeader, { paddingTop: insets.top + 8 }];
  const gridContentStyle = [styles.grid, { paddingBottom: insets.bottom + 16 }];
  const emptyStateStyle = [styles.emptyState, { paddingBottom: insets.bottom + 60 }];

  return (
    <View style={containerStyle}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={headerStyle}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Media</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Job photo library</Text>
      </View>

      {/* Stats bar */}
      <View style={statsBarStyle}>
        <View style={styles.statItem}>
          <Ionicons name="images-outline" size={16} color={theme.primary} />
          <Text style={[styles.statValue, { color: theme.primary }]}>{countText}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Photos</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <View style={styles.statItem}>
          <Ionicons name="server-outline" size={16} color={theme.primary} />
          <Text style={[styles.statValue, { color: theme.primary }]}>{sizeMBText}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Storage used</Text>
        </View>
      </View>

      {/* Grid */}
      {loading ? (
        <View style={emptyStateStyle}>
          <Ionicons name="hourglass-outline" size={40} color={theme.textSecondary} />
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary, marginTop: 12 }]}>Loading...</Text>
        </View>
      ) : images.length === 0 ? (
        <View style={emptyStateStyle}>
          <View style={emptyIconWrapStyle}>
            <Ionicons name="images-outline" size={48} color={theme.textSecondary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No job images yet</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>Add images when logging jobs</Text>
        </View>
      ) : (
        <Animated.FlatList
          data={images}
          keyExtractor={keyExtractor}
          renderItem={renderCell}
          numColumns={3}
          contentContainerStyle={gridContentStyle}
          showsVerticalScrollIndicator={false}
          style={[{ flex: 1 }, { opacity: fadeAnim }]}
        />
      )}

      {/* Full-screen viewer modal */}
      <Modal
        visible={selectedImage !== null}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />

          {/* Modal header */}
          <View style={modalHeaderStyle}>
            <View style={styles.modalTitleBlock}>
              <Text style={styles.modalReg}>{selectedReg}</Text>
              <Text style={styles.modalWip}>WIP {selectedWip}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleCloseModal}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={22} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Full image */}
          <View style={styles.modalImageWrap}>
            <Image
              source={resolveImageSource(selectedImage?.uri)}
              style={styles.modalImage}
              contentFit="contain"
              transition={150}
            />
          </View>

          {/* Bottom safe area spacer */}
          <View style={{ height: insets.bottom + 16 }} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 28,
    marginHorizontal: 16,
  },
  grid: {},
  cellTouchable: {
    flex: 1,
    margin: 0.5,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  cellOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  cellReg: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  modalTitleBlock: {
    flex: 1,
  },
  modalReg: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  modalWip: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImageWrap: {
    flex: 1,
  },
  modalImage: {
    flex: 1,
    width: '100%',
  },
});

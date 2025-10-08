import React, { useContext, useMemo, useState } from 'react';
import { Alert, Image, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { RectButton } from 'react-native-gesture-handler';
import { v4 as uuidv4 } from 'uuid';

import BigButton from '../components/BigButton';
import Spacer from '../components/Spacer';
import { AuthenticationContext } from '../context/AuthenticationContext';
import { uploadImage } from '../services/imageApi';
import { createEvent } from '../services/api';
import { Event } from '../types/Event';

export default function CreateEvent({ navigation }: StackScreenProps<any>) {
  const auth = useContext(AuthenticationContext);

  // Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');      // e.g. 2025-12-01
  const [time, setTime] = useState('');      // e.g. 14:30
  const [volunteersNeeded, setVolunteersNeeded] = useState<string>('');
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');

  // Image state
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [imageName, setImageName] = useState<string | undefined>(undefined);
  const [imageSize, setImageSize] = useState<number | undefined>(undefined);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageRemoteUrl, setImageRemoteUrl] = useState<string | undefined>(undefined);

  // Helpers
  const isoDateTime = useMemo(() => {
    if (!date || !time) return '';
    // Combine to ISO (local) -> then toISOString
    const [h, m] = time.split(':').map(Number);
    const d = new Date(date);
    d.setHours(h || 0, m || 0, 0, 0);
    return d.toISOString();
  }, [date, time]);

  const numericVolunteers = useMemo(() => {
    const n = Number(volunteersNeeded);
    return Number.isFinite(n) ? n : NaN;
  }, [volunteersNeeded]);

  const canSave = useMemo(() => {
    return (
      name.trim().length > 0 &&
      description.trim().length > 0 &&
      isoDateTime.length > 0 &&
      !Number.isNaN(numericVolunteers) &&
      numericVolunteers > 0 &&
      !!lat && !!lng &&
      !!imageRemoteUrl // ensure uploaded
    );
  }, [name, description, isoDateTime, numericVolunteers, lat, lng, imageRemoteUrl]);

  // Permissions and pickers
  const ensureLibraryPermission = async () => {
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (res.status !== 'granted') throw new Error('Permission for image library was denied');
  };

  const ensureCameraPermission = async () => {
    const res = await ImagePicker.requestCameraPermissionsAsync();
    if (res.status !== 'granted') throw new Error('Permission for camera was denied');
  };

  const ensureLocation = async () => {
    const res = await Location.requestForegroundPermissionsAsync();
    if (res.status !== 'granted') {
      Alert.alert('Location', 'Permission denied. You can still enter coordinates manually.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    setLat(String(loc.coords.latitude.toFixed(6)));
    setLng(String(loc.coords.longitude.toFixed(6)));
  };

  const pickFromLibrary = async () => {
    try {
      await ensureLibraryPermission();
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        base64: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length) {
        const a = result.assets[0];
        setImageUri(a.uri);
        setImageBase64(a.base64 ?? undefined);
        setImageName(a.fileName || a.uri.split('/').pop() || 'image.jpg');
        setImageSize(a.fileSize);
        setImageRemoteUrl(undefined); // reset until uploaded
      }
    } catch (e: any) {
      Alert.alert('Image picker', e.message ?? 'Could not pick an image.');
    }
  };

  const takePhoto = async () => {
    try {
      await ensureCameraPermission();
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        base64: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length) {
        const a = result.assets[0];
        setImageUri(a.uri);
        setImageBase64(a.base64 ?? undefined);
        setImageName(a.fileName || 'camera.jpg');
        setImageSize(a.fileSize);
        setImageRemoteUrl(undefined);
      }
    } catch (e: any) {
      Alert.alert('Camera', e.message ?? 'Could not take a photo.');
    }
  };

  const uploadPickedImage = async () => {
    if (!imageBase64) {
      Alert.alert('Upload', 'Please pick an image first.');
      return;
    }
    try {
      setImageUploading(true);
      const resp = await uploadImage(imageBase64);
      // ImgBB returns data.data.url
      const remoteUrl = resp?.data?.data?.url;
      if (remoteUrl) {
        setImageRemoteUrl(remoteUrl);
        Alert.alert('Upload', 'Image uploaded successfully!');
      } else {
        throw new Error('Upload did not return a URL.');
      }
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Could not upload image.');
    } finally {
      setImageUploading(false);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const handleSave = async () => {
    try {
      if (!canSave) {
        Alert.alert('Validation', 'Please complete all fields and upload the image.');
        return;
      }

      const newEvent: Event = {
        id: uuidv4(),
        name: name.trim(),
        description: description.trim(),
        dateTime: isoDateTime,
        organizerId: auth?.value?.id ?? 'unknown',
        position: {
          latitude: Number(lat),
          longitude: Number(lng),
        },
        imageUrl: imageRemoteUrl,
        volunteersNeeded: numericVolunteers,
        volunteersIds: [],
      };

      await createEvent(newEvent);

      Alert.alert('Saved', 'Event created successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('EventsMap'),
        },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not create event.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Event</Text>

      <Text style={styles.label}>Name *</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Event name"
      />

      <Text style={styles.label}>Description *</Text>
      <TextInput
        style={[styles.input, { height: 100 }]}
        value={description}
        onChangeText={setDescription}
        placeholder="Event description"
        multiline
      />

      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.label}>Date (YYYY-MM-DD) *</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="2025-12-01"
            autoCapitalize="none"
          />
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.label}>Time (HH:MM) *</Text>
          <TextInput
            style={styles.input}
            value={time}
            onChangeText={setTime}
            placeholder="14:30"
            autoCapitalize="none"
          />
        </View>
      </View>

      <Text style={styles.label}>Volunteers Needed *</Text>
      <TextInput
        style={styles.input}
        value={volunteersNeeded}
        onChangeText={setVolunteersNeeded}
        placeholder="e.g. 4"
        keyboardType="numeric"
      />

      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.label}>Latitude *</Text>
          <TextInput
            style={styles.input}
            value={lat}
            onChangeText={setLat}
            placeholder="51.0447"
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.label}>Longitude *</Text>
          <TextInput
            style={styles.input}
            value={lng}
            onChangeText={setLng}
            placeholder="-114.0719"
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <View style={styles.row}>
        <RectButton style={[styles.smallButton, { backgroundColor: '#4D6F80' }]} onPress={ensureLocation}>
          <Text style={styles.smallButtonText}>Use my location</Text>
        </RectButton>
      </View>

      <Spacer size={16} />
      <Text style={styles.label}>Image *</Text>

      <View style={styles.row}>
        <RectButton style={[styles.smallButton, { backgroundColor: '#00A3FF' }]} onPress={pickFromLibrary}>
          <Text style={styles.smallButtonText}>Pick from library</Text>
        </RectButton>
        <RectButton style={[styles.smallButton, { backgroundColor: '#FF8700' }]} onPress={takePhoto}>
          <Text style={styles.smallButtonText}>Take photo</Text>
        </RectButton>
        <RectButton
          style={[styles.smallButton, { backgroundColor: imageUploading ? '#888' : '#22AA55' }]}
          onPress={uploadPickedImage}
          enabled={!imageUploading}
        >
          <Text style={styles.smallButtonText}>{imageUploading ? 'Uploading…' : 'Upload'}</Text>
        </RectButton>
      </View>

      {!!imageUri && (
        <View style={styles.imageRow}>
          <Image source={{ uri: imageUri }} style={styles.thumb} />
          <View style={{ flex: 1 }}>
            {!!imageName && <Text numberOfLines={1} style={styles.fileInfo}>{imageName}</Text>}
            {!!imageSize && <Text style={styles.fileInfo}>{formatBytes(imageSize)}</Text>}
            {!!imageRemoteUrl && <Text numberOfLines={1} style={[styles.fileInfo, { color: '#22AA55' }]}>Uploaded ✓</Text>}
          </View>
        </View>
      )}

      <Spacer size={16} />

      <BigButton
        label="Save"
        color={canSave ? '#22AA55' : '#22AA5580'}
        disabled={!canSave}
        onPress={handleSave}
      />

      <Spacer size={12} />

      <BigButton
        label="Cancel"
        color="#999"
        onPress={() => navigation.goBack()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.select({ ios: 56, android: 32, default: 32 }),
    paddingHorizontal: 20,
    backgroundColor: '#F2F3F5',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 16,
    color: '#031A62',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#4D6F80',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.4,
    borderColor: '#D3E2E5',
    borderRadius: 8,
    height: 48,
    paddingHorizontal: 16,
    marginBottom: 12,
    color: '#5C8599',
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  smallButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  smallButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 6,
    marginRight: 10,
  },
  fileInfo: {
    fontSize: 12,
    color: '#4D6F80',
  },
});

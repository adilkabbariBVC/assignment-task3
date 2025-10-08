import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { StackScreenProps } from '@react-navigation/stack';
import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import customMapStyle from '../../map-style.json';
import * as MapSettings from '../constants/MapSettings';
import { AuthenticationContext } from '../context/AuthenticationContext';
import { getFromNetworkFirst, setInCache } from '../services/caching';
import { api, getEvents } from '../services/api';
import { Event } from '../types/Event';
import mapMarkerImg from '../images/map-marker.png';

export default function EventsMap(props: StackScreenProps<any>) {
  const { navigation } = props;
  const authenticationContext = useContext(AuthenticationContext);
  const mapViewRef = useRef<MapView>(null);

  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const futureEvents = useMemo(() => {
    const now = new Date();
    return events.filter(e => new Date(e.dateTime) > now);
  }, [events]);

  const fitToMarkers = useCallback(() => {
    if (!mapViewRef.current) return;
    const coords = futureEvents.map(e => ({
      latitude: e.position.latitude,
      longitude: e.position.longitude,
    }));
    if (coords.length) {
      mapViewRef.current.fitToCoordinates(coords, {
        edgePadding: MapSettings.EDGE_PADDING,
        animated: true,
      });
    }
  }, [futureEvents]);

  const fetchAndCacheEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await getFromNetworkFirst('events_future', getEvents().then(r => r.data));
      // Cache the response again under a generic key (optional)
      await setInCache('events_future', response);
      setEvents(response);
    } catch (err) {
      Alert.alert('Offline', 'Loaded events from cache.');
      const cached = await AsyncStorage.getItem('events_future');
      if (cached) setEvents(JSON.parse(cached));
    } finally {
      setIsLoading(false);
      // Let the map settle then fit
      setTimeout(fitToMarkers, 300);
    }
  }, [fitToMarkers]);

  // Refresh when screen gains focus (e.g., returning from CreateEvent)
  useFocusEffect(
    useCallback(() => {
      fetchAndCacheEvents();
    }, [fetchAndCacheEvents])
  );

  const handleNavigateToCreateEvent = () => {
    navigation.navigate('CreateEvent');
  };

  const handleLogout = async () => {
    AsyncStorage.multiRemove(['userInfo', 'accessToken']).then(() => {
      authenticationContext?.setValue(undefined);
      navigation.navigate('Login');
    });
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapViewRef}
        provider={PROVIDER_GOOGLE}
        initialRegion={MapSettings.DEFAULT_REGION}
        style={styles.mapStyle}
        customMapStyle={customMapStyle}
        showsMyLocationButton={false}
        showsUserLocation={true}
        rotateEnabled={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        mapPadding={MapSettings.EDGE_PADDING}
        onMapReady={fitToMarkers}
      >
        {futureEvents.map(event => (
          <Marker
            key={event.id}
            coordinate={{
              latitude: event.position.latitude,
              longitude: event.position.longitude,
            }}
          >
            <Image resizeMode="contain" style={{ width: 48, height: 54 }} source={mapMarkerImg} />
          </Marker>
        ))}
      </MapView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {futureEvents.length} event(s) found
        </Text>
        <RectButton
          style={[styles.smallButton, { backgroundColor: '#00A3FF' }]}
          onPress={handleNavigateToCreateEvent}
        >
          <Feather name="plus" size={20} color="#FFF" />
        </RectButton>
      </View>

      <RectButton
        style={[styles.logoutButton, styles.smallButton, { backgroundColor: '#4D6F80' }]}
        onPress={handleLogout}
      >
        <Feather name="log-out" size={20} color="#FFF" />
      </RectButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  mapStyle: {
    ...StyleSheet.absoluteFillObject,
  },
  logoutButton: {
    position: 'absolute',
    top: 70,
    right: 24,
    elevation: 3,
  },
  footer: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 40,
    backgroundColor: '#FFF',
    borderRadius: 16,
    height: 56,
    paddingLeft: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 3,
  },
  footerText: {
    fontFamily: 'Nunito_700Bold',
    color: '#8fa7b3',
  },
  smallButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import React, {useEffect, useState} from 'react';
import MapLibreGL from '@maplibre/maplibre-react-native';
import Geolocation from '@react-native-community/geolocation';
import {STADIA_KEY} from './src/utils/key';

MapLibreGL.setAccessToken(null);

const apiKey = STADIA_KEY;
const styleUrl = `https://tiles.stadiamaps.com/styles/alidade_smooth.json?api_key=${apiKey}`;

const App = () => {
  const [currentPosition, setcurrentPosition] = useState<
    [number, number] | null
  >(null);
  const [routeCoordinates, setrouteCoordinates] = useState<[number, number][]>(
    [],
  );
  const [instructions, setInstructions] = useState<string[]>([]);
  const [searchQuery, setsearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);

  useEffect(() => {
    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude} = position.coords;
        setcurrentPosition([longitude, latitude]);
      },
      error => {
        console.error('Error getting current position', error);
      },
      {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
    );
  }, []);
  useEffect(() => {
    if (searchQuery) {
      const url = `https://api.stadiamaps.com/geocoding/v1/autocomplete?text=${encodeURIComponent(
        searchQuery,
      )}&api_key=${apiKey}`;

      fetch(url)
        .then(response => response.json())
        .then(data => {
          if (data.features) {
            setSuggestions(data.features);
          }
        })
        .catch(error => {
          console.error('Error fetching autocomplete suggestions', error);
        });
    } else {
      setSuggestions([]);
    }
  }, [searchQuery]);

  const parseRouteCoordinates = (routeCoords: string): [number, number][] => {
    return routeCoords.split(';').map(coord => {
      const [lon, lat] = coord.split(',').map(parseFloat);
      return [lon, lat];
    });
  };
  const getRouteCoordinates = (
    origin: [number, number],
    destination: [number, number],
  ): void => {
    const url = 'https://api.stadiamaps.com/route/v1';
    const requestOptions = {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        locations: [
          {lon: origin[0], lat: origin[1], type: 'break'},
          {lon: destination[0], lat: destination[1], type: 'break'},
        ],
        costing: 'auto',
        costing_options: {
          auto: {
            use_tolls: 1,
            use_highways: 0,
          },
        },
        directions_options: {
          units: 'miles',
        },
      }),
    };

    fetch(`${url}?api_key=${apiKey}`, requestOptions)
      .then(response => response.json())
      .then(data => {
        if (
          data.trip &&
          data.trip.legs &&
          data.trip.legs[0] &&
          data.trip.legs[0].maneuvers
        ) {
          const routeCoords = data.trip.legs[0].shape;
          const parsedRouteCoords = parseRouteCoordinates(routeCoords);
          setrouteCoordinates(parsedRouteCoords);

          const maneuvers = data.trip.legs[0].maneuvers;
          const parsedInstructions = maneuvers.map((maneuver: any) => {
            return maneuver.instruction;
          });
          setInstructions(parsedInstructions);
        } else {
          console.error('Invalid API response', data);
        }
      })
      .catch(error => {
        console.error('Error fetching route coordinates', error);
      });
  };

  const updateRouteInstructions = () => {
    if (currentPosition && routeCoordinates.length > 1) {
      const [lon, lat] = currentPosition;
      const url = 'https://api.stadiamaps.com/route/v1';
      const requestOptions = {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locations: [
            {lon: lon, lat: lat, type: 'break'},
            {
              lon: routeCoordinates[routeCoordinates.length - 1][0],
              lat: routeCoordinates[routeCoordinates.length - 1][1],
              type: 'break',
            },
          ],
          consting: 'auto',
          costing_options: {
            auto: {
              use_tolls: 1,
              use_highways: 0,
            },
          },
          directions_options: {
            units: 'miles',
          },
        }),
      };
      fetch(`${url}?api_key=${apiKey}`, requestOptions)
        .then(response => response.json())
        .then(data => {
          if (
            data.trip &&
            data.trip.legs &&
            data.trip.legs[0] &&
            data.trip.legs[0].maneuvers
          ) {
            const maneuvers = data.trip.legs[0].maneuvers;
            const parsedInstructions = maneuvers.map((maneuver: any) => {
              return maneuver.instruction;
            });
            setInstructions(parsedInstructions);
          } else {
            console.error('Invalid Api response', data);
          }
        })
        .catch(error => {
          console.error('errorfetching route instructions', error);
        });
    }
  };

  useEffect(() => {
    const intervalId = setInterval(updateRouteInstructions, 10000);
    return () => clearInterval(intervalId);
  }, [currentPosition, routeCoordinates]);

  const handlePlaceSelect = (selectedPlace: any) => {
    if (currentPosition) {
      const startCoords = currentPosition;
      const endCoords = selectedPlace.geometry.coordinates;

      getRouteCoordinates(startCoords, endCoords);

      setSuggestions([]);
    }
  };

  return (
    <View style={styles.page}>
      <MapLibreGL.MapView style={styles.map} styleURL={styleUrl}>
        {currentPosition && (
          <MapLibreGL.Camera
            zoomLevel={5}
            pitch={50}
            centerCoordinate={currentPosition}
          />
        )}
        {currentPosition && (
          <MapLibreGL.PointAnnotation
            id="currentPosition"
            coordinate={currentPosition}
          />
        )}
      </MapLibreGL.MapView>
      {/* Suggestions */}
      <View style={styles.suggestions}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search A place .."
          onChangeText={text => setsearchQuery(text)}
          value={searchQuery}
        />
        <FlatList
          data={suggestions}
          renderItem={({item}) => (
            <TouchableOpacity
              style={styles.suggestionItem}
              onPress={() => handlePlaceSelect(item)}>
              <Text>{item.properties.label}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={item => item.properties.id}
        />
      </View>
      <View style={styles.cardContainer}>
        <FlatList
          style={styles.instructionsContainer}
          data={instructions}
          renderItem={({item}) => (
            <Text style={styles.instruction}>{item}</Text>
          )}
          keyExtractor={(item, index) => index.toString()}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  suggestions: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    height: 40,
    backgroundColor: 'white',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  cardContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 8,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsContainer: {
    flexGrow: 1,
    maxHeight: 200,
  },
  instruction: {
    fontSize: 16,
    padding: 10,
    color: 'black',
  },
});
export default App;

import React from 'react';
import MapView, { Polygon } from 'react-native-maps';
import { StyleSheet, Text, View, Dimensions } from 'react-native';

// Import the U.S. Census Bureau's Cartographic Boundary File of counties.
// Source: https://www.census.gov/geographies/mapping-files/time-series/geo/carto-boundary-file.html
import counties from './assets/cb_2018_us_county_20m.json'

export default class App extends React.Component {
  render() {
    const initialRegion = {
      latitude: 36.7783,
      longitude: -119.4179,
      latitudeDelta: 15.0,
      longitudeDelta: 15.0,
    };
    return (
      <View style={styles.container}>
        <MapView style={styles.mapStyle} initialRegion={initialRegion}>
          {toPolygons(counties)}
        </MapView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapStyle: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
});

/**
 * Converts a GeoJSON FeatureCollection to an array of React Native Polygons.
 *
 * @param {!FeatureCollection} fc A GeoJSON FeatureCollection.
 * @return {!Array<Polygon>} React Native Polygons.
 */
function toPolygons(fc) {
  // Helper function: Converts a GeoJSON coordinate to a LatLng.
  function toLatLng(coord) {
    return {latitude: coord[1], longitude: coord[0]};
  }
  // Helper function: Converts an array of GeoJSON coordinates to a Polygon
  // with the specified key.
  function toPolygon(coords, key) {
    return <Polygon coordinates={coords.map(toLatLng)}
                    key={key}
                    strokeColor='#ee6e73'
                    fillColor='rgba(255, 0, 0, 0.1)'
                    tappable={true}
                    onPress={() => alert(key)} />;
  }
  // Loop through the FeatureCollection.
  let polygons = []
  for (const feat of fc.features) {
    switch (feat.geometry.type) {
      case 'Polygon':
        const component = feat.geometry.coordinates;
        polygons.push(toPolygon(component[0],
          feat.properties.NAME + ', ' + STATEFP[feat.properties.STATEFP] +
          ` (GeoID: ${feat.properties.GEOID})`));
        break;
      case 'MultiPolygon':
        for (const [i, component] of feat.geometry.coordinates.entries()) {
          polygons.push(toPolygon(component[0],
            feat.properties.NAME + ', ' + STATEFP[feat.properties.STATEFP] +
            ` (GeoID: ${feat.properties.GEOID}-${i})`));
        }
        break;
    }
  }
  return polygons;
}

const STATEFP = {
  '01': 'AL',
  '02': 'AK',
  '04': 'AZ',
  '05': 'AR',
  '06': 'CA',
  '08': 'CO',
  '09': 'CT',
  '10': 'DE',
  '12': 'FL',
  '13': 'GA',
  '15': 'HI',
  '16': 'ID',
  '17': 'IL',
  '18': 'IN',
  '19': 'IA',
  '20': 'KS',
  '21': 'KY',
  '22': 'LA',
  '23': 'ME',
  '24': 'MD',
  '25': 'MA',
  '26': 'MI',
  '27': 'MN',
  '28': 'MS',
  '29': 'MO',
  '30': 'MT',
  '31': 'NE',
  '32': 'NV',
  '33': 'NH',
  '34': 'NJ',
  '35': 'NM',
  '36': 'NY',
  '37': 'NC',
  '38': 'ND',
  '39': 'OH',
  '40': 'OK',
  '41': 'OR',
  '42': 'PA',
  '44': 'RI',
  '45': 'SC',
  '46': 'SD',
  '47': 'TN',
  '48': 'TX',
  '49': 'UT',
  '50': 'VT',
  '51': 'VA',
  '53': 'WA',
  '54': 'WV',
  '55': 'WI',
  '56': 'WY',
  '60': 'AS',
  '66': 'GU',
  '69': 'MP',
  '72': 'PR',
  '78': 'VI',
};

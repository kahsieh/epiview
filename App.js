import React from 'react';
import MapView, { Polygon } from 'react-native-maps';
import { Picker, StyleSheet, Text, View, Dimensions } from 'react-native';

// Import:
// - EpiView parsing functions.
// - U.S. Census Bureau's Cartographic Boundary File for counties.
//   Source: https://www.census.gov/geographies/mapping-files/time-series/geo/carto-boundary-file.html
// - COVID-19 case data by county from The New York Times.
import { parseCounts, parseBounds } from './epiview.js';
import countyBounds from './assets/cb_2018_us_county_20m.json'
const nytCounts = 'https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-counties.csv';

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      bounds: parseBounds(countyBounds),
      counts: null,
      numerator: 'cases',
      denominator: 'total',
    };
  }

  componentDidMount() {
    fetch(nytCounts)
    .then(res => res.text())
    .then(parseCounts)
    .then(counts => this.setState({counts}));
  }

  render() {
    if (this.state.counts) {
      // Find the scaling constant.
      let maxval = 0;
      for (const rowgroup of Object.values(this.state.counts)) {
        // Get the most recent row.
        const rowObj = Object.entries(rowgroup).reduce(
          ([k1, v1], [k2, v2]) => k1 > k2 ? [k1, v1] : [k2, v2])[1];
        const num = rowObj[this.state.numerator];
        const den = this.state.denominator == 'total' ? 1 :
                    rowObj[this.state.denominator];
        maxval = Math.max(maxval, num / den);
      }

      // Create a helper function for scaling.
      function scale(x) {
        return 0.6 * (1 - Math.pow(Math.E, -10 * (x / maxval)));
      }

      // Construct polygons.
      let polygons = [];
      for (const [fips, coordsets] of Object.entries(this.state.bounds)) {
        if (fips in this.state.counts) {
          for (const [i, coords] of coordsets.entries()) {
            // Get the most recent row.
            const rowObj = Object.entries(this.state.counts[fips]).reduce(
              ([k1, v1], [k2, v2]) => k1 > k2 ? [k1, v1] : [k2, v2])[1];
            const num = rowObj[this.state.numerator];
            const den = this.state.denominator == 'total' ? 1 :
                        rowObj[this.state.denominator];
            const alpha = scale(num / den);
            const msg = `${rowObj.cases} cases, ${rowObj.deaths} deaths\n` +
                        `${coordsets.name}`;
            polygons.push(<Polygon coordinates={coords}
              key={coordsets.name + `\n${fips}-${i}`}
              strokeWidth={0}
              fillColor={`rgba(255, 0, 0, ${alpha})`}
              tappable={true}
              onPress={() => alert(msg)} />);
          }
        }
      }

      const california = {
        latitude: 36.7783,
        longitude: -119.4179,
        latitudeDelta: 12.0,
        longitudeDelta: 12.0,
      };
      return (
        <View style={styles.container}>
          <MapView style={styles.mapStyle} initialRegion={california}>
            {polygons}
          </MapView>
          <View style={styles.toolbar}>
            <Picker selectedValue={this.state.numerator}
                    style={{ width: 150 }}
                    onValueChange={(value, index) =>
                                     this.setState({numerator: value})}>
              <Picker.Item label="Cases" value="cases" />
              <Picker.Item label="Deaths" value="deaths" />
            </Picker>
            <Picker selectedValue={this.state.denominator}
                    style={{ width: 200 }}
                    onValueChange={(value, index) =>
                                     this.setState({denominator: value})}>
              <Picker.Item label="Total" value="total" />
              <Picker.Item label="Per case" value="cases" />
            </Picker>
          </View>
        </View>
      );
    }
    else {
      return (
        <View style={styles.container}>
          <Text>Downloading data...</Text>
        </View>
      );
    }
  }
}1

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eeeeee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapStyle: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height - 75,
  },
  toolbar: {
    flexDirection: 'row',
    height: 75,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

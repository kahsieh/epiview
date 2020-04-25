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
      numerator: 'cases',
      denominator: 'total',
    };
  }

  async componentDidMount() {
    // Helper function: Scales the number of cases using a custom function.
    function scale(x) {
      return 0.6 * (1 - Math.pow(Math.E, -(x / 1000)));
    }
    // Retrieve and parse counts and bounds by county.
    const counts = await fetch(nytCounts).then(res => res.text()).then(parseCounts);
    const bounds = parseBounds(countyBounds);
    // Construct polygons.
    let polygons = [];
    for (const [fips, coordsets] of Object.entries(bounds)) {
      if (fips in counts) {
        for (const [i, coords] of coordsets.entries()) {
          // Get the most recent row.
          const rowObj = Object.entries(counts[fips]).reduce(
            ([k1, v1], [k2, v2]) => k1 > k2 ? [k1, v1] : [k2, v2])[1];
          const msg = `${rowObj.cases} cases, ${rowObj.deaths} deaths\n` +
                      `${coordsets.name}`;
          polygons.push(<Polygon coordinates={coords}
            key={coordsets.name + `\n${fips}-${i}`}
            strokeWidth={0}
            fillColor={`rgba(255, 0, 0, ${scale(rowObj.cases)})`}
            tappable={true}
            onPress={() => alert(msg)} />);
        }
      }
    }
    this.setState({polygons});
  }

  render() {
    const california = {
      latitude: 36.7783,
      longitude: -119.4179,
      latitudeDelta: 12.0,
      longitudeDelta: 12.0,
    };
    if (this.state.polygons) {
      return (
        <View style={styles.container}>
          <MapView style={styles.mapStyle} initialRegion={california}>
            {this.state.polygons}
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
              <Picker.Item label="Per million population" value="pmp" />
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
    height: Dimensions.get('window').height - 100,
  },
  toolbar: {
    flexDirection: 'row',
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

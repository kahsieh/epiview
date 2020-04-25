import React from 'react';
import MapView, { Polygon } from 'react-native-maps';
import { Alert, Picker, StyleSheet, Text, View, Dimensions } from 'react-native';
import { compileData } from './epiview.js';

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      data: null,
      numerator: 'Cases',
      denominator: 'total',
    };
  }

  componentDidMount() {
    compileData().then(data => this.setState({ data }));
  }

  /**
   * Executes the user-defined function on a county.
   *
   * @param {!Object<string, *>} county Data table entry for a county.
   */
  f(county) {
    if (!('population' in county) ||
        !('bounds' in county) ||
        !('latestCounts' in county)) {
      return 0;
    }
    let num, den;
    switch (this.state.numerator) {
      case 'Cases':
        num = county.latestCounts.cases;
        break;
      case 'Deaths':
        num = county.latestCounts.deaths;
        break;
    }
    switch (this.state.denominator) {
      case 'total':
        den = 1;
        break;
      case 'per case':
        den = county.latestCounts.cases;
        break;
      case 'per 1,000 cap':
        den = county.population / 1e3;
        break;
      case 'per square km':
        den = county.landArea / 1e6;
        break;
    }
    return num / den;
  }

  render() {
    if (this.state.data) {
      // Find the maximum value of the user-defined function.
      const f = this.f.bind(this);
      const fmax = Math.max(...Object.values(this.state.data).map(f));

      // Create scaling and rounding helpers.
      function scale(x) {
        return 0.6 * (1 - Math.pow(Math.E, -10 * (x / fmax)));
      }
      function round(x) {
        return Math.round(x * 100 + Number.EPSILON) / 100;
      }

      // Construct polygons.
      let polygons = [];
      for (const [fips, county] of Object.entries(this.state.data)) {
        // Skip the county if it's missing data,
        if (!('population' in county) ||
            !('bounds' in county) ||
            !('latestCounts' in county)) {
          continue;
        }
        // Construct alpha and message.
        const value = f(county);
        const alpha = scale(value);
        const title = `${county.name}, ${county.state}`;
        const message =
          `${this.state.numerator} ${this.state.denominator}: ` +
          `${round(value)}\n` +
          `${county.latestCounts.cases} cases, ` +
          `${county.latestCounts.deaths} deaths`;
        // A county may be made up of multiple polygons.
        for (const [i, bound] of county.bounds.entries()) {
          polygons.push(<Polygon coordinates={bound}
                          key={`${fips}-${i}`}
                          strokeWidth={0}
                          fillColor={`rgba(255, 0, 0, ${round(alpha)})`}
                          tappable={true}
                          onPress={() => Alert.alert(title, message)} />);
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
              <Picker.Item label="Cases" value="Cases" />
              <Picker.Item label="Deaths" value="Deaths" />
            </Picker>
            <Picker selectedValue={this.state.denominator}
                    style={{ width: 200 }}
                    onValueChange={(value, index) =>
                                     this.setState({denominator: value})}>
              <Picker.Item label="Total" value="total" />
              <Picker.Item label="Per case" value="per case" />
              <Picker.Item label="Per 1,000 cap" value="per 1,000 cap" />
              <Picker.Item label="Per square km" value="per square km" />
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

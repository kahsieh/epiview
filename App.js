import React from 'react';
import { Alert, Button, Picker, StyleSheet, Text, View, Dimensions } from 'react-native';
import MapView, { Polygon } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { compileData } from './epiview.js';

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      data: null,
      polygons: [],
      numerator: 'Cases',
      denominator: 'total',
      date: new Date(),
      picking: false,
    };
  }

  /**
   * Downloads and compiles the data table, then sets this.state.data.
   */
  componentDidMount() {
    compileData().then(data => this.setState({ data }));
  }

  /**
   * Executes the user-defined function on a county.
   *
   * @param {!Object<string, *>} county Data table entry for a county.
   */
  computeValue(county) {
    // Detemine the date to be used. Stop if the county is missing data, or if
    // a usable date cannot be found.
    if (!('population' in county) ||
        !('bounds' in county) ||
        !('latestCounts' in county)) {
      return 0;
    }
    let date = Object.keys(county.counts)
                     .reverse()
                     .find(k => new Date(k) <= this.state.date);
    if (!date) {
      return 0;
    }

    // Determine the value of the numerator and denominator.
    let num, den;
    switch (this.state.numerator) {
      case 'Cases':
        num = county.counts[date].cases;
        break;
      case 'Deaths':
        num = county.counts[date].deaths;
        break;
    }
    switch (this.state.denominator) {
      case 'total':
        den = 1;
        break;
      case 'per case':
        den = county.counts[date].cases;
        break;
      case 'per 1000 cap':
        den = county.population / 1e3;
        break;
      case 'per square km':
        den = county.landArea / 1e6;
        break;
    }

    // Divide.
    return num / den;
  }

  /**
   * Creates polygons according to the data table and user-defined function,
   * then sets this.state.polygons.
   */
  computePolygons() {
    // Create the polygons array. Stop if the data table isn't available yet.
    if (!this.state.data) {
      return;
    }
    let polygons = [];

    // Find the maximum value of the user-defined function and create scaling
    // and rounding functions.
    const fmax = Math.max(...Object.values(this.state.data)
                                   .map(county => this.computeValue(county)));
    function scale(x) {
      return 0.6 * (1 - Math.pow(Math.E, -50 * (x / fmax)));
    }
    function round(x) {
      return Math.round(x * 100 + Number.EPSILON) / 100;
    }

    // Construct polygons.
    for (const [fips, county] of Object.entries(this.state.data)) {
      // Skip the county if it's missing data.
      if (!('population' in county) ||
          !('bounds' in county) ||
          !('latestCounts' in county)) {
        continue;
      }
      // Construct alpha and message.
      const value = this.computeValue(county);
      const alpha = scale(value);
      const title = `${county.name}, ${county.state}`;
      const message =
        `${this.state.numerator} ${this.state.denominator} ` +
        `on ${this.state.date.toLocaleDateString()}: ` +
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

    // Refresh.
    this.setState({ polygons });
  }

  render() {
    if (this.state.data) {
      if (!this.state.picking) {
        setTimeout(() => this.computePolygons(), 100);
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
            {this.state.polygons}
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
              <Picker.Item label="Per 1000 cap" value="per 1000 cap" />
              <Picker.Item label="Per square km" value="per square km" />
            </Picker>
          </View>
          <View style={styles.toolbar}>
            <Button onPress={() => this.setState({picking: true})}
                    title={this.state.date.toLocaleDateString()} />
            {this.state.picking && (
              <DateTimePicker value={this.state.date}
                              onChange={(e, value) => {
                                if (value) {
                                  this.setState({date: value, picking: false})
                                }
                                else {
                                  this.setState({picking: false});
                                }
                              }}
              />
            )}
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eeeeee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapStyle: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height - 65 * 2,
  },
  toolbar: {
    flexDirection: 'row',
    height: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

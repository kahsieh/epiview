import React from 'react';
import { ActivityIndicator, Alert, Button, Picker, StyleSheet, Text, View, Dimensions } from 'react-native';
import MapView, { Polygon } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { compileData } from './epiview.js';

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      // Data and polygons.
      data: null,
      polygons: [],
      // User-defined function.
      numerator: 'cases',
      denominator: 'per 1000 cap',
      date: new Date(),
      // Application state.
      recompute: false,
      picking: false,
    };
  }

  /**
   * Downloads and compiles the data table. Sets state.data and triggers a
   * recompute.
   */
  componentDidMount() {
    compileData().then(data => this.setState({data: data, recompute: true}));
  }

  /**
   * Creates polygons according to the data table and user-defined function.
   * Sets state.polygons and ends a recompute.
   */
  computePolygons() {
    // Stop if there's no data. Find the maximum value of the user-defined
    // function.
    if (!this.state.data) {
      return;
    }
    let fmax = Math.max(0, ...Object.values(this.state.data)
                                    .map(county => this.computeValue(county)));

    // If fmax is 0, change it to 1 so that we can divide by it. Then, use fmax
    // to create scale and round functions.
    if (fmax == 0) {
      fmax = 1;
    }
    const scale = x => 0.6 * (1 - Math.pow(Math.E, -50 * (x / fmax)));
    const round = x => Math.round(x * 100 + Number.EPSILON) / 100;

    // Build the polygons array by looping through counties, skipping the ones
    // that are mising data.
    let polygons = [];
    for (const [fips, county] of Object.entries(this.state.data)) {
      if (!('population' in county) ||
          !('bounds' in county) ||
          !('counts' in county)) {
        continue;
      }

      // Compute the county's value and construct alpha, title, and message.
      const value = this.computeValue(county);
      const alpha = scale(value);
      const title = `${county.name}, ${county.state}`;
      const message =
        `${round(value)} ${this.state.numerator} ${this.state.denominator}` +
        ` on ${this.state.date.toLocaleDateString()}`;

      // Create the polygons that make up the county.
      for (const [i, bound] of county.bounds.entries()) {
        polygons.push(<Polygon coordinates={bound}
                        key={`${fips}-${i}`}
                        strokeWidth={0}
                        fillColor={`rgba(255, 0, 0, ${round(alpha)})`}
                        tappable={true}
                        onPress={() => Alert.alert(title, message)} />);
      }
    }

    // Update state.
    this.setState({polygons: polygons, recompute: false});
  }

  /**
   * Executes the user-defined function to find the value of a county.
   *
   * @param {!Object<string, *>} county Data table entry for a county.
   */
  computeValue(county) {
    // Detemine the date to be used. Stop if the county is missing data, or if
    // a usable date cannot be found.
    if (!('population' in county) ||
        !('bounds' in county) ||
        !('counts' in county)) {
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
      case 'cases':
        num = county.counts[date].cases;
        break;
      case 'deaths':
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

  render() {
    // Queue the recompute, if applicable.
    if (this.state.recompute) {
      setTimeout(() => this.computePolygons(), 100);
    }

    // Create picker components.
    const numPicker =
      <Picker selectedValue={this.state.numerator}
              style={{ width: 150 }}
              onValueChange={(value, index) =>
                this.setState({numerator: value, recompute: true})}>
        <Picker.Item label='Cases' value='cases' />
        <Picker.Item label='Deaths' value='deaths' />
      </Picker>;
    const denPicker =
      <Picker selectedValue={this.state.denominator}
              style={{ width: 200 }}
              onValueChange={(value, index) =>
                this.setState({denominator: value, recompute: true})}>
        <Picker.Item label='Total' value='total' />
        <Picker.Item label='Per case' value='per case' />
        <Picker.Item label='Per 1000 cap' value='per 1000 cap' />
        <Picker.Item label='Per square km' value='per square km' />
      </Picker>;
    const datePicker =
      <DateTimePicker value={this.state.date}
                      minimumDate={new Date(2020, 0, 21)}
                      maximumDate={new Date()}
                      onChange={(e, value) => {
                        if (value) {
                          this.setState({
                            date: value,
                            picking: false,
                            recompute: true
                          });
                        }
                        else {
                          this.setState({picking: false});
                        }
                      }} />

    // Create layout.
    const usa = {
      latitude: 37.0902,
      longitude: -95.7129,
      latitudeDelta: 65.0,
      longitudeDelta: 65.0,
    };
    return (
      <View style={styles.container}>
        <MapView style={styles.map} initialRegion={usa}>
          {this.state.polygons}
        </MapView>
        {!this.state.data ? (
          <View style={styles.toolbar}>
            <ActivityIndicator size="large" color="#ee6e73" />
            <Text>Downloading data...</Text>
          </View>
        ) : this.state.recompute ? (
          <View style={styles.toolbar}>
            <ActivityIndicator size="large" color="#ee6e73" />
            <Text>Computing...</Text>
          </View>
        ) : (
          <View style={styles.toolbar}>
            <View style={styles.toolbarRow}>
              {numPicker}
              {denPicker}
            </View>
            <View style={styles.toolbarRow}>
              <Button title={this.state.date.toLocaleDateString()}
                      onPress={() => this.setState({picking: true})} />
              {this.state.picking && datePicker}
            </View>
          </View>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#eeeeee',
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height - 130,
  },
  toolbar: {
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarRow: {
    flexDirection: 'row',
    height: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

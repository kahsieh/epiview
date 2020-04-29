import React from 'react';
import { ActivityIndicator, Alert, Button, Picker, StyleSheet, Text, View, Dimensions } from 'react-native';
import MapView, { Polygon } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { compileData } from './epiview.js';

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.yesterday = new Date();
    this.yesterday.setDate(this.yesterday.getDate() - 1);
    this.state = {
      // Data and polygons.
      data: null,
      polygons: [],
      // User-defined function.
      numerator: 'cases',
      denominator: 'per 1000 cap.',
      mode: 'on',
      refDate: new Date(2020, 0, 21),
      date: this.yesterday,
      // Application state.
      recompute: false,
      refPicking: false,
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
        `${round(value)} ${this.state.numerator} ${this.state.denominator} ` +
        `${this.state.mode} ` + (this.state.mode == 'diff. btw.' ?
        this.state.refDate.toLocaleDateString() + ' and ' : '') +
        this.state.date.toLocaleDateString();

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
   * @param {?Date} date The date at which to evaluate the function.
   */
  computeValue(county, date) {
    // Stop if the county is missing data.
    if (!('population' in county) ||
        !('bounds' in county) ||
        !('counts' in county)) {
      return 0;
    }

    // If no date was specified, set date based on the mode. Compute the value
    // on a reference date of necessary.
    let refValue = 0;
    if (!date) {
      date = this.state.date;
      if (this.state.mode == 'diff. btw.') {
        refValue = this.computeValue(county, this.state.refDate);
      }
    }

    // Detemine the actual date to be used. Stop if a usable date cannot be
    // found.
    let actualDate = Object.keys(county.counts)
                           .reverse()
                           .find(k => new Date(k) <= date);
    if (!actualDate) {
      return 0;
    }

    // Determine the value of the numerator and denominator.
    let num, den;
    switch (this.state.numerator) {
      case 'cases':
        num = county.counts[actualDate].cases;
        break;
      case 'deaths':
        num = county.counts[actualDate].deaths;
        break;
    }
    switch (this.state.denominator) {
      case 'total':
        den = 1;
        break;
      case 'per case':
        den = county.counts[actualDate].cases;
        break;
      case 'per 1000 cap.':
        den = county.population / 1e3;
        break;
      case 'per sq. km.':
        den = county.landArea / 1e6;
        break;
    }

    // Divide.
    return num / den - refValue;
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
        <Picker.Item label='Per 1000 cap.' value='per 1000 cap.' />
        <Picker.Item label='Per sq. km.' value='per sq. km.' />
      </Picker>;
    const modePicker =
      <Picker selectedValue={this.state.mode}
              style={{ width: 150 }}
              onValueChange={(value, index) =>
                this.setState({mode: value, recompute: true})}>
        <Picker.Item label='On' value='on' />
        <Picker.Item label='Diff. btw.' value='diff. btw.' />
      </Picker>;
    const refDatePicker =
      <DateTimePicker value={this.state.refDate}
                      minimumDate={new Date(2020, 0, 21)}
                      maximumDate={this.yesterday}
                      onChange={(e, value) => {
                        if (value) {
                          this.setState({
                            refDate: value,
                            refPicking: false,
                            recompute: true,
                          });
                        }
                        else {
                          this.setState({refPicking: false});
                        }
                      }} />;
    const datePicker =
      <DateTimePicker value={this.state.date}
                      minimumDate={new Date(2020, 0, 21)}
                      maximumDate={this.yesterday}
                      onChange={(e, value) => {
                        if (value) {
                          this.setState({
                            date: value,
                            picking: false,
                            recompute: true,
                          });
                        }
                        else {
                          this.setState({picking: false});
                        }
                      }} />;

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
              {modePicker}
              {this.state.mode == 'diff. btw.' &&
                <Button title={this.state.refDate.toLocaleDateString()}
                        onPress={() => this.setState({refPicking: true})} />
              }
              {this.state.refPicking && refDatePicker}
              {this.state.mode == 'diff. btw.' &&
                <Text>  and  </Text>
              }
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

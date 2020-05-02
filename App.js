import React from 'react';
import { ActivityIndicator, Alert, Button, Picker, StyleSheet, Text, View, Dimensions } from 'react-native';
import MapView, { Polygon } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { compileData, parseDate } from './epiview.js';

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      // Data.
      data: null,
      minimumDate: parseDate('2020-01-21'),
      maximumDate: new Date(),
      polygons: [],
      // User-defined function.
      numerator: 'new cases',
      denominator: 'per 1000 cap.',
      mode: 'on',
      refDate: new Date(),
      date: new Date(),
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
    compileData().then(res => {
      const refDate = parseDate(res.maximumDate);
      refDate.setDate(refDate.getDate() - 7);
      this.setState({
        data: res.data,
        maximumDate: parseDate(res.maximumDate),
        refDate: refDate,
        date: parseDate(res.maximumDate),
        recompute: true,
      });
    });
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

      // Compute the county's value and construct title, message, and alpha.
      const value = this.computeValue(county);
      const title = `${county.name}, ${county.state}`;
      const message =
        `${round(value)} ${this.state.numerator} ${this.state.denominator} ` +
        `${this.state.mode} ` + (this.state.mode != 'on' ?
        this.state.refDate.toLocaleDateString() + '–' : '') +
        this.state.date.toLocaleDateString();
      let red = 255, blue = 0;
      if (value < 0) {  // render negative values in blue
        value = -value;
        red = 0, blue = 255;
      }
      const alpha = scale(value);

      // Create the polygons that make up the county.
      for (const [i, bound] of county.bounds.entries()) {
        polygons.push(<Polygon coordinates={bound}
                        key={`${fips}-${i}`}
                        strokeWidth={0}
                        fillColor={`rgba(${red}, 0, ${blue}, ${round(alpha)})`}
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

    // If date is specified, determine the actual date to be used based on the
    // available data. Stop if a usable date cannot be found.
    let adjust = x => x;
    let actualDate;
    if (date) {
      actualDate = Object.keys(county.counts)
                         .reverse()
                         .find(k => parseDate(k) <= date);
      if (!actualDate) {
        return 0;
      }
    }
    // If no date is specified, set date based on the current state, then
    // determine the actual date to be used based on the available data. Stop
    // if a usable date cannot be found.
    else {
      date = this.state.date;
      actualDate = Object.keys(county.counts)
                         .reverse()
                         .find(k => parseDate(k) <= date);
      if (!actualDate) {
        return 0;
      }
      // If no date is specified (i.e., this isn't a recursive call), then
      // possibly set an adjustment function based on the mode.
      switch (this.state.mode) {
        case 'on':
          // Leave adjustment function as identity.
          break;
        case 'diff. btw.':
          adjust = x => x - this.computeValue(county, this.state.refDate);
          break;
        case 'avg.':
          adjust = x => {
            let arr = [x];
            let d = new Date(date);
            while (d.setDate(d.getDate() - 1) >= this.state.refDate) {
              arr.push(this.computeValue(county, d));
            }
            return arr.reduce((sum, v) => sum + v, 0) / arr.length;
          };
          break;
      }
    }

    // Determine the value of the numerator and denominator.
    let num, den;
    switch (this.state.numerator) {
      case 'cases':
        num = county.counts[actualDate].cases;
        break;
      case 'new cases':
        num = county.counts[actualDate].cases;
        // Subtract the previous day's number, if it's available.
        let d = new Date(date);
        d.setDate(d.getDate() - 1);
        let actualPrevDate = Object.keys(county.counts)
                                   .reverse()
                                   .find(k => parseDate(k) <= d);
        if (actualPrevDate) {
          num -= county.counts[actualPrevDate].cases;
        }
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

    // Divide and adjust.
    return adjust(num / den);
  }

  render() {
    // Queue the recompute, if applicable.
    if (this.state.recompute) {
      setTimeout(() => this.computePolygons(), 100);
    }

    // Create picker components.
    const numPicker =
      <Picker selectedValue={this.state.numerator}
              style={{ width: 160 }}
              onValueChange={(value, index) =>
                this.setState({numerator: value, recompute: true})}>
        <Picker.Item label='Cases' value='cases' />
        <Picker.Item label='New cases' value='new cases' />
        <Picker.Item label='Deaths' value='deaths' />
      </Picker>;
    const denPicker =
      <Picker selectedValue={this.state.denominator}
              style={{ width: 180 }}
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
        <Picker.Item label='Avg.' value='avg.' />
      </Picker>;
    const refDatePicker =
      <DateTimePicker value={this.state.refDate}
                      minimumDate={this.state.minimumDate}
                      maximumDate={this.state.maximumDate}
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
                      minimumDate={this.state.minimumDate}
                      maximumDate={this.state.maximumDate}
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
              {this.state.mode != 'on' &&
                <Button title={this.state.refDate.toLocaleDateString()}
                        onPress={() => this.setState({refPicking: true})} />
              }
              {this.state.refPicking && refDatePicker}
              {this.state.mode != 'on' &&
                <Text> – </Text>
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

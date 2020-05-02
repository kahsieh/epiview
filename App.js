import React from 'react';
import { ActivityIndicator, Alert, Button, Picker, StyleSheet, Text, View, Dimensions } from 'react-native';
import MapView, { Polygon } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { compileData, evaluate, parseDate } from './epiview.js';

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      // Data.
      data: null,  // set in componentDidMount
      minDate: new Date(),  // set in componentDidMount
      maxDate: new Date(),  // set in componentDidMount
      polygons: [],
      // User-defined function.
      numerator: 'new cases',
      denominator: 'per 1000 cap.',
      mode: 'on',
      refDate: new Date(),  // initial value set in componentDidMount
      date: new Date(),  // initial value set in componentDidMount
      // Application state.
      recompute: false,
      refPicking: false,
      picking: false,
    };
  }

  /**
   * Downloads and compiles the data table. Sets data and data-dependent state
   * variables and triggers a recompute.
   */
  componentDidMount() {
    compileData().then(res => {
      const refDate = parseDate(res.maxDate);
      refDate.setDate(refDate.getDate() - 7);
      this.setState({
        data: res.data,
        minDate: parseDate(res.minDate),
        maxDate: parseDate(res.maxDate),
        refDate: refDate,
        date: parseDate(res.maxDate),
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
    let fmax = Math.max(0, ...Object.values(this.state.data).map(county =>
      evaluate(county, this.state.date, this.state.numerator,
        this.state.denominator, this.state.mode, this.state.refDate)));

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
      const value = evaluate(county,this.state.date, this.state.numerator,
        this.state.denominator, this.state.mode, this.state.refDate);
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
                      minimumDate={this.state.minDate}
                      maximumDate={this.state.maxDate}
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
                      minimumDate={this.state.minDate}
                      maximumDate={this.state.maxDate}
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

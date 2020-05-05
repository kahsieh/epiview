import React from "react";
import { ActivityIndicator, Button, Picker, StyleSheet, Text, View, Dimensions } from "react-native";
import MapView from "react-native-maps";
import DateTimePicker from "@react-native-community/datetimepicker";

import EpiViewTable from "./struct/EpiViewTable.js";
import EpiViewTable_COVID19_UnitedStates, { UNITED_STATES } from "./struct/EpiViewTable_COVID19_UnitedStates.js";
import EpiViewTable_COVID19_LosAngeles, { LOS_ANGELES } from "./struct/EpiViewTable_COVID19_LosAngeles.js";

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.table_us = new EpiViewTable();
    this.table_la = new EpiViewTable();
    this.table = this.table_us;
    this.state = {
      // UI state.
      region: UNITED_STATES,  // currently used as initial region
      polygons: [],
      recompute: false,
      pickingRefDate: false,
      pickingDate: false,
      // User-defined function (UDF).
      numerator: "daily new cases (U.S.)",
      denominator: "per 1000 population",
      mode: "on",
      refDate: new Date(),
      date: new Date(),
    };
  }

  /**
   * Compiles the data tables. Sets data and data-dependent state
   * variables and triggers a recompute.
   */
  async componentDidMount() {
    const promise_us = new EpiViewTable_COVID19_UnitedStates().compile();
    const promise_la = new EpiViewTable_COVID19_LosAngeles().compile();
    this.table_us = await promise_us;
    this.table_la = await promise_la;
    this.table = this.table_us;
    const refDate = new Date(this.table.maxDate);
    refDate.setDate(refDate.getDate() - 7);
    this.setState({
      recompute: true,
      refDate: refDate,
      date: new Date(this.table.maxDate),
    });
  }

  /**
   * Returns the appropriate EpiViewTable for the region.
   * 
   * @param {!Object<string, number>} region A MapView Region.
   * @return {!EpiViewTable} The corresponding EpiViewTable.
   */
  getTable(region) {
    if (Math.abs(region.latitude - LOS_ANGELES.latitude) <
          LOS_ANGELES.latitudeDelta / 2 &&
        Math.abs(region.longitude - LOS_ANGELES.longitude) <
          LOS_ANGELES.longitudeDelta / 2 &&
        region.latitudeDelta <= LOS_ANGELES.latitudeDelta &&
        region.longitudeDelta <= LOS_ANGELES.longitudeDelta) {
      return this.table_la;
    }
    else {
      return this.table_us;
    }
  }

  render() {
    // Queue a recompute, if needed.
    if (this.state.recompute) {
      setTimeout(() => {
        this.setState({
          polygons: this.table.computePolygons(this.state),
          recompute: false,
        });
      }, 100);
    }

    // Create picker components.
    const numPicker =
      <Picker selectedValue={this.state.numerator}
              style={{ width: 180 }}
              onValueChange={(value, index) => {
                this.table = index < 4 ? this.table_us : this.table_la;
                this.setState({numerator: value, recompute: true});
              }}>
        <Picker.Item label="U.S. Cases"
                     value="cases (U.S.)" />
        <Picker.Item label="U.S. Daily new cases"
                     value="daily new cases (U.S.)" />
        <Picker.Item label="U.S. Deaths"
                     value="deaths (U.S.)" />
        <Picker.Item label="U.S. Daily new deaths"
                     value="daily new deaths (U.S.)" />
        <Picker.Item label="L.A. Cases"
                     value="cases (L.A.)" />
        <Picker.Item label="L.A. Daily new cases"
                     value="daily new cases (L.A.)" />
      </Picker>;
    const denPicker =
      <Picker selectedValue={this.state.denominator}
              style={{ width: 180 }}
              onValueChange={(value, index) =>
                this.setState({denominator: value, recompute: true})}>
        <Picker.Item label="Total" value="total" />
        <Picker.Item label="Per case" value="per case" />
        <Picker.Item label="Per 1000 pop." value="per 1000 population" />
        <Picker.Item label="Per sq. mi." value="per sq. mi." />
      </Picker>;
    const modePicker =
      <Picker selectedValue={this.state.mode}
              style={{ width: 150 }}
              onValueChange={(value, index) =>
                this.setState({mode: value, recompute: true})}>
        <Picker.Item label="On" value="on" />
        <Picker.Item label="Diff. btw." value="differenced between" />
        <Picker.Item label="Avg." value="averaged" />
      </Picker>;
    const refDatePicker =
      <DateTimePicker value={this.state.refDate}
                      minimumDate={this.table.minDate}
                      maximumDate={this.table.maxDate}
                      onChange={(e, value) => {
                        if (value) {
                          this.setState({
                            refDate: value,
                            pickingRefDate: false,
                            recompute: true,
                          });
                        }
                        else {
                          this.setState({pickingRefDate: false});
                        }
                      }} />;
    const datePicker =
      <DateTimePicker value={this.state.date}
                      minimumDate={this.table.minDate}
                      maximumDate={this.table.maxDate}
                      onChange={(e, value) => {
                        if (value) {
                          this.setState({
                            date: value,
                            pickingDate: false,
                            recompute: true,
                          });
                        }
                        else {
                          this.setState({pickingDate: false});
                        }
                      }} />;

    // Create layout.
    return (
      <View style={styles.container}>
        <MapView style={styles.map}
                 initialRegion={this.state.region}>
          {this.state.polygons}
        </MapView>
        {Object.keys(this.table.data).length == 0 ? (
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
              {this.state.mode != "on" &&
                <Button title={this.state.refDate.toLocaleDateString()}
                        onPress={() => this.setState({pickingRefDate: true})} />
              }
              {this.state.pickingRefDate && refDatePicker}
              {this.state.mode != "on" &&
                <Text> – </Text>
              }
              <Button title={this.state.date.toLocaleDateString()}
                      onPress={() => this.setState({pickingDate: true})} />
              {this.state.pickingDate && datePicker}
            </View>
          </View>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#eeeeee",
  },
  map: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height - 130,
  },
  toolbar: {
    height: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarRow: {
    flexDirection: "row",
    height: 65,
    alignItems: "center",
    justifyContent: "center",
  },
});

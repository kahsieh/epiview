import React from "react";
import { ActivityIndicator, Alert, Button, Picker, StyleSheet, Text, View, Dimensions } from "react-native";
import MapView, { Polygon } from "react-native-maps";
import DateTimePicker from "@react-native-community/datetimepicker";

import EpiViewTable from "./struct/EpiViewTable.js";
import EpiViewTable_COVID19_UnitedStates from "./struct/EpiViewTable_COVID19_UnitedStates.js";
import EpiViewTable_COVID19_LosAngeles from "./struct/EpiViewTable_COVID19_LosAngeles.js";

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      // Data.
      table: new EpiViewTable(),
      polygons: [],
      // User-defined function (UDF).
      numerator: "new cases",
      denominator: "per 1000 cap.",
      mode: "on",
      refDate: new Date(),  // initial value set in componentDidMount
      date: new Date(),  // initial value set in componentDidMount
      // UI state.
      recompute: false,
      refPicking: false,
      picking: false,
    };
  }

  /**
   * Downloads and compiles the data table. Sets data and data-dependent state
   * variables and triggers a recompute.
   */
  async componentDidMount() {
    const res = await new EpiViewTable_COVID19_LosAngeles().compile();
    const refDate = new Date(res.maxDate);
    refDate.setDate(refDate.getDate() - 7);
    this.setState({
      table: res,
      refDate: refDate,
      date: new Date(res.maxDate),
      recompute: true,
    });
  }

  render() {
    // Queue the recompute, if applicable.
    if (this.state.recompute && this.state.table) {
      setTimeout(() => {
        this.setState({
          polygons: this.state.table.computePolygons(this.state),
          recompute: false
        });
      }, 100);
    }

    // Create picker components.
    const numPicker =
      <Picker selectedValue={this.state.numerator}
              style={{ width: 180 }}
              onValueChange={(value, index) =>
                this.setState({numerator: value, recompute: true})}>
        <Picker.Item label="Cases" value="cases" />
        <Picker.Item label="New cases" value="new cases" />
        <Picker.Item label="Deaths" value="deaths" />
        <Picker.Item label="New deaths" value="new deaths" />
      </Picker>;
    const denPicker =
      <Picker selectedValue={this.state.denominator}
              style={{ width: 180 }}
              onValueChange={(value, index) =>
                this.setState({denominator: value, recompute: true})}>
        <Picker.Item label="Total" value="total" />
        <Picker.Item label="Per case" value="per case" />
        <Picker.Item label="Per 1000 cap." value="per 1000 cap." />
        <Picker.Item label="Per sq. mi." value="per sq. mi." />
      </Picker>;
    const modePicker =
      <Picker selectedValue={this.state.mode}
              style={{ width: 150 }}
              onValueChange={(value, index) =>
                this.setState({mode: value, recompute: true})}>
        <Picker.Item label="On" value="on" />
        <Picker.Item label="Diff. btw." value="diff. btw." />
        <Picker.Item label="Avg." value="avg." />
      </Picker>;
    const refDatePicker =
      <DateTimePicker value={this.state.refDate}
                      minimumDate={this.state.table.minDate}
                      maximumDate={this.state.table.maxDate}
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
                      minimumDate={this.state.table.minDate}
                      maximumDate={this.state.table.maxDate}
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
    const la = {
      latitude: 34.0522,
      longitude: -118.2437,
      latitudeDelta: 1.5,
      longitudeDelta: 1.5,
    };
    return (
      <View style={styles.container}>
        <MapView style={styles.map} initialRegion={la}>
          {this.state.polygons}
        </MapView>
        {!this.state.table ? (
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
                        onPress={() => this.setState({refPicking: true})} />
              }
              {this.state.refPicking && refDatePicker}
              {this.state.mode != "on" &&
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

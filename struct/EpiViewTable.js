/*
EpiView
EpiViewTable.js

Copyright (c) 2020 Kevin Hsieh. All Rights Reserved.
*/

import React from "react";
import { Alert } from "react-native";
import { Polygon } from "react-native-maps";

/**
 * Holds a collection of EpiViewEntrys.
 *
 * EpiViewTable {
 *   "data": {
 *     key: EpiViewEntry,
 *   },
 *   "minDate": Date,  // Corresponds to smallest key in data.*.counts.
 *   "maxDate": Date,  // Corresponds to largest key in data.*.counts.
 * }
 */
export default class EpiViewTable {
  constructor() {
    this.data = {};
    this.minDate = new Date();
    this.maxDate = new Date();
  }

  /**
   * Joins population, boundary, and case count data to produce a unified data
   * table.
   */
  compile() {
    throw "unsupported";
  }

  /**
   * Populates the table with population data.
   */
  addPopulation() {
    throw "unsupported";
  }

  /**
   * Populates the table with boundary data.
   */
  addBounds() {
    throw "unsupported";
  }

  /**
   * Populates the table with case count data.
   */
  addCounts() {
    throw "unsupported";
  }

  /**
   * Computes Polygons to represent this EpiViewTable according to a user-
   * defined function (UDF).
   *
   * @param {!Object<string, *>} udf An object representing the UDF: {
   *   "numerator": string,
   *   "denominator": string,
   *   "mode": string,
   *   "refDate": ?Date,
   *   "date": !Date,
   * }
   * @return {!Array<Polygon>} Polygons representing this EpiViewTable.
   */
  computePolygons(udf) {
    // Find the maximum value of the UDF. If it's 0, change it to 1 so that we
    // can divide by it. Then, create scale and round functions.
    let fmax = Math.max(0, ...Object.values(this.data)
                                    .map(entry => entry.evaluate(udf)));
    if (fmax === 0) {
      fmax = 1;
    }
    const scale = x => 0.6 * (1 - Math.pow(Math.E, -10 * (x / fmax)));
    const round = x => Math.round(x * 1000 + Number.EPSILON) / 1000;

    // Build the polygons array by looping through entries, skipping the ones
    // that are incomplete.
    let polygons = [];
    for (const [key, entry] of Object.entries(this.data)) {
      if (!entry.complete()) {
        continue;
      }

      // Compute the entry's value and construct title, message, and color.
      const value = entry.evaluate(udf);
      const title = `${entry.name}, ${entry.region}`;
      const message =
        `${round(value)} ${udf.numerator.replace(/ \(.*\)/, "")} ` +
        `${udf.denominator} ${udf.mode} ` +
        (udf.mode != "on" ? udf.refDate.toLocaleDateString() + "-" : "") +
        udf.date.toLocaleDateString() +
        ` [α=${value > 0 ? round(scale(value)) : -round(scale(-value))}]`;
      const color = value > 0 ? `rgba(255, 0, 0, ${round(scale(value))})`
                              : `rgba(0, 0, 255, ${round(scale(-value))})`;

      // Create the polygons that make up the entry.
      for (const [i, bound] of entry.bounds.entries()) {
        polygons.push(<Polygon coordinates={bound}
                        key={`${key}-${i}`}
                        strokeWidth={0}
                        fillColor={color}
                        tappable={true}
                        onPress={() => Alert.alert(title, message)} />);
      }
    }
    return polygons;
  }
}

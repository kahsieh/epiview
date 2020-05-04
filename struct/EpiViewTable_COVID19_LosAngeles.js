/*
EpiView
EpiViewTable_COVID19_LosAngeles.js

Copyright (c) 2020 Kevin Hsieh. All Rights Reserved.
*/

import EpiViewEntry, { parseCoord, parseDate } from "./EpiViewEntry.js";
import EpiViewTable from "./EpiViewTable.js";

/**
 * Los Angeles Neighborhood-level Population Data
 * Source: L.A. Times (converted from HTML)
 * Information: http://maps.latimes.com/
 * Data: http://maps.latimes.com/neighborhoods/population/total/neighborhood/list/
 */
import rawPopulation from "../assets/local-data/la-county-population.json";

/**
 * Los Angeles Neighborhood-level Boundary Data
 * Source: L.A. Times
 * Information: http://boundaries.latimes.com/sets/
 * Data: http://s3-us-west-2.amazonaws.com/boundaries.latimes.com/archive/1.0/boundary-set/la-county-neighborhoods-v6.geojson
 */
import rawBounds from "../assets/local-data/la-county-neighborhoods-v6.json";

/**
 * Los Angeles Neighborhood-level Case Count Data
 * Source: ?
 */
const rawCountsUrl = "";

/**
 * Holds a collection of EpiViewEntrys.
 * 
 * EpiViewTable_UnitedStates {
 *   "data": {
 *     key: EpiViewEntry,
 *   },
 *   "minDate": Date,  // Corresponds to smallest key in data.*.counts.
 *   "maxDate": Date,  // Corresponds to largest key in data.*.counts.
 * }
 */
export default class EpiViewTable_COVID19_LosAngeles extends EpiViewTable {
  constructor() {
    super();
  }

  /**
   * Joins population, boundary, and case count data to produce a unified data
   * table.
   */
  async compile() {
    this.addPopulation(rawPopulation);
    this.addBounds(rawBounds);
    await this.addCounts(rawCountsUrl);
    return this;
  }

  /**
   * Populates the table with population data.
   *
   * @param {!Array<Object<string, *>>} rawPopulation Raw population data from
   *     the L.A. Times.
   */
  addPopulation(rawPopulation) {
    for (const row of rawPopulation) {
      // Get name and initialize.
      const name = row.name;
      if (!(name in this.data)) {
        this.data[name] = new EpiViewEntry(name, "Los Angeles, California");
      }
      // Populate data.
      this.data[name].population = row.population;
      this.data[name].area = row.area_sqmi;
    }
  }

  /**
   * Populates the table with boundary data.
   *
   * @param {!Object<string, *>} rawBounds Raw boundary data from the L.A.
   *     Times.
   */
  addBounds(rawBounds) {
    for (const feature of rawBounds.features) {
      // Get name and initialize.
      const name = feature.properties.name;
      if (!(name in this.data)) {
        this.data[name] = new EpiViewEntry(feature.properties.NAME,
                            "State " + feature.properties.STATEFP);
      }
      // Populate data.
      switch (feature.geometry.type) {
        case "Polygon":
          const bound = feature.geometry.coordinates;
          this.data[name].bounds.push(bound[0].map(parseCoord));
          break;
        case "MultiPolygon":
          for (const bound of feature.geometry.coordinates) {
            this.data[name].bounds.push(bound[0].map(parseCoord));
          }
          break;
      }
    }
  }

  /**
   * Populates the table with case count data.
   *
   * @param {string} rawCountsUrl URL of raw case count data.
   */
  async addCounts(rawCountsUrl) {
    let minDate = "2020-05-02", maxDate = "2020-05-02";
    for (const entry of Object.values(this.data)) {
      entry.counts = {
        "2020-05-02": {
          cases: 1,
          deaths: 1,
        },
      };
    }
    this.minDate = parseDate(minDate);
    this.maxDate = parseDate(maxDate);
  }
}

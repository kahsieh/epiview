/*
EpiView
EpiViewTable_COVID19_UnitedStates.js

Copyright (c) 2020 Kevin Hsieh. All Rights Reserved.
*/

import EpiViewEntry, { parseCoord, parseCsv, parseDate } from "./EpiViewEntry.js";
import EpiViewTable from "./EpiViewTable.js";

/**
 * United States County-level Population Data
 * Source: U.S. Census Bureau (converted from CSV)
 * Information: https://www.census.gov/programs-surveys/popest/data/data-sets.html
 * Data: https://www2.census.gov/programs-surveys/popest/datasets/2010-2019/counties/totals/co-est2019-alldata.csv
 */
import rawPopulation from "../assets/us-data/co-est2019-alldata.json";

/**
 * United States County-level Boundary and Area Data
 * Source: U.S. Census Bureau (converted from SHP)
 * Information: https://www.census.gov/geographies/mapping-files/time-series/geo/carto-boundary-file.html
 * Data: https://www2.census.gov/geo/tiger/GENZ2018/shp/cb_2018_us_county_20m.zip
 */
import rawBounds from "../assets/us-data/cb_2018_us_county_20m.json";

/**
 * United States County-level Case Count Data
 * Source: The New York Times
 * Information: https://github.com/nytimes/covid-19-data
 */
const rawCountsUrl = "https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-counties.csv";

/**
 * United States general location.
 */
export const UNITED_STATES = {
  latitude: 37.0902,
  longitude: -95.7129,
  latitudeDelta: 65.0,
  longitudeDelta: 65.0,
};

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
export default class EpiViewTable_COVID19_UnitedStates extends EpiViewTable {
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
   * @param {!Array<Object<string, string>>} rawPopulation Raw population data
   *     from the U.S. Census Bureau.
   */
  addPopulation(rawPopulation) {
    for (const row of rawPopulation) {
      // Get FIPS code and initialize.
      const fips = row.STATE.padStart(2, "0") + row.COUNTY.padStart(3, "0");
      if (!(fips in this.data)) {
        this.data[fips] = new EpiViewEntry(row.CTYNAME, row.STNAME);
      }
      // Populate data.
      this.data[fips].population = row.POPESTIMATE2018;
    }

    // Special handling for New York City.
    const nyc = "36000";
    if (!(nyc in this.data)) {
      this.data[nyc] = new EpiViewEntry("New York City", "New York");
    }
    this.data[nyc].population = BOROUGHS.reduce(
      (total, fips) => total + +this.data[fips].population);
  }

  /**
   * Populates the table with boundary (and area) data.
   *
   * @param {!Object<string, *>} rawBounds Raw boundary data from the U.S.
   *     Census Bureau in GeoJSON format.
   */
  addBounds(rawBounds) {
    for (const feature of rawBounds.features) {
      // Get FIPS code and initialize.
      const fips = feature.properties.GEOID;
      if (!(fips in this.data)) {
        this.data[fips] = new EpiViewEntry(feature.properties.NAME,
                                           feature.properties.STATEFP);
      }
      // Populate data. Convert land area from square meters to square miles.
      // A square mile is defined as exactly 2589988.110336 square meters.
      this.data[fips].area += feature.properties.ALAND / 2589988.110336;
      switch (feature.geometry.type) {
        case "Polygon":
          const bound = feature.geometry.coordinates;
          this.data[fips].bounds.push(bound[0].map(parseCoord));
          break;
        case "MultiPolygon":
          for (const bound of feature.geometry.coordinates) {
            this.data[fips].bounds.push(bound[0].map(parseCoord));
          }
          break;
      }
    }

    // Special handling for New York City.
    const nyc = "36000";
    if (!(nyc in this.data)) {
      this.data[fips] = new EpiViewEntry("New York City", "New York");
    }
    if (!("bounds" in this.data[nyc])) {
      this.data[nyc].bounds = [];
    }
    this.data[nyc].area = BOROUGHS.reduce(
      (total, fips) => total + this.data[fips].area);
    this.data[nyc].bounds = BOROUGHS.reduce(
      (total, fips) => total.concat(this.data[fips].bounds), []);
  }

  /**
   * Populates the table with case count data.
   *
   * @param {string} rawCountsUrl URL of raw case count data from The New York
   *     Times.
   */
  async addCounts(rawCountsUrl) {
    const rawCounts = await fetch(rawCountsUrl).then(res => res.text())
                                               .then(parseCsv);
    let minDate = "", maxDate = "";
    for (const row of rawCounts) {
      // Get FIPS code and initialize.
      const fips = row.county === "New York City" ? "36000" : row.fips;
      if (!(fips in this.data)) {
        this.data[fips] = new EpiViewEntry(row.county + " County", row.state);
      }
      // Populate data.
      this.data[fips].counts[row.date] = {
        cases: +row.cases,
        deaths: +row.deaths,
      };
      if (minDate === "" || row.date < minDate) {
        minDate = row.date;
      }
      if (maxDate === "" || row.date > maxDate) {
        maxDate = row.date;
      }
    }
    this.minDate = parseDate(minDate);
    this.maxDate = parseDate(maxDate);
  }
}

/**
 * FIPS codes for the boroughs of NYC. Used for special handling.
 */
const BOROUGHS = [
  36061,  // New York
  36047,  // Kings
  36081,  // Queens
  36005,  // Bronx
  36085,  // Richmond
];

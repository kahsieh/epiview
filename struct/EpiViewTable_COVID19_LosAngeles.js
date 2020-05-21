/*
EpiView
EpiViewTable_COVID19_LosAngeles.js

Copyright (c) 2020 Kevin Hsieh. All Rights Reserved.
*/

import EpiViewEntry, { parseCoord, parseCsv, parseDate } from "./EpiViewEntry.js";
import EpiViewTable from "./EpiViewTable.js";

/**
 * Los Angeles Neighborhood-level Population (and Area) Data
 * Source: L.A. Times (converted from HTML)
 * Information: http://maps.latimes.com/
 * Data: http://maps.latimes.com/neighborhoods/population/total/neighborhood/list/
 */
import rawPopulation from "../assets/la-data/la-county-population.json";

/**
 * Los Angeles Neighborhood-level Boundary Data
 * Source: L.A. Times
 * Information: http://boundaries.latimes.com/sets/
 * Data: http://s3-us-west-2.amazonaws.com/boundaries.latimes.com/archive/1.0/boundary-set/la-county-neighborhoods-v6.geojson
 */
import rawBounds from "../assets/la-data/la-county-neighborhoods-v6.json";

/**
 * Orange County Place-level Population, Boundary, and Area Data
 * Source: O.C. Public Works
 * Information: https://data-ocpw.opendata.arcgis.com/datasets/9afb06dcf6b24f7cbc6599e47ecc9f27_0
 * Data: https://opendata.arcgis.com/datasets/9afb06dcf6b24f7cbc6599e47ecc9f27_0.geojson
 */
import rawOC from "../assets/la-data/orange-county.json";

/**
 * California Neighborhood-level Case Count Data
 * Source: L.A. Times
 * Information: https://github.com/datadesk/california-coronavirus-data
 * Data: https://raw.githubusercontent.com/datadesk/california-coronavirus-data/master/latimes-place-totals.csv
 */
const rawCountsUrl = "https://raw.githubusercontent.com/datadesk/california-coronavirus-data/master/latimes-place-totals.csv";

/**
 * Los Angeles general location.
 */
export const LOS_ANGELES = {
  latitude: 34.0522,
  longitude: -118.2437,
  latitudeDelta: 1.5,
  longitudeDelta: 1.5,
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
    this.addOC(rawOC);
    await this.addCounts(rawCountsUrl);
    return this;
  }

  /**
   * Populates the table with population (and area) data.
   *
   * @param {!Array<Object<string, *>>} rawPopulation Raw population data from
   *     the L.A. Times.
   */
  addPopulation(rawPopulation) {
    for (const row of rawPopulation) {
      // Get name and initialize.
      const name = row.name + ", Los Angeles County, California";
      if (!(name in this.data)) {
        this.data[name] = new EpiViewEntry(row.name,
                                           "Los Angeles County, California");
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
      const name = feature.properties.name + ", Los Angeles County, California";
      if (!(name in this.data)) {
        this.data[name] = new EpiViewEntry(feature.properties.NAME,
                                           "Los Angeles County, California");
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
   * Populates the table with Orange County population, boundary, and area data.
   *
   * @param {!Object<string, *} rawOC Raw population, boundary, and area data
   *     from O.C. Public Works.
   */
  addOC(rawOC) {
    for (const feature of rawOC.features) {
      // Get name and initialize.
      const name = feature.properties.NAME10 + ", Orange County, California";
      if (name in this.data) {
        continue;  // this dataset has problematic repeats
      }
      else {
        this.data[name] = new EpiViewEntry(feature.properties.NAME10,
                                           "Orange County, California");
      }
      // Populate data. Convert land area from square meters to square miles.
      // A square mile is defined as exactly 2589988.110336 square meters.
      this.data[name].area += feature.properties.ALAND10 / 2589988.110336;
      this.data[name].population += +feature.properties.SF1_G001_VD072;
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
    const rawCounts = await fetch(rawCountsUrl).then(res => res.text())
                                               .then(parseCsv);
    let minDate = "", maxDate = "";
    for (const row of rawCounts) {
      if (row.county !== "Los Angeles" && row.county !== "Orange") {
        continue;
      }
      // Get name and initialize.
      const name = `${row.place}, ${row.county} County, California`;
      if (!(name in this.data)) {
        this.data[name] = new EpiViewEntry(row.place,
                                           `${row.county} County, California`);
      }
      // Populate data.
      if (!(row.date in this.data[name].counts)) {
        this.data[name].counts[row.date] = {
          cases: 0,
          deaths: 0,
        };
      }
      this.data[name].counts[row.date].cases += +row.confirmed_cases;
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

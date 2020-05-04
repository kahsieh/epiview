/*
EpiView
EpiViewTable.js

Copyright (c) 2020 Kevin Hsieh. All Rights Reserved.
*/

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
}

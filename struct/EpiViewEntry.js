/*
EpiView
EpiViewEntry.js

Copyright (c) 2020 Kevin Hsieh. All Rights Reserved.
*/

/**
 * Holds epidemic and related information about a particular area.
 *
 * EpiViewEntry {
 *   "name": string,
 *   "region": string,
 *   "population": number,
 *   "area": number,  // Land area in square miles.
 *   "bounds": !Array<Array<LatLng>>,
 *   "counts": {
 *     "date": {
 *       "cases": number,
 *       "deaths": number,
 *     },
 *   },
 * }
 */
export default class EpiViewEntry {
  constructor(name, region) {
    this.name = name;
    this.region = region;
    this.population = 0;
    this.area = 0;
    this.bounds = [];
    this.counts = {};
  }

  /**
   * Checks whether this entry is complete or not.
   *
   * @return {boolean} Whether this entry is complete or not.
   */
  complete() {
    return this.population !== 0 &&
           this.area !== 0 &&
           this.bounds.length !== 0 &&
           Object.keys(this.counts).length !== 0;
  }

  /**
   * Evaluates a user-defined function (UDF) specified by a numerator,
   * denominator, and mode on this entry for the given date (and possibly
   * a reference date, if the mode requires one).
   *
   * @param {!Object<string, *>} udf An object representing the UDF: {
   *   "numerator": string,
   *   "denominator": string,
   *   "mode": string,
   *   "refDate": ?Date,
   *   "date": !Date,
   * }
   * @return {number} The result of the UDF.
   */
  evaluate(udf) {
    if (!this.complete()) {
      return 0;
    }
    switch (udf.mode) {
      case "on":
        return this.evaluateBasic(udf.numerator, udf.denominator, udf.date);
      case "differenced between":
        return this.evaluateBasic(udf.numerator, udf.denominator, udf.date) -
               this.evaluateBasic(udf.numerator, udf.denominator, udf.refDate);
      case "averaged":
        let values = [];
        for (let d = new Date(udf.date); d >= udf.refDate;
             d.setDate(d.getDate() - 1)) {
          values.push(this.evaluateBasic(udf.numerator, udf.denominator, d));
        }
        return values.reduce((sum, v) => sum + v, 0) / values.length;
      default:
        throw "invalid mode";
    }
  }

  /**
   * Evalutes a basic user-defined function (basic UDF) specified by a
   * numerator and a denominator on this entry for the given date.
   *
   * @param {string} numerator The numerator of the basic UDF.
   * @param {string} denominator The denominator of the basic UDF.
   * @param {!Date} date The date on which to evaluate the basic UDF.
   * @return {number} The result of the basic UDF.
   */
  evaluateBasic(numerator, denominator, date) {
    // Find a key to the counts object that corresponds to a date on or before
    // the requested date. Stop if none is available.
    const dateStr = Object.keys(this.counts)
                          .reverse()
                          .find(k => parseDate(k) <= date);
    if (!dateStr) {
      return 0;
    }

    // Find the numerator and denominator values.
    let nval, dval;
    switch (numerator.replace(/ \(.*\)/, "")) {
      case "cases":
        nval = this.counts[dateStr].cases;
        break;
      case "daily new cases": {
        nval = this.counts[dateStr].cases;
        // Subtract the previous day's number, if it's available.
        let prevDate = new Date(date);
        prevDate.setDate(prevDate.getDate() - 1);
        let prevDateStr = Object.keys(this.counts)
                                .reverse()
                                .find(k => parseDate(k) <= prevDate);
        if (prevDateStr) {
          nval -= this.counts[prevDateStr].cases;
        }
        break;
      }
      case "deaths":
        nval = this.counts[dateStr].deaths;
        break;
      case "daily new deaths": {
        nval = this.counts[dateStr].deaths;
        // Subtract the previous day's number, if it's available.
        let prevDate = new Date(date);
        prevDate.setDate(prevDate.getDate() - 1);
        let prevDateStr = Object.keys(this.counts)
                                .reverse()
                                .find(k => parseDate(k) <= prevDate);
        if (prevDateStr) {
          nval -= this.counts[prevDateStr].deaths;
        }
        break;
      }
      default:
        throw "invalid numerator";
    }
    switch (denominator) {
      case "total":
        dval = 1;
        break;
      case "per case":
        dval = this.counts[dateStr].cases;
        break;
      case "per 100k population":
        dval = this.population / 1e5;
        break;
      case "per sq. mi.":
        dval = this.area;
        break;
      default:
        throw "invalid denominator";
    }
    return nval / dval;
  }
}

/**
 * Converts a GeoJSON coordinate to a LatLng.
 *
 * @param {!Array<string>} coord A GeoJSON coordinate.
 * @return {!LatLng} The equivalent LatLng.
 */
export function parseCoord(coord) {
  return {latitude: coord[1], longitude: coord[0]};
}

/**
 * Converts a .csv file to an object representation.
 *
 * @param {string} csv Body of .csv file, starting with a header row.
 * @return {!Array<Object>} Array of rows, each represented as an object.
 */
export function parseCsv(csv) {
  const lines = csv.split("\n").filter(line => line !== "");
  const header = lines[0].split(",");
  const data = lines.slice(1).map(row => Object.fromEntries(
    row.split(",").map((value, j) => [header[j], value])));
  return data;
}

/**
 * Converts an ISO date string (YYYY-MM-DD) to a Date object in the local time
 * zone.
 *
 * @param {string} dateStr ISO date string (YYYY-MM-DD).
 * @return {!Date} Corresponding Date object in the local time zone.
 */
export function parseDate(dateStr) {
  const parts = dateStr.split("-");
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

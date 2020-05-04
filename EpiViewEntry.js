/*
EpiView
EpiViewEntry.js

Copyright (c) 2020 Kevin Hsieh. All Rights Reserved.
*/

export default class EpiViewEntry {
  constructor(name, region) {
    this.name = name;
    this.region = region;
    this.population = null;
    this.area = null;
    this.bounds = null;
    this.counts = null;
  }

  /**
   * Checks whether this entry is complete or not.
   * 
   * @return {boolean} Whether this entry is complete or not.
   */
  complete() {
    return this.population !== null &&
           this.area !== null &&
           this.bounds !== null &&
           this.counts !== null;
  }

  /**
   * Evaluates a user-defined function (UDF) specified by a numerator,
   * denominator, and mode on this entry for the given date (and possibly
   * a reference date, if the mode requires one).
   *
   * @param {string} numerator The numerator of the UDF.
   * @param {string} denominator The denominator of the UDF.
   * @param {!Date} date The date on which to evaluate the UDF.
   * @param {?Date} refDate The reference date with which to evaluate the UDF.
   * @param {string} mode The mode of the UDF.
   * @return {number} The result of the UDF.
   */
  evaluate(numerator, denominator, date, refDate, mode) {
    if (!this.complete()) {
      return 0;
    }
    switch (mode) {
      case "on":
        return this.evaluateBasic(numerator, denominator, date);
      case "diff. btw.":
        return this.evaluateBasic(numerator, denominator, date) -
               this.evaluateBasic(numerator, denominator, refDate);
      case "avg.":
        let values = [];
        for (let d = new Date(date); d >= refDate; d.setDate(d.getDate() - 1)) {
          values.push(this.evaluateBasic(numerator, denominator, d));
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
    switch (numerator) {
      case "cases":
        nval = this.counts[dateStr].cases;
        break;
      case "new cases": {
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
      case "new deaths": {
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
      case "per 1000 cap.":
        dval = this.population / 1e3;
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

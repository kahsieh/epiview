/*
EpiView
epiview.js

Copyright (c) 2020 Kevin Hsieh. All Rights Reserved.
*/

// -----------------------------------------------------------------------------
// DATA SOURCES
// -----------------------------------------------------------------------------

/**
 * County-level Population Data
 * Source: U.S. Census Bureau (converted from CSV)
 * Information: https://www.census.gov/programs-surveys/popest/data/data-sets.html
 * Data: https://www2.census.gov/programs-surveys/popest/datasets/2010-2019/counties/totals/co-est2019-alldata.csv
 */
import rawPopulation from './assets/county-data/co-est2019-alldata.json';

/**
 * County-level Boundary Data
 * Source: U.S. Census Bureau (converted from SHP)
 * Information: https://www.census.gov/geographies/mapping-files/time-series/geo/carto-boundary-file.html
 * Data: https://www2.census.gov/geo/tiger/GENZ2018/shp/cb_2018_us_county_20m.zip
 */
import rawBounds from './assets/county-data/cb_2018_us_county_20m.json';

/**
 * County-level Case Count Data
 * Source: The New York Times
 * Information: https://github.com/nytimes/covid-19-data
 */
const rawCountsUrl = 'https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-counties.csv';

/**
 * Local-level Population Data
 * Source: L.A. Times (converted from HTML)
 * Information: http://maps.latimes.com/
 * Data: http://maps.latimes.com/neighborhoods/population/total/neighborhood/list/
 */
import rawLocalPopulation from './assets/local-data/la-county-population.json';

/**
 * Local-level Boundary Data
 * Source: L.A. Times
 * Information: http://boundaries.latimes.com/sets/
 * Data: http://s3-us-west-2.amazonaws.com/boundaries.latimes.com/archive/1.0/boundary-set/la-county-neighborhoods-v6.geojson
 */
import rawLocalBounds from './assets/local-data/la-county-neighborhoods-v6.json';

// -----------------------------------------------------------------------------
// COMPUTATION
// -----------------------------------------------------------------------------

/**
 * Evaluates a user-defined function (UDF) specified by a numerator,
 * denominator, and mode on the given county for the given date (and possibly
 * a reference date if the mode requires one).
 *
 * @param {!Object<string, *>} county Data table entry for a county.
 * @param {!Date} date The date on which to evaluate the UDF.
 * @param {string} numerator The numerator of the UDF.
 * @param {string} denominator The denominator of the UDF.
 * @param {string} mode The mode of the UDF.
 * @param {?Date} refDate The reference date with which to evaluate the UDF.
 */
export function evaluate(county, date, numerator, denominator, mode, refDate) {
  // Stop if the county is missing data.
  if (!('population' in county) ||
      !('bounds' in county) ||
      !('counts' in county)) {
    return 0;
  }

  switch (mode) {
    case 'on':
      return evaluateBasic(county, date, numerator, denominator);
    case 'diff. btw.':
      return evaluateBasic(county, date, numerator, denominator) -
             evaluateBasic(county, refDate, numerator, denominator);
    case 'avg.':
      let values = [];
      for (let d = new Date(date); d >= refDate; d.setDate(d.getDate() - 1)) {
        values.push(evaluateBasic(county, d, numerator, denominator));
      }
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    default:
      return 0;  // shouldn't happen
  }
}

/**
 * Evalutes a basic user-defined function (UDF) specified by a numerator and a
 * denominator on the given county for the given date.
 *
 * @param {!Object<string, *>} county Data table entry for a county.
 * @param {!Date} date The date on which to evaluate the basic UDF.
 * @param {string} numerator The numerator of the basic UDF.
 * @param {string} denominator The denominator of the basic UDF.
 * @return {number} The result of the basic UDF.
 */
function evaluateBasic(county, date, numerator, denominator) {
  // Find a key (date string) on or before to the requested date. Stop if none
  // is available.
  const dateStr = Object.keys(county.counts)
                        .reverse()
                        .find(k => parseDate(k) <= date);
  if (!dateStr) {
    return 0;
  }

  // Set the numerator and denominator values.
  let num, den;
  switch (numerator) {
    case 'cases':
      num = county.counts[dateStr].cases;
      break;
    case 'new cases': {
      num = county.counts[dateStr].cases;
      // Subtract the previous day's number, if it's available.
      let prevDate = new Date(date);
      prevDate.setDate(prevDate.getDate() - 1);
      let prevDateStr = Object.keys(county.counts)
                              .reverse()
                              .find(k => parseDate(k) <= prevDate);
      if (prevDateStr) {
        num -= county.counts[prevDateStr].cases;
      }
      break;
    }
    case 'deaths':
      num = county.counts[dateStr].deaths;
      break;
    case 'new deaths': {
      num = county.counts[dateStr].deaths;
      // Subtract the previous day's number, if it's available.
      let prevDate = new Date(date);
      prevDate.setDate(prevDate.getDate() - 1);
      let prevDateStr = Object.keys(county.counts)
                              .reverse()
                              .find(k => parseDate(k) <= prevDate);
      if (prevDateStr) {
        num -= county.counts[prevDateStr].deaths;
      }
      break;
    }
  }
  switch (denominator) {
    case 'total':
      den = 1;
      break;
    case 'per case':
      den = county.counts[dateStr].cases;
      break;
    case 'per 1000 cap.':
      den = county.population / 1e3;
      break;
    case 'per sq. mi.':
      den = county.landArea;
      break;
  }
  return num / den;
}

// -----------------------------------------------------------------------------
// COUNTY-LEVEL DATA COMPILATION
// -----------------------------------------------------------------------------

/**
 * Retrieves and joins population, boundary, and case count data to produce a
 * unified data table for the application.
 *
 * @return {{data: !Object<string, Object<string, *>>,
 *           minDate: string, maxDate: string}}
 *     Data table and latest date available in the data. Table format:
 *     {
 *       fips: {
 *         'name': string,
 *         'state': string,
 *         'population': string,
 *         'landArea': number,
 *         'bounds': !Array<Array<LatLng>>,
 *         'counts': {
 *           'date': {
 *             'cases': string,
 *             'deaths': string,
 *           },
 *         },
 *       },
 *     }
 */
export async function compileData() {
  let data = {};
  addPopulation(data);
  addBounds(data);
  const {minDate, maxDate} = await addCounts(data);
  return {data, minDate, maxDate};
}

/**
 * Populates the data table with population data.
 *
 * @param {!Object<string, Object<string, *>>} data Data table to populate.
 */
function addPopulation(data) {
  for (const row of rawPopulation) {
    // Get FIPS code and initialize.
    const fips = row.STATE.padStart(2, '0') + row.COUNTY.padStart(3, '0');
    if (!(fips in data)) {
      data[fips] = {};
    }
    // Populate data.
    Object.assign(data[fips], {
      name: row.CTYNAME,
      state: row.STNAME,
      population: row.POPESTIMATE2018,
    });
  }

  // Special handling for New York City.
  const nyc = '36000';
  if (!(nyc in data)) {
    data[nyc] = {};
  }
  Object.assign(data[nyc], {
    name: 'New York City',
    state: 'New York',
    population: BOROUGHS.reduce(
      (total, fips) => total + +data[fips].population),
  });
}

/**
 * Populates the data table with boundary data.
 *
 * @param {!Object<string, Object<string, *>>} data Data table to populate.
 */
function addBounds(data) {
  for (const feature of rawBounds.features) {
    // Get FIPS code and initialize.
    const fips = feature.properties.GEOID;
    if (!(fips in data)) {
      data[fips] = {};
    }
    if (!('bounds' in data[fips])) {
      data[fips].bounds = [];
    }
    // Populate data. Convert land area from square meters to square miles.
    // A square mile is defined as exactly 2589988.110336 square meters.
    data[fips].landArea = (data[fips].landArea || 0)
      + feature.properties.ALAND / 2589988.110336;
    switch (feature.geometry.type) {
      case 'Polygon':
        const bound = feature.geometry.coordinates;
        data[fips].bounds.push(bound[0].map(parseCoord));
        break;
      case 'MultiPolygon':
        for (const bound of feature.geometry.coordinates) {
          data[fips].bounds.push(bound[0].map(parseCoord));
        }
        break;
    }
  }

  // Special handling for New York City.
  const nyc = '36000';
  if (!(nyc in data)) {
    data[fips] = {};
  }
  if (!('bounds' in data[nyc])) {
    data[nyc].bounds = [];
  }
  data[nyc].landArea = BOROUGHS.reduce(
    (total, fips) => total + data[fips].landArea);
  data[nyc].bounds = BOROUGHS.reduce(
    (total, fips) => total.concat(data[fips].bounds), []);
}

/**
 * Populates the data table with case count data.
 *
 * @param {!Object<string, Object<string, *>>} data Data table to populate.
 * @return {{minDate: string, maxDate: string}} The earliest and latest date
 *     available in the data.
 */
async function addCounts(data) {
  const rawCounts = await fetch(rawCountsUrl).then(res => res.text())
                                             .then(parseCsv);
  let minDate = '', maxDate = '';
  for (const row of rawCounts) {
    // Get FIPS code and initialize.
    const fips = row.county == 'New York City' ? '36000' : row.fips;
    if (!(fips in data)) {
      data[fips] = {};
    }
    if (!('counts' in data[fips])) {
      data[fips].counts = {};
    }
    // Populate data.
    data[fips].counts[row.date] = {
      cases: row.cases,
      deaths: row.deaths,
    };
    if (!minDate || row.date < minDate) {
      minDate = row.date;
    }
    if (!maxDate || row.date > maxDate) {
      maxDate = row.date;
    }
  }
  return {minDate, maxDate};
}

// -----------------------------------------------------------------------------
// LOCAL-LEVEL DATA COMPILATION
// -----------------------------------------------------------------------------

export async function compileLocalData() {
  let data = {};
  addLocalPopulation(data);
  addLocalBounds(data);
  const {minDate, maxDate} = await addLocalCounts(data);
  return {data, minDate, maxDate};
}

/**
 * Populates the data table with population data.
 *
 * @param {!Object<string, Object<string, *>>} data Data table to populate.
 */
function addLocalPopulation(data) {
  for (const row of rawLocalPopulation) {
    // Get name and initialize.
    const name = row.name;
    if (!(name in data)) {
      data[name] = {};
    }
    // Populate data.
    Object.assign(data[name], {
      population: row.population,
      landArea: row.area_sqmi,
    });
  }
}

/**
 * Populates the data table with boundary data.
 *
 * @param {!Object<string, Object<string, *>>} data Data table to populate.
 */
function addLocalBounds(data) {
  for (const feature of rawLocalBounds.features) {
    // Get name and initialize.
    const name = feature.properties.name;
    if (!(name in data)) {
      data[name] = {};
    }
    if (!('bounds' in data[name])) {
      data[name].bounds = [];
    }
    // Populate data.
    switch (feature.geometry.type) {
      case 'Polygon':
        const bound = feature.geometry.coordinates;
        data[name].bounds.push(bound[0].map(parseCoord));
        break;
      case 'MultiPolygon':
        for (const bound of feature.geometry.coordinates) {
          data[name].bounds.push(bound[0].map(parseCoord));
        }
        break;
    }
  }
}

/**
 * Populates the data table with case count data.
 *
 * @param {!Object<string, Object<string, *>>} data Data table to populate.
 * @return {{minDate: string, maxDate: string}} The earliest and latest date
 *     available in the data.
 */
async function addLocalCounts(data) {
  let minDate = '2020-05-02', maxDate = '2020-05-02';
  for (const entry of Object.values(data)) {
    entry.counts = {
      '2020-05-02': {
        cases: 1,
        deaths: 1,
      },
    };
  }
  return {minDate, maxDate};
}

// -----------------------------------------------------------------------------
// PARSERS
// -----------------------------------------------------------------------------

/**
 * Converts a GeoJSON coordinate to a LatLng.
 *
 * @param {!Array<string>} coord A GeoJSON coordinate.
 * @return {!LatLng} The equivalent LatLng.
 */
function parseCoord(coord) {
  return {latitude: coord[1], longitude: coord[0]};
}

/**
 * Converts a .csv file to an object representation.
 *
 * @param {string} csv Body of .csv file, starting with a header row.
 * @return {!Array<Object>} Array of rows, each represented as an object.
 */
function parseCsv(csv) {
  const lines = csv.split('\n');
  const header = lines[0].split(',');
  const data = lines.slice(1).map(row => Object.fromEntries(
    row.split(',').map((value, j) => [header[j], value])));
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
  const parts = dateStr.split('-');
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

// -----------------------------------------------------------------------------
// OTHER
// -----------------------------------------------------------------------------

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

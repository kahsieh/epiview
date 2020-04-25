/*
EpiView
epiview.js

Copyright (c) 2020 Kevin Hsieh. All Rights Reserved.
*/

// Source: U.S. Census Bureau
// URL: https://www.census.gov/content/census/en/data/tables/time-series/demo/popest/2010s-counties-total.html
import rawPopulation from './assets/co-est2019-alldata.json';

// Source: U.S. Census Bureau
// URL: https://www.census.gov/geographies/mapping-files/time-series/geo/carto-boundary-file.html
import rawBounds from './assets/cb_2018_us_county_20m.json';

// Source: The New York Times
const rawCountsUrl = 'https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-counties.csv';

/**
 * Retrieves and joins population, boundary, and case count data to produce a
 * unified data table for the application.
 *
 * @return {!Object<string, Object<string, *>>} Data table. Format:
 * {
 *   fips: {
 *     'name': string,
 *     'state': string,
 *     'population': number,
 *     'bounds': [[LatLng]],
 *     'counts': {
 *       'date': {
 *         'cases': number,
 *         'deaths': number,
 *       },
 *     },
 *     'latestCounts': {
 *       'cases': number,
 *       'deaths': number,
 *     }
 *   },
 * }
 */
export async function compileData() {
  let data = {};
  addPopulation(data);
  addBounds(data);
  await addCounts(data);
  return data;
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
    // Populate data.
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
}

/**
 * Populates the data table with case count data.
 *
 * @param {!Object<string, Object<string, *>>} data Data table to populate.
 */
async function addCounts(data) {
  const rawCounts = await fetch(rawCountsUrl).then(res => res.text())
                                             .then(parseCsv);
  for (const row of rawCounts) {
    // Get FIPS code and initialize.
    const fips = row.fips;
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
    data[fips].latestCounts = {
      cases: row.cases,
      deaths: row.deaths,
    };
  }
}

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

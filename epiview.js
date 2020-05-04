/*
EpiView
epiview.js

Copyright (c) 2020 Kevin Hsieh. All Rights Reserved.
*/

import EpiViewEntry from './EpiViewEntry.js';

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
 *         'region': string,
 *         'population': string,
 *         'area': number,
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
    data[fips] = new EpiViewEntry(row.CTYNAME, row.STNAME);
    data[fips].population = row.POPESTIMATE2018;
    // Object.assign(data[fips], {
    //   name: row.CTYNAME,
    //   state: row.STNAME,
    //   population: row.POPESTIMATE2018,
    // });
  }

  // Special handling for New York City.
  const nyc = '36000';
  if (!(nyc in data)) {
    data[nyc] = new EpiViewEntry('', '');
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
      data[fips] = new EpiViewEntry('', '');
    }
    if (!data[fips].bounds) {
      data[fips].bounds = [];
    }
    // Populate data. Convert land area from square meters to square miles.
    // A square mile is defined as exactly 2589988.110336 square meters.
    data[fips].area = (data[fips].area || 0)
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
    data[fips] = new EpiViewEntry('', '');
  }
  if (!('bounds' in data[nyc])) {
    data[nyc].bounds = [];
  }
  data[nyc].area = BOROUGHS.reduce(
    (total, fips) => total + data[fips].area);
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
      data[fips] = new EpiViewEntry('', '');
    }
    if (!data[fips].counts) {
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
      area: row.area_sqmi,
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

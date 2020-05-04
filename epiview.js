/*
EpiView
epiview.js

Copyright (c) 2020 Kevin Hsieh. All Rights Reserved.
*/

import EpiViewTable from './EpiViewTable.js';

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
 * @return {!Promise<EpiViewTable>} Unified data table.
 */
export async function compileData() {
  let table = new EpiViewTable();
  table.addPopulation(rawPopulation);
  table.addBounds(rawBounds);
  await table.addCounts(rawCountsUrl);
  return table;
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

/**
 * Converts a GeoJSON coordinate to a LatLng.
 *
 * @param {!Array<string>} coord A GeoJSON coordinate.
 * @return {!LatLng} The equivalent LatLng.
 */
function parseCoord(coord) {
  return {latitude: coord[1], longitude: coord[0]};
}

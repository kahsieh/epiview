/*
EpiView
EpiViewManager.js

Copyright (c) 2020 Kevin Hsieh. All Rights Reserved.
*/

import EpiViewTable_UnitedStates from "./EpiViewTable_UnitedStates.js";
import EpiViewTable_LosAngeles from "./EpiViewTable_LosAngeles.js";

/**
 * United States County-level Population Data
 * Source: U.S. Census Bureau (converted from CSV)
 * Information: https://www.census.gov/programs-surveys/popest/data/data-sets.html
 * Data: https://www2.census.gov/programs-surveys/popest/datasets/2010-2019/counties/totals/co-est2019-alldata.csv
 */
import rawPopulation_UnitedStates from "./assets/county-data/co-est2019-alldata.json";

/**
 * United States County-level  Boundary Data
 * Source: U.S. Census Bureau (converted from SHP)
 * Information: https://www.census.gov/geographies/mapping-files/time-series/geo/carto-boundary-file.html
 * Data: https://www2.census.gov/geo/tiger/GENZ2018/shp/cb_2018_us_county_20m.zip
 */
import rawBounds_UnitedStates from "./assets/county-data/cb_2018_us_county_20m.json";

/**
 * United States County-level Case Count Data
 * Source: The New York Times
 * Information: https://github.com/nytimes/covid-19-data
 */
const rawCountsUrl_UnitedStates = "https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-counties.csv";

/**
 * Los Angeles Neighborhood-level Population Data
 * Source: L.A. Times (converted from HTML)
 * Information: http://maps.latimes.com/
 * Data: http://maps.latimes.com/neighborhoods/population/total/neighborhood/list/
 */
import rawPopulation_LosAngeles from "./assets/local-data/la-county-population.json";

/**
 * Los Angeles Neighborhood-level Boundary Data
 * Source: L.A. Times
 * Information: http://boundaries.latimes.com/sets/
 * Data: http://s3-us-west-2.amazonaws.com/boundaries.latimes.com/archive/1.0/boundary-set/la-county-neighborhoods-v6.geojson
 */
import rawBounds_LosAngeles from "./assets/local-data/la-county-neighborhoods-v6.json";

/**
 * Retrieves and joins population, boundary, and case count data to produce a
 * unified data table for the application.
 *
 * @param {string} region Region for which to compile data.
 * @return {!Promise<EpiViewTable>} Unified data table.
 */
export default async function compileData(region) {
  switch (region) {
    case "United States": {
      let table = new EpiViewTable_UnitedStates();
      table.addPopulation(rawPopulation_UnitedStates);
      table.addBounds(rawBounds_UnitedStates);
      await table.addCounts(rawCountsUrl_UnitedStates);
      return table;
    }
    case "Los Angeles": {
      let table = new EpiViewTable_LosAngeles();
      table.addPopulation(rawPopulation_LosAngeles);
      table.addBounds(rawBounds_LosAngeles);
      await table.addCounts();
      return table;
    }
    default:
      throw "unknown region";
  }
}

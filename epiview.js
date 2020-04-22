/*
EpiView
epiview.js

Copyright (c) 2020 Kevin Hsieh. All Rights Reserved.
*/

/**
 * Converts CSV rows into objects, indexed by FIPS then by date.
 *
 * @param {string} csv CSV body, starting with a header row.
 * @return {!Object<string, Object<string, Object<string, string>>>} Row
 *     objects, indexed by FIPS then by date.
 */
export function parseCounts(csv) {
  // Parse the lines and header of the CSV file.
  const lines = csv.split('\n');
  const header = lines[0].split(',');
  // Parse rows into objects and index by FIPS then date.
  let counts = {};
  for (const rowStr of lines.slice(1)) {
    // Convert the row from a string to an object using the entries of
    // header as keys.
    let rowObj = {};
    for (const [i, cell] of rowStr.split(',').entries()) {
      rowObj[header[i]] = cell;
    }
    // Add the converted row to counts.
    if (!(rowObj.fips in counts)) {
      counts[rowObj.fips] = {};
    }
    counts[rowObj.fips][rowObj.date] = rowObj;
  }
  return counts;
}

/**
 * Converts a GeoJSON FeatureCollection to sets of polygon coordinates, indexed
 * by GeoID. (A GeoID may have multiple polygons.)
 *
 * @param {!FeatureCollection} fc A GeoJSON FeatureCollection.
 * @return {!Object<string, Array<Array<LatLng>>>} Sets of polygon coordinates,
 *    indexed by GeoID.
 */
export function parseBounds(fc) {
  // Helper function: Converts a GeoJSON coordinate to a LatLng.
  function toLatLng(coord) {
    return {latitude: coord[1], longitude: coord[0]};
  }
  let bounds = {};
  for (const feat of fc.features) {
    // Create a new coordinate set (as an array) if one doesn't already exist.
    let coordset = bounds[feat.properties.GEOID] || [];
    // Store the county name and state abbreviation as a property of the array.
    coordset.name =
      `${feat.properties.NAME}, ${STATES[feat.properties.STATEFP]}`;
    // Convert and push the (set of) polygon coordinates.
    switch (feat.geometry.type) {
      case 'Polygon':
        const component = feat.geometry.coordinates;
        coordset.push(component[0].map(toLatLng));
        break;
      case 'MultiPolygon':
        for (const component of feat.geometry.coordinates) {
          coordset.push(component[0].map(toLatLng));
        }
        break;
    }
    // Update the bounds object in case this is a new coordset.
    bounds[feat.properties.GEOID] = coordset;
  }
  return bounds;
}

/**
 * Map from state FIPS codes to their two-letter abbreviations.
 */
const STATES = {
  '01': 'AL',
  '02': 'AK',
  '04': 'AZ',
  '05': 'AR',
  '06': 'CA',
  '08': 'CO',
  '09': 'CT',
  '10': 'DE',
  '12': 'FL',
  '13': 'GA',
  '15': 'HI',
  '16': 'ID',
  '17': 'IL',
  '18': 'IN',
  '19': 'IA',
  '20': 'KS',
  '21': 'KY',
  '22': 'LA',
  '23': 'ME',
  '24': 'MD',
  '25': 'MA',
  '26': 'MI',
  '27': 'MN',
  '28': 'MS',
  '29': 'MO',
  '30': 'MT',
  '31': 'NE',
  '32': 'NV',
  '33': 'NH',
  '34': 'NJ',
  '35': 'NM',
  '36': 'NY',
  '37': 'NC',
  '38': 'ND',
  '39': 'OH',
  '40': 'OK',
  '41': 'OR',
  '42': 'PA',
  '44': 'RI',
  '45': 'SC',
  '46': 'SD',
  '47': 'TN',
  '48': 'TX',
  '49': 'UT',
  '50': 'VT',
  '51': 'VA',
  '53': 'WA',
  '54': 'WV',
  '55': 'WI',
  '56': 'WY',
  '60': 'AS',
  '66': 'GU',
  '69': 'MP',
  '72': 'PR',
  '78': 'VI',
};

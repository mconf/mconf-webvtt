'use strict';

/**
 * See spec: https://www.w3.org/TR/webvtt1/#file-structure
 */

function ParserError (message, error) {
  this.message = message;
  this.error = error;
}

ParserError.prototype = Object.create(Error.prototype);

const TIMESTAMP_REGEXP = /([0-9]{1,2})?:?([0-9]{2}):([0-9]{2}\.[0-9]{3})/;
const CUE_META = 'MCONF_CUE_META';
const META = 'MCONF_META';

function parse (input) {

  if (typeof input !== 'string') {
    throw new ParserError('Input must be a string');
  }

  input = input.trim();
  input = input.replace(/\r\n/g, '\n');
  input = input.replace(/\r/g, '\n');

  const parts = input.split('\n\n');

  const header = parts.shift();

  if (!header.startsWith('WEBVTT')) {
    throw new ParserError('Must start with "WEBVTT"');
  }

  const headerParts = header.split('\n');

  const headerComments = headerParts[0].replace('WEBVTT', '');

  if (headerComments.length > 0
      && (headerComments[0] !== ' ' && headerComments[0] !== '\t')
  ) {
    throw new ParserError('Header comment must start with space or tab');
  }

  // nothing of interests, return early
  if (parts.length === 0 && headerParts.length === 1) {
    return { valid: true, cues: [] };
  }

  if (headerParts.length > 1 && headerParts[1] !== '') {
    throw new ParserError('Missing blank line after signature');
  }

  const cues = parseCues(parts);
  const meta = parseMeta(parts);

  const result = { valid: true, cues, meta };

  return result;
}

function tryMeta (part) {
  // split and remove empty lines
  const lines = part.split('\n').filter(Boolean);
  if (lines.length > 0 && lines[0].trim().startsWith('NOTE')) {
    let note = lines[0].split(META);
    if (note.length > 1) {
      note.shift();
      const meta = note.join(META);
      return JSON.parse(meta);
    }
  }
  return null;
}

function parseMeta (parts) {
  let result = null;
  parts.forEach(part => {
    const meta = tryMeta(part);
    if (meta) result = result ? Object.assign(result, meta) : meta;
  });
  return result;
}

function tryCueMeta (part) {
  // split and remove empty lines
  const lines = part.split('\n').filter(Boolean);
  if (lines.length > 0 && lines[0].trim().startsWith('NOTE')) {
    let note = lines[0].split(CUE_META);
    if (note.length > 1) {
      note.shift();
      const cueMeta = note.join(CUE_META);
      return JSON.parse(cueMeta);
    }
  }
  return null;
}

function parseCues (parts) {
  let result = [];
  let cueMeta = null;
  parts.forEach(part => {
    const meta = tryCueMeta(part);
    if (meta) {
      cueMeta = cueMeta ? Object.assign(cueMeta, meta) : meta;
    } else {
      const item = parseCue(part, result.length + 1);
      if (item) {
        result.push(Object.assign(item, { meta: cueMeta }));
        cueMeta = null;
      }
    }
  });
  return result;
}

/**
 * Parse a single cue block.
 *
 * @param {array} part Array of content for the possible cue
 *
 * @returns {object} cue Cue object with start, end, text, styles and meta.
 *
 */
function parseCue (part, index) {
  let identifier = '';
  let start = 0;
  let end = 0.01;
  let text = '';
  let styles = '';

  // split and remove empty lines
  const lines = part.split('\n').filter(Boolean);

  if (lines.length > 0 && lines[0].trim().startsWith('NOTE')) {
    return null;
  }

  if (lines.length === 1 && !lines[0].includes('-->')) {
    throw new ParserError(`Cue identifier cannot be standalone (cue #${index})`);
  }

  if (lines.length > 1 &&
      !(lines[0].includes('-->') || lines[1].includes('-->'))) {
    const msg = `Cue identifier needs to be followed by timestamp (cue #${index})`;
    throw new ParserError(msg);
  }

  if (lines.length > 1 && lines[1].includes('-->')) {
    identifier = lines.shift();
  } else {
    identifier = `${index}`;
  }

  const times = lines[0].split(' --> ');

  if (times.length !== 2 ||
      !validTimestamp(times[0]) ||
      !validTimestamp(times[1])) {
    throw new ParserError(`Invalid cue timestamp (cue #${index})`);
  }

  start = parseTimestamp(times[0]);
  end = parseTimestamp(times[1]);

  if (start > end) {
    throw new ParserError(`Start timestamp greater than end (cue #${index})`);
  }

  if (end <= start) {
    throw new ParserError(`End must be greater than start (cue #${index})`);
  }

  // TODO better style validation
  styles = times[1].replace(TIMESTAMP_REGEXP, '').trim();

  lines.shift();

  text = lines.join('\n');

  if (!text) {
    return false;
  }

  return { identifier, start, end, text, styles };
}

function validTimestamp (timestamp) {
  return TIMESTAMP_REGEXP.test(timestamp);
}

function parseTimestamp (timestamp) {
  const matches = timestamp.match(TIMESTAMP_REGEXP);

  let secs = parseFloat(matches[3]);
  secs += parseFloat(matches[2]) * 60; // mins
  secs += parseFloat(matches[1] || 0) * 60 * 60; // hours
  return secs;
}

module.exports = { ParserError, parse };

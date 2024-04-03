'use strict';

/**
 * See spec: https://www.w3.org/TR/webvtt1/#file-structure
 */

function CompilerError(message, error) {
  this.message = message;
  this.error = error;
}

CompilerError.prototype = Object.create(Error.prototype);

const CUE_META = 'MCONF_CUE_META';
const META = 'MCONF_META';

function compile(input, options) {
  if (!options) {
    options = {};
  }

  const { strict = true } = options;

  if (!input) {
    throw new CompilerError('Input must be non-null');
  }

  if (typeof input !== 'object') {
    throw new CompilerError('Input must be an object');
  }

  if (Array.isArray(input)) {
    throw new CompilerError('Input cannot be array');
  }

  if (!input.valid && strict) {
    throw new CompilerError('Input must be valid');
  }

  let output = 'WEBVTT\n';

  const { meta } = input;
  if (meta) {
    output += '\n';
    output += compileMeta(meta);
  }

  let lastTime = null;

  input.cues.forEach((cue, index) => {
    if (lastTime && lastTime > cue.start) {
      throw new CompilerError(`Cue number ${index} is not in chronological`
        + ' order');
    }

    lastTime = cue.start;

    output += '\n';
    output += compileCue(cue, strict);
    output += '\n';
  });

  return output;
}

function sanitizeOutput(output) {
  return output.replace('-->', '');
}

function compileCueMeta(cueMeta) {
  if (typeof cueMeta !== 'object') {
    throw new CompilerError('Cue meta malformed: not of type object');
  }

  const output = `NOTE ${CUE_META} ${JSON.stringify(cueMeta)}\n`;
  const sanitizedOutput = sanitizeOutput(output);

  return sanitizedOutput;
}

function compileMeta(meta) {
  if (typeof meta !== 'object') {
    throw new CompilerError('Meta malformed: not of type object');
  }

  const output = `NOTE ${META} ${JSON.stringify(meta)}\n`;
  const sanitizedOutput = sanitizeOutput(output);

  return sanitizedOutput;
}

/**
 * Compile a single cue block.
 *
 * @param {array} cue Array of content for the cue
 *
 * @returns {object} cue Cue object with start, end, text and styles.
 *
 */
function compileCue(cue, strict) {
  // TODO: check for malformed JSON
  if (typeof cue !== 'object') {
    throw new CompilerError('Cue malformed: not of type object');
  }

  if (typeof cue.identifier !== 'string' &&
    typeof cue.identifier !== 'number' &&
    cue.identifier !== null) {
    throw new CompilerError(`Cue malformed: identifier value is not a string.
    ${JSON.stringify(cue)}`);
  }

  if (isNaN(cue.start)) {
    throw new CompilerError(`Cue malformed: null start value.
    ${JSON.stringify(cue)}`);
  }

  if (isNaN(cue.end)) {
    throw new CompilerError(`Cue malformed: null end value.
    ${JSON.stringify(cue)}`);
  }

  if (strict && cue.start >= cue.end) {
    throw new CompilerError(`Cue malformed: start timestamp greater than end
    ${JSON.stringify(cue)}`);
  }

  if (typeof cue.text !== 'string') {
    throw new CompilerError(`Cue malformed: null text value.
    ${JSON.stringify(cue)}`);
  }

  if (typeof cue.styles !== 'string') {
    throw new CompilerError(`Cue malformed: null styles value.
    ${JSON.stringify(cue)}`);
  }

  let output = '';

  if (cue.meta) {
    output += `${compileCueMeta(cue.meta)}\n`;
  }

  if (cue.identifier.length > 0) {
    output += `${cue.identifier}\n`;
  }

  const startTimestamp = convertTimestamp(cue.start);
  const endTimestamp = convertTimestamp(cue.end);

  output += `${startTimestamp} --> ${endTimestamp}`;
  output += cue.styles ? ` ${cue.styles}` : '';
  output += `\n${cue.text}`;

  return output;
}

function convertTimestamp(time) {
  const hours = pad(calculateHours(time), 2);
  const minutes = pad(calculateMinutes(time), 2);
  const seconds = pad(calculateSeconds(time), 2);
  const milliseconds = pad(calculateMs(time), 3);
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function pad(num, zeroes) {
  let output = `${num}`;

  while (output.length < zeroes) {
    output = `0${output}`;
  }

  return output;
}

function calculateHours(time) {
  return Math.floor(time / 60 / 60);
}

function calculateMinutes(time) {
  return (Math.floor(time / 60) % 60);
}

function calculateSeconds(time) {
  return Math.floor((time) % 60);
}

function calculateMs(time) {
  return Math.floor((time % 1).toFixed(4) * 1000);
}

module.exports = { CompilerError, compile };

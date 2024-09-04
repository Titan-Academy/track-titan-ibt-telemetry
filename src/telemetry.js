import fs from 'fs';
import yaml from 'js-yaml';

import TelemetrySample from './telemetry-sample';
import telemetryFileLoader from './utils/telemetry-file-loader';

const variableHeaders = new WeakMap();
const fileDescriptor = new WeakMap();

function handleMultilineStrings(sessionInfo) {
  // Correctly handle multiline values with block scalar and proper indentation
  sessionInfo = sessionInfo.replace(
    /:\s*\|\n\s*([^\n]+(\n[^\n]+)+)/g,
    function (match, value) {
      // Format only multiline values with block scalars
      return `: |\n  ${value.replace(/\n/g, '\n  ')}`;
    }
  );

  return sessionInfo;
}

/**
 * iRacing Telemetry
 */
export default class Telemetry {
  /**
   * Telemetry constructor.
   */
  constructor(telemetryHeader, diskSubHeader, sessionInfo, varHeaders, fd) {
    this.headers = telemetryHeader;
    this.diskHeaders = diskSubHeader;

    const sanitizedSessionInfo = sessionInfo.replace(
      // eslint-disable-next-line no-control-regex
      /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]/g,
      ''
    );

    // Step 2: Fix indentation for multiline strings
    const handledMultilineStringsSessionInfo =
      handleMultilineStrings(sanitizedSessionInfo);

    this.sessionInfo = yaml.load(handledMultilineStringsSessionInfo);

    fileDescriptor.set(this, fd);
    variableHeaders.set(this, varHeaders);
  }

  /**
   * Instantiate a Telemetry instance from the contents of an ibt file
   *
   * @param file path to *.ibt file
   * @return Telemetry instance of telemetry
   */
  static fromFile(file) {
    return telemetryFileLoader(file);
  }

  /**
   * Telemetry variable headers.
   */
  get varHeaders() {
    return variableHeaders.get(this);
  }

  /**
   * Telemetry samples generator.
   */
  *samples() {
    let hasSample = true;
    let count = 0;

    const fd = fileDescriptor.get(this);
    const length = this.headers.bufLen;
    const buffer = Buffer.alloc(length);

    while (hasSample) {
      const start = this.headers.bufOffset + count++ * length;
      const bytesRead = fs.readSync(fd, buffer, 0, length, start);

      if (bytesRead !== length) {
        hasSample = false;
      } else {
        yield new TelemetrySample(buffer, this.varHeaders);
      }
    }
  }
}

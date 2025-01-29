import fs from "fs";
import yaml from "js-yaml";

import TelemetrySample from "./telemetry-sample";
import telemetryFileLoader from "./utils/telemetry-file-loader";

const variableHeaders = new WeakMap();
const fileDescriptor = new WeakMap();

/**
 * Handles and fixes common YAML formatting issues before parsing.
 */
function preprocessYAML(content) {
  let modifiedContent = content;

  // Fix missing colons in key-value pairs
  modifiedContent = modifiedContent.replace(
    /(\n\s*[A-Za-z_]+\b)(\s*)(\n|$)/g,
    "$1: null$3"
  );

  // Handle malformed list items and remove trailing commas
  modifiedContent = modifiedContent.replace(/,\s*(\n\s*-)/g, "\n$1");
  modifiedContent = modifiedContent.replace(/,\s*(\n\s*[A-Z])/g, "\n$1");

  // Fix broken lines with improper indentation
  modifiedContent = modifiedContent.replace(
    /(\S+)\s*\n\s*([A-Z])/g,
    "$1\n  $2"
  );

  // Remove non-printable control characters
  modifiedContent = modifiedContent.replace(/[\x00-\x1F\x7F-\x9F]/g, "");

  // Fix cases where values are missing after a key (assume null)
  modifiedContent = modifiedContent.replace(
    /:\s*\n\s*([A-Z][a-z]+:)/g,
    ": null\n$1"
  );
  modifiedContent = modifiedContent.replace(/(\w+):\s*,\s*/g, '$1: "unknown",');

  // Ensure values with special characters (e.g., commas) are quoted
  modifiedContent = modifiedContent.replace(
    /:\s*([^"\n][^,\n]*,[^"\n]*)\n/g,
    ': "$1"\n'
  );

  return modifiedContent;
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

    // Remove control characters before any further processing
    const sanitizedSessionInfo = sessionInfo.replace(
      /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]/g,
      ""
    );

    const preprocessedSessionInfo = preprocessYAML(sanitizedSessionInfo);

    try {
      this.sessionInfo = yaml.load(preprocessedSessionInfo);
    } catch (e) {
      const errorMessage = `YAML Parsing Error at line ${
        e.mark?.line || "unknown"
      }: ${e.message}`;

      throw new Error(errorMessage);
    }

    fileDescriptor.set(this, fd);
    variableHeaders.set(this, varHeaders);
  }

  /**
   * Instantiate a Telemetry instance from the contents of an ibt file
   *
   * @param {string} file - Path to *.ibt file
   * @return {Promise<Telemetry>} Instance of telemetry
   */
  static fromFile(file) {
    return telemetryFileLoader(file);
  }

  /**
   * Get variable headers.
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

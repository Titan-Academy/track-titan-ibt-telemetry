import fs from 'fs'
import yaml from 'js-yaml'

import TelemetrySample from './telemetry-sample'
import telemetryFileLoader from './utils/telemetry-file-loader'

const variableHeaders = new WeakMap()
const fileDescriptor = new WeakMap()

/**
 * Handles and fixes common YAML formatting issues before parsing.
 * ANY CHANGES TO THIS FILE SHOULD ALSO BE DONE TO the preprocessYAML function in track-titan-node-irsdk-2023
 */
export function preprocessYAML(sessionInfoStr) {
  // Handle empty/whitespace with comma (i.e Abbrevname: , )
  const cleanedSessionInfoStr = sessionInfoStr.replace(
    /^(\s*\w+:\s*),\s*(.*)$/gm,
    "$1'$2'"
  );

  // Handle orphaned negative sign (i.e UserName: - -11)
  const noOrphanedNegative = cleanedSessionInfoStr.replace(
    /^(\s*\w+:\s*)-\s*(-?\d+)$/gm,
    "$1$2"
  );

  var fixedYamlStr = noOrphanedNegative.replace(
    /TeamName: ([^\n]+)/g,
    function (match, p1) {
      if (
        (p1[0] === '"' && p1[p1.length - 1] === '"') ||
        (p1[0] === "'" && p1[p1.length - 1] === "'")
      ) {
        return match; // skip if quoted already
      } else {
        // 2nd replace is unnecessary atm but its here just in case
        return "TeamName: '" + p1.replace(/'/g, "''") + "'";
      }
    }
  );

  const sanitizedSessionInfo = fixedYamlStr.replace(
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F]/g,
    ""
  );

  // Remove Drivetrain subsection within CarSetup to avoid duplicate 'At' key issues
  const noDrivetrainSessionInfo = sanitizedSessionInfo.replace(
    /^( Drivetrain:\r?\n(?:  .*\r?\n)*)/m,
    ""
  );
    
  return noDrivetrainSessionInfo
    .split('\n')
    .map((line, index, lines) => {
      const trimmedLine = line.trim()

      // Replace invalid key-value pairs with just a comma as a value
      if (trimmedLine.match(/^([A-Za-z0-9_]+):\s*,\s*$/)) {
        return line.replace(/:\s*,\s*$/, ': unknown')
      }

      // Remove lines that start with an invalid character (e.g., ", E")
      if (trimmedLine.startsWith(',') || trimmedLine.match(/^\s*,\s*\S/)) {
        console.warn(`🛠 Removing invalid line: ${line}`)
        return '' // Remove this line
      }

      // Detect missing colons in key-value pairs and fix them
      if (
        trimmedLine.match(/^\s*[A-Za-z0-9_]+\s*$/) &&
        lines[index + 1] &&
        lines[index + 1].trim().match(/^[A-Za-z0-9_]+:/)
      ) {
        const indentation = line.match(/^(\s*)/)[0]
        console.warn(`🛠 Fixing missing colon in: ${line}`)
        return `${indentation}${trimmedLine}: unknown`
      }

      // Wrap values containing @ in quotes to prevent YAML parsing errors (only if not already quoted)
      if (trimmedLine.match(/^([A-Za-z0-9_]+):\s*.*@.*$/) && !trimmedLine.match(/^([A-Za-z0-9_]+):\s*".*"$/)) {
        return line.replace(/^(\s*)([A-Za-z0-9_]+):\s*(.*)$/, '$1$2: "$3"')
      }

      return line
    })
    .filter(Boolean)
    .join('\n')
}

/**
 * iRacing Telemetry
 */
export default class Telemetry {
  /**
   * Telemetry constructor.
   */
  constructor (telemetryHeader, diskSubHeader, sessionInfo, varHeaders, fd) {
    this.headers = telemetryHeader
    this.diskHeaders = diskSubHeader

    // **Safe way** to remove control characters
    const sanitizedSessionInfo = sessionInfo
      .split('')
      .filter((char) => char.charCodeAt(0) > 31 || char === '\n')
      .join('')

    const preprocessedSessionInfo = preprocessYAML(sanitizedSessionInfo)

    try {
      this.sessionInfo = yaml.load(preprocessedSessionInfo)
    } catch (e) {
      const errorMessage = `YAML Parsing Error at line ${
        e.mark && e.mark.line ? e.mark.line : 'unknown'
      }: ${e.message}`

      throw new Error(errorMessage)
    }

    fileDescriptor.set(this, fd)
    variableHeaders.set(this, varHeaders)
  }

  /**
   * Instantiate a Telemetry instance from the contents of an ibt file
   *
   * @param {string} file - Path to *.ibt file
   * @return {Promise<Telemetry>} Instance of telemetry
   */
  static fromFile (file) {
    return telemetryFileLoader(file)
  }

  /**
   * Get variable headers.
   */
  get varHeaders () {
    return variableHeaders.get(this)
  }

  /**
   * Telemetry samples generator.
   */
  * samples () {
    let hasSample = true
    let count = 0

    const fd = fileDescriptor.get(this)
    const length = this.headers.bufLen
    const buffer = Buffer.alloc(length)

    while (hasSample) {
      const start = this.headers.bufOffset + count++ * length
      const bytesRead = fs.readSync(fd, buffer, 0, length, start)

      if (bytesRead !== length) {
        hasSample = false
      } else {
        yield new TelemetrySample(buffer, this.varHeaders)
      }
    }
  }
}

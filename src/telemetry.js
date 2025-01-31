import fs from 'fs'
import yaml from 'js-yaml'

import TelemetrySample from './telemetry-sample'
import telemetryFileLoader from './utils/telemetry-file-loader'

const variableHeaders = new WeakMap()
const fileDescriptor = new WeakMap()

/**
 * Handles and fixes common YAML formatting issues before parsing.
 */
export function preprocessYAML (content) {
  return content
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

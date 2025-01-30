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
  let modifiedContent = content

  // Fixing colons & missing values
  modifiedContent = modifiedContent.replace(
    /(\n\s*[A-Za-z_]+)(\s+)([A-Za-z0-9_]+)/g,
    '$1: $3'
  )

  // Ensuring list items are well formatted
  modifiedContent = modifiedContent.replace(
    /-\s*([A-Za-z0-9_]+):\s*([^\n]+)/g,
    '- $1:\n    $2'
  )

  // Checking for indentation issues
  modifiedContent = modifiedContent.replace(
    /([a-zA-Z0-9_]+):\s*([^\n]+)\s+([a-zA-Z0-9_]+):/g,
    '$1: $2\n$3:'
  )

  // **Safe way** to remove control characters
  modifiedContent = modifiedContent
    .split('')
    .filter((char) => char.charCodeAt(0) > 31 || char === '\n')
    .join('')

  // Removing lines that cause YAML errors and replacing them with dummy key-value pairs
  modifiedContent = modifiedContent
    .split('\n')
    .map((line) => {
      if (
        line.includes(',') ||
        line.match(/\b[A-Za-z0-9_]+\s+[A-Za-z0-9_]+:/)
      ) {
        return 'unknown: null'
      }
      return line
    })
    .join('\n')

  return modifiedContent
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
        e.mark?.line ?? 'unknown'
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

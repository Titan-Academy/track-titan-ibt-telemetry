import fs from 'fs'
import yaml from 'js-yaml'

import TelemetrySample from './telemetry-sample'
import telemetryFileLoader from './utils/telemetry-file-loader'

const variableHeaders = new WeakMap()
const fileDescriptor = new WeakMap()

/**
 * iRacing Telemetry
 */
export default class Telemetry {
  /**
   * Telemetry constructor.
   */
  constructor (telemetryHeader, diskSubHeader, sessionInfo, varHeaders, fd, preprocessYAML) {
    this.headers = telemetryHeader
    this.diskHeaders = diskSubHeader
    this.preprocessYAML = preprocessYAML

    // **Safe way** to remove control characters
    const sanitizedSessionInfo = sessionInfo
      .split('')
      .filter((char) => char.charCodeAt(0) > 31 || char === '\n')
      .join('')

    const preprocessedSessionInfo = this.preprocessYAML(sanitizedSessionInfo)

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
   * @param {function} preprocessYAML - Function which preprocesses the YAML
   * @return {Promise<Telemetry>} Instance of telemetry
   */
  static fromFile (file, preprocessYAML) {
    return telemetryFileLoader(file, preprocessYAML)
  }

  /**
   * Get variable headers.
   */
  get varHeaders () {
    return variableHeaders.get(this)
  }

  /**
   * Get all telemetry samples.
   */
  samples () {
    const fd = fileDescriptor.get(this)
    const sampleLength = this.headers.bufLen

    // Get file stats to determine total file size
    const stats = fs.fstatSync(fd)
    const fileSize = stats.size

    // Calculate total bytes available for samples
    const totalSampleBytes = fileSize - this.headers.bufOffset
    const sampleCount = Math.floor(totalSampleBytes / sampleLength)

    if (sampleCount <= 0) {
      return []
    }

    // Read entire buffer from start of samples
    const entireBuffer = Buffer.alloc(totalSampleBytes)
    const bytesRead = fs.readSync(fd, entireBuffer, 0, totalSampleBytes, this.headers.bufOffset)

    if (bytesRead !== totalSampleBytes) {
      throw new Error(`Failed to read expected bytes. Expected: ${totalSampleBytes}, Read: ${bytesRead}`)
    }

    // Split buffer into individual samples
    const samples = []
    for (let i = 0; i < sampleCount; i++) {
      const start = i * sampleLength
      const end = start + sampleLength
      const sampleBuffer = entireBuffer.slice(start, end)
      samples.push(new TelemetrySample(sampleBuffer, this.varHeaders))
    }

    return samples
  }
}

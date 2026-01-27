import Irsdk from './irsdk-constants'

const variableHeaders = new WeakMap()
const parameterMaps = new WeakMap()
const dataViews = new WeakMap()

export default class TelemetrySample {
  constructor (buff, varHeaders) {
    this._buff = buff
    variableHeaders.set(this, varHeaders)
    
    // Create case-insensitive parameter lookup map for O(1) access
    const paramMap = new Map(varHeaders.map(h => [h.name.toLowerCase(), h]))
    parameterMaps.set(this, paramMap)
    
    // Create DataView for efficient buffer reading
    const view = new DataView(buff.buffer, buff.byteOffset, buff.byteLength)
    dataViews.set(this, view)
  }

  getParam (sampleVariableName) {
    const paramMap = parameterMaps.get(this)
    const header = paramMap.get(sampleVariableName.toLowerCase())

    if (!header) {
      return null
    }

    const variable = Irsdk.varType[header.type]
    const view = dataViews.get(this)
    
    // Use DataView for efficient reading without creating buffer slices
    let value
    switch (variable.jsBufferMethod) {
      case 'readFloatLE':
        value = view.getFloat32(header.offset, true)
        break
      case 'readDoubleLE':
        value = view.getFloat64(header.offset, true)
        break
      case 'readInt32LE':
        value = view.getInt32(header.offset, true)
        break
      case 'readUInt32LE':
        value = view.getUint32(header.offset, true)
        break
      case 'readInt16LE':
        value = view.getInt16(header.offset, true)
        break
      case 'readUInt16LE':
        value = view.getUint16(header.offset, true)
        break
      case 'readInt8':
        value = view.getInt8(header.offset)
        break
      case 'readUInt8':
        value = view.getUint8(header.offset)
        break
      default:
        // Fallback to original method if unknown type
        const valueBuffer = this._buff.slice(header.offset, header.offset + variable.size)
        value = valueBuffer[variable.jsBufferMethod]()
    }

    return {
      name: header.name,
      description: header.description,
      value: value,
      unit: header.unit
    }
  }

  toJSON () {
    const headers = variableHeaders.get(this)
    const result = {}
    
    for (const header of headers) {
      const param = this.getParam(header.name)
      if (param) {
        result[header.name] = {
          value: param.value,
          unit: param.unit
        }
      }
    }
    
    return result
  }
}

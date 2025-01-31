import yaml from 'js-yaml'
import Telemetry, { preprocessYAML } from '../telemetry'

const USE_IBT_FILE = false

const brokenYAML = `
sessionInfo:
  DriverInfo:
    Drivers:
      - CarIdx: 14
        UserName:
        AbbrevName: ,
        Initials:
        UserID: 991832

      - CarIdx: 27
        UserName: Erik Belejkanid
        AbbrevName: Belejkanid
        , Initials: EB
        UserID: 650144

      - CarIdx: 41
        UserName: Max Verstappen
        AbbrevName
        Initials: MV
        UserID: 112233
`

const filePath = './formulavee_tsukuba 1kouter 2025-01-30 17-09-29.ibt';

(async () => {
  try {
    if (USE_IBT_FILE) {
      console.log('📂 Processing telemetry file...')
      const telemetryData = await Telemetry.fromFile(filePath)
      console.log(
        '✅ Telemetry loaded successfully:',
        telemetryData.sessionInfo
      )
    } else {
      console.log('🛠 Applying Preprocessing...')
      const cleanedYAML = preprocessYAML(brokenYAML)

      console.log('📜 Parsing YAML...')
      const parsedData = yaml.load(cleanedYAML)

      console.log('✅ YAML Parsed Successfully!')
      console.log(JSON.stringify(parsedData, null, 2))
    }
  } catch (error) {
    console.error('❌ Error processing:', error.message)
  }
})()

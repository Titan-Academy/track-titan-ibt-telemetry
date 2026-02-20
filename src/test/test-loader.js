import Telemetry from '../telemetry'

const filePath = './src/test/formulavee_tsukuba 1kouter 2025-01-30 17-09-29.ibt';

(async () => {
  try {
    console.log('📂 Processing telemetry file...')
    const telemetryData = await Telemetry.fromFile(filePath ,(text) => text)
    console.log(
      '✅ Telemetry loaded successfully:',
      telemetryData.sessionInfo
    )

    console.log('Samples length', telemetryData.getSamplesLength())
    console.log('Sample at 50', telemetryData.sampleAt(50))
    console.log('Sample at 50 speed', telemetryData.sampleAt(500).getParam('Speed').value)
  } catch (error) {
    console.error('❌ Error processing:', error.message)
  }
})()

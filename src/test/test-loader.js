import yaml from "js-yaml";
import { preprocessYAML } from "../telemetry";

const brokenYAML = `
SessionInfo:
  Drivers:
    - CarIdx: 6
      UserName: Erik Belejkanid
      AbbrevName Belejkanid  #Missing colon
      Initials: EB
      UserID: 650144

    - CarIdx: 14
      UserName:                 
      AbbrevName: ,  #Unexpected comma (invalid YAML)
      Initials:   
      UserID: 991832

    - CarIdx: 27
      UserName: Erik Belejkanid
      AbbrevName: Belejkanid
      , Initials: EB  #Starts with a comma (invalid YAML)
      UserID: 650144

  Teams:
    - TeamID: 100
      TeamName: Racing Team
      DriverIDs: [650144  991832]  #Missing comma between values

    - TeamID: 101
      TeamName: Speed Masters
      DriverIDs: [991832,  ]  #Trailing comma in a list

  Events:
    - EventID: 202501
      TrackName: Tsukuba Circuit
      TrackLength:  #Missing value (should be null or a number)
      
    - EventID: 202502
      TrackName:  #Missing value (should be a string)
      TrackLength: 2.5
      
  Timing:
    - LapIdx: 1
      LapTime: "1:35.4"  #Should be quoted (YAML interprets "1:35.4" as a mapping)
      SectorTimes: 
        - 30.2
        - 32.5
        - ,  #Unexpected comma in list

`;

try {
  console.log("Applying Preprocessing...");
  let cleanedYAML = preprocessYAML(brokenYAML);

  console.log("Parsing YAML...");
  let parsedData;

  let attempt = 0;
  const maxAttempts = 5; // Avoid infinite loops

  while (attempt < maxAttempts) {
    try {
      parsedData = yaml.load(cleanedYAML);
      console.log("✅ YAML Parsed Successfully!");
      console.log(parsedData);
      break; // Exit loop if parsing succeeds
    } catch (e) {
      attempt++;
      const lineNumber = e.mark && e.mark.line ? e.mark.line : "unknown";
      console.warn(`⚠️ YAML Parsing Error at line ${lineNumber}: ${e.message}`);

      let yamlLines = cleanedYAML.split("\n");

      if (lineNumber !== "unknown" && yamlLines[lineNumber]) {
        let faultyLine = yamlLines[lineNumber];
        console.warn(`🛠 Replacing faulty line: ${faultyLine}`);

        // Preserve indentation level
        const indentation = faultyLine.match(/^(\s*)/)[0];

        if (faultyLine.includes(":") && !faultyLine.includes(",")) {
          // If the error is a misplaced mapping key (missing colon)
          faultyLine = faultyLine.replace(/(\S+)\s+(\S+)/, "$1: $2");
        } else if (faultyLine.trim().startsWith("-")) {
          // If the error is a list item, replace with a valid list item
          faultyLine = `${indentation}- null`;
        } else if (faultyLine.includes(",")) {
          // If the error is a misplaced comma, remove it
          faultyLine = faultyLine.replace(",", "");
        } else {
          // Default: Replace with a dummy entry (without breaking lists)
          faultyLine = `${indentation}unknown_entry_${lineNumber}: null`;
        }

        yamlLines[lineNumber] = faultyLine;
      } else {
        console.warn("❌ Could not determine faulty line, stopping...");
        throw e; // If we can't fix it, stop processing
      }

      cleanedYAML = yamlLines.join("\n"); // Reassemble YAML after replacement
    }
  }
} catch (finalError) {
  console.error("❌ Fatal YAML Error:", finalError.message);
}

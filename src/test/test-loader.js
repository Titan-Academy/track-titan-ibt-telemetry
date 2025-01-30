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
  const cleanedYAML = preprocessYAML(brokenYAML);

  console.log("Parsing YAML...");
  const parsedData = yaml.load(cleanedYAML);

  console.log("YAML Parsed Successfully!");
  console.log(parsedData);
} catch (e) {
  console.error(
    "YAML Parsing Error at line",
    e.mark && e.mark.line ? e.mark.line : "unknown",
    ":",
    e.message
  );
}

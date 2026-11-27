// The MIDI extractor's state.
import { extractFile } from "../extractor.js";
import { useConverter } from "./converter";

export const extractor = useConverter(extractFile);
extractor.asking.value = true;

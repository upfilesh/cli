const fs = require("fs");
const path = require("path");

const pkg = require("../package.json");
const outFile = path.join(__dirname, "..", "src", "version.ts");

fs.writeFileSync(outFile, `export const VERSION = ${JSON.stringify(pkg.version)};\n`);

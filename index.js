const epub2latex = require("./src/epub2latex")
const srcpath = process.argv.slice(2)
const outpath = require("path").join(__dirname, "out")
require("fs").mkdirSync(outpath, { recursive: true })
epub2latex(process.argv.slice(2)[0], outpath)
  .then(() => console.log("done"))
  .catch((ex) => {
    console.error(ex)
  })


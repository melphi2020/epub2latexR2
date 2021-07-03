// 每隔1分钟检查一下有没有新书到站，如果有，自动将epub转换成pdf，然后导入remarkable2 cloud.

const { rejects } = require("assert")

async function main() {
  while (true) {
    files = await fetchFiles()
    for (let file of files) {
      file.pdfname = file.name.replace("epub", "pdf")
      try {
        if (await !FileProcessDone(file)) {
          if (await DownloadFile(file)) {
            if (await ConvertFile(file)) {
              if (await ImportFile(file)) {
                if (await MarkSucc(file)) {
                  console.log(`${file.name} finished succ!`)
                } else {
                  console.log(`${file.name} marksucc fail!`)
                }
              } else {
                console.log(`${file.name} import fail!`)
              }
            } else {
              console.log(`${file.name} convert fail!`)
            }
          } else {
            console.log(`${file.name} download fail!`)
          }
        }
      } catch (ex) {
        console.log("meet error when running:", ex)
      }
    }
    console.log("sleep 1 minute...")
    await sleep(60 * 1000)
  }
}

async function MarkSucc(file) {
  console.log(`mark succ of ${file.name} ...`)
  require("fs").renameSync(
    `/home/ubuntu/Downloads/1550788996_wesleyeasd/${file.pdfname}`,
    `/home/ubuntu/BaiduPCS-Go/pdfs/${file.pdfname}`
  )
  return true
}

async function ImportFile(file) {
  console.log(`import file of ${file.name} ...`)
  return new Promise((resolve) => {
    var child = require("child_process").execFile(
      "/home/ubuntu/go/bin/rmapi",
      ["put", `/home/ubuntu/Downloads/1550788996_wesleyeasd/${file.pdfname}`],
      function (err, stdout, stderr) {
        if (err) {
          console.log(err, stderr, stdout)
          resolve(false)
        } else {
          resolve(true)
        }
      }
    )
  })
}

async function ConvertFile(file) {
  console.log(`convert file of ${file.name} ...`)
  return new Promise((resolve) => {
    var child = require("child_process").execFile(
      "node",
      [
        "/home/ubuntu/epub2latexR2/index.js",
        `/home/ubuntu/Downloads/1550788996_wesleyeasd/${file.name}`,
      ],
      function (err, stdout, stderr) {
        if (err) {
          console.log(err, stderr, stdout)
          resolve(false)
        } else {
          resolve(true)
        }
      }
    )
  })
}

async function DownloadFile(file) {
  console.log(`download file of ${file.name} ...`)
  return new Promise((resolve) => {
    var child = require("child_process").execFile(
      "/home/ubuntu/BaiduPCS-Go/BaiduPCS-Go",
      ["d", `/三秋电子书/${file.name}`],
      function (err, stdout, stderr) {
        if (err) {
          console.log(err, stderr, stdout)
          resolve(false)
        } else {
          resolve(true)
        }
      }
    )
  })
}

async function FileProcessDone(file) {
  console.log(`check file done of ${file.name} ...`)
  return require("fs").existsSync(
    `/home/ubuntu/BaiduPCS-Go/pdfs/${file.pdfname}`
  )
}

async function fetchFiles() {
  return new Promise((resolve) => {
    var child = require("child_process").execFile(
      "/home/ubuntu/BaiduPCS-Go/BaiduPCS-Go",
      ["ls", "--time", "--desc", "/三秋电子书"],
      function (err, stdout, stderr) {
        resolve(JSON.parse(stdout))
      }
    )
  })
}

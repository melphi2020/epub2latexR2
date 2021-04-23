const AdmZip = require("adm-zip")
const xmlParser = require("xml2json")
const { JSDOM, VirtualConsole } = require("jsdom")
async function unzip(path, out) {
  const zip = new AdmZip(path)
  zip.extractAllTo(out, true)
}

const epubroot = require("path").join(__dirname, "..", "tmp")

function findFootnoteContent(node) {
  const aNode = getParentNode(node, "A")
  const target = aNode.getAttribute("href").split("#").splice(-1)[0]
  const txt = node.textContent.trim()
  try {
    var targetNode = node.ownerDocument.querySelector("#" + target)
    if (targetNode) {
      if (
        targetNode.textContent.indexOf(txt) < 0 ||
        targetNode.textContent.length === txt.length
      ) {
        targetNode = targetNode.parentNode
      }
      var targetTxt = targetNode.textContent.trim()
      if (targetTxt.startsWith(txt)) {
        targetNode.innerHTML = ""
        targetTxt = targetTxt.substr(txt.length).trim()
      }
      return targetTxt
    }
  } catch (ex) {}
}

function getParentNode(node, name) {
  if (node.parentNode != null && node.parentNode.nodeName === name)
    return node.parentNode
  if (
    node.parentNode != null &&
    node.parentNode.parentNode != null &&
    node.parentNode.parentNode.nodeName === name
  )
    return node.parentNode.parentNode
  return false
}

function guessImage(ctx, node) {
  const path =
    node.getAttribute("src") ||
    node.getAttribute("href") ||
    node.getAttribute("xlink:href")
  return {
    type: "image",
    path: require("path").resolve(require("path").dirname(ctx.path), path),
  }
}

function guessText(ctx, node) {
  var txt = node.textContent.trim()
  if (txt === "") return

  if (node.parentNode.nodeName === "H1")
    return {
      type: "chapter",
      content: txt,
    }
  if (node.parentNode.nodeName === "H2")
    return {
      type: "section",
      content: txt,
    }
  if (node.parentNode.nodeName === "H3")
    return {
      type: "subsection",
      content: txt,
    }
  const ATag = getParentNode(node, "A")
  if (ATag) {
    txt = findFootnoteContent(node)
    if (txt) {
      return {
        type: "footnote",
        txt,
      }
    } else {
      //only support inside footnote as link
      console.error(
        "************************** skip link",
        ATag.textContent,
        ctx.path
      )
      return
    }
  }

  let style = {}
  if (node.parentNode.nodeName !== "P") {
    style = getTextStyle(ctx, node.parentNode)
  }

  return {
    type: "normal",
    content: txt,
    style,
  }
}

function getTextStyle(ctx, node) {
  var style = {}
  const styles = ctx.dom.window.getComputedStyle(node)
  if (styles.getPropertyValue("font-family").indexOf("STKaiti") >= 0)
    style.kaiti = 1
  if (styles.getPropertyValue("text-align").indexOf("right") >= 0)
    style.right = 1
  if (styles.getPropertyValue("text-align").indexOf("center") >= 0)
    style.center = 1
  if (styles.getPropertyValue("font-weight").indexOf("bold") >= 0)
    style.bold = 1
  if (parseFloat(styles.getPropertyValue("font-size")) < 1) style.small = 1
  return style
}

function formatDOM(ctx, node, result = []) {
  if (node.nodeName === "#text") {
    const item = guessText(ctx, node)
    if (item) {
      result.push(item)
    }
  } else if (node.nodeName === "image" || node.nodeName === "IMG") {
    const item = guessImage(ctx, node)
    if (item) {
      result.push(item)
    }
  }

  var pStyle = false
  if (
    node.nodeName === "P" &&
    result.length > 0 &&
    result.slice(-1)[0].type !== "paragraph-end"
  ) {
    pStyle = getTextStyle(ctx, node)
    result.push({
      type: "paragraph-start",
      style: pStyle,
    })
  }
  for (let child of node.childNodes) {
    formatDOM(ctx, child, result)
  }
  if (pStyle) {
    result.push({
      type: "paragraph-end",
      style: pStyle,
    })
  }
  return result
}

function trimBlocks(blocks) {
  while (blocks.length > 1) {
    if (
      blocks[0].type === "paragraph-start" &&
      blocks[1].type === "paragraph-end"
    )
      blocks.splice(0, 2)
    else break
  }
  while (blocks.length > 1) {
    if (
      blocks[blocks.length - 2].type === "paragraph-start" &&
      blocks[blocks.length - 1].type === "paragraph-end"
    )
      blocks.splice(-2, 2)
    else break
  }
  return blocks
}

async function formatPage(page) {
  const pagePath = require("path").resolve(
    require("path").join(epubroot, page.href)
  )
  return new Promise(async (resolve) => {
    const dom = await JSDOM.fromFile(pagePath, {
      resources: "usable",
    })
    dom.window.addEventListener("load", () => {
      const blocks = formatDOM(
        {
          path: pagePath,
          dom,
        },
        dom.window.document.body
      )
      resolve(trimBlocks(blocks))
    })
  })
}

async function pages2Latex(book) {
  const TextWidth = 5.5
  const TextHeight = 7.5
  var latex = `
\\documentclass[UTF8,zihao=-4,oneside,scheme=chinese,openany]{ctexbook}
\\setCJKmainfont[Path=/Users/wesleywang/Library/Fonts/,BoldFont=方正小标宋_GBK]{方正书宋_GBK.ttf}
\\usepackage[T1]{fontenc}
\\usepackage{geometry}
\\usepackage{graphicx}
\\usepackage{pdfpages}
\\geometry{paperwidth=6.1823in, paperheight=8.2536in, textwidth=${TextWidth}in, textheight=${TextHeight}in, top=0.4in}
\\pagestyle{empty}
\\usepackage{setspace}
\\usepackage{tikz}
\\usepackage[hidelinks]{hyperref}
\\setlength{\\parskip}{0.5em}
\\usepackage{eso-pic}
\\usepackage{pdfpages}
\\newcommand\\BackgroundPic{%
\\put(0,0){%
\\parbox[b][\\paperheight]{\\paperwidth}{%
\\vfill
\\centering
\\includegraphics[width=\\paperwidth,height=\\paperheight]{./cover}%
\\vfill
}}}
\\renewcommand{\\baselinestretch}{1.5}

\\newcommand{\\sectionbreak}{\\clearpage}
\\usepackage{titlesec}
\\usepackage{titletoc}
\\titlecontents{section}
              [0.5cm]
              {\\bf \\large}%
              {\\contentslabel{2.5em}}%
              {}%
              {\\titlerule*[0.5pc]{$\\cdot$}\\contentspage\\hspace*{0.5cm}}%
\\makeatletter
\\def\\@textbottom{\\vskip \\z@ \\@plus 1pt}
\\let\\@texttop\\relax
\\makeatother              
\\begin{document}
\\pagenumbering{gobble}

${book.pages.map((page) => page2latex(page)).join("\n\n")}
\\end{document} 
`
  require("fs").writeFileSync(
    require("path").join(__dirname, "..", "out", "book.tex"),
    latex
  )
}

function formatText(item, astyle) {
  const style = astyle || { ...(item.style || {}) }
  if (style.center) {
    delete style.center
    return `\\begin{center} ${formatText(item, style)} \\end{center}`
  } else if (style.right) {
    delete style.right
    return `\\begin{flushright} ${formatText(item, style)} \\end{flushright}`
  } else if (style.bold) {
    delete style.bold
    return `\\textbf{${formatText(item, style)}}`
  } else if (style.small) {
    delete style.small
    return `{\\small ${formatText(item, style)}}`
  } else if (style.kaiti) {
    delete style.kaiti
    return `{\\kaishu ${formatText(item, style)}}`
  }
  var textContent = item.content
  textContent = textContent.replace(/&/g, "\\&")
  textContent = textContent.replace(/%/g, "\\%")
  textContent = textContent.replace(/\$/g, "\\$")
  textContent = textContent.replace(/_/g, "\\_")
  textContent = textContent.replace(/#/g, "\\#")
  return textContent
}

function textStyleStart(style) {
  var result = ""
  if (style.center) result = `${result} \\begin{center}`
  if (style.right) result = `${result} \\begin{flushright}`
  if (style.bold) result = `${result} {\\textbf `
  if (style.small) result = `${result} {\\small `
  if (style.kaiti) result = `${result} {\\kaishu `
  return result
}

function textStyleEnd(style) {
  var result = ""
  if (style.kaiti) result = `${result} }`
  if (style.small) result = `${result} }`
  if (style.bold) result = `${result} }`
  if (style.right) result = `${result} \\end{flushright}`
  if (style.center) result = `${result} \\end{center}`
  return result
}

function item2latex(item) {
  if (item.type == "image") {
    return `\\includepdf{${item.path}}`
  } else if (item.type == "paragraph-start") {
    return textStyleStart(item.style)
  } else if (item.type == "paragraph-end") {
    return textStyleEnd(item.style) + "\n\n"
  } else if (item.type == "normal") {
    return formatText(item)
  } else if (item.type == "chapter") {
    return `\\chapter*{${item.content}}\n\n`
  } else if (item.type == "section") {
    return `\\section*{${item.content}}\n\n`
  } else if (item.type == "subsection") {
    return `\\subsection*{${item.content}}\n\n`
  } else if (item.type == "footnote") {
    return `\\footnote{${item.txt}}`
  } else {
    console.error("unkonw item type:", item)
  }
}

function page2latex(page) {
  return page.map((item) => item2latex(item)).join("") + "\n\\newpage"
}

async function epub2latex(epubpath, outdir) {
  require("fs").rmdirSync(epubroot, { recursive: true })
  require("fs").mkdirSync(epubroot, { recursive: true })
  await unzip(epubpath, epubroot)
  var _path = require("path").join(epubroot, "META-INF", "container.xml")
  const container = require("fs").readFileSync(_path).toString()
  const containerJson = JSON.parse(xmlParser.toJson(container))
  const rootPath = require("path").join(
    epubroot,
    containerJson.container.rootfiles.rootfile["full-path"]
  )
  const rootStr = require("fs").readFileSync(rootPath).toString()
  const rootJson = JSON.parse(xmlParser.toJson(rootStr))
  const pages = await Promise.all(
    rootJson.package.spine.itemref.map(async (item) => {
      const id = item.idref
      const pageItems = rootJson.package.manifest.item.filter((i) => i.id == id)
      if (pageItems.length !== 1)
        throw new Error("no page item found! ${pageItems.length}")
      const result = await formatPage(pageItems[0])
      return result
    })
  )
  const book = {
    src: epubpath,
    pages,
  }
  await pages2Latex(book)
  await latex2PDF(book)
  await renamePDF(book)
  await openPDF(book)
}

async function renamePDF(book) {
  const pdfpath = book.src.slice(0, -4) + "pdf"
  book.pdfpath = pdfpath
  require("fs").renameSync(
    require("path").join(__dirname, "..", "out", "book.pdf"),
    pdfpath
  )
}

async function latex2PDF() {
  return new Promise((resolve) => {
    const { spawn } = require("child_process")
    const child = spawn("sh", ["-c", "cd out && xelatex book.tex"])
    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stdout)
    child.on("close", (code) => {
      resolve(code)
    })
  })
}

function openPDF(book) {
  return new Promise((resolve) => {
    const { spawn } = require("child_process")
    const child = spawn("open", [book.pdfpath])
    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stdout)
    child.on("close", (code) => {
      resolve(code)
    })
  })
}

module.exports = epub2latex

import { GraphQLServer } from "graphql-yoga";
import { createWriteStream } from "fs";
import * as mkdirp from "mkdirp";
import * as shortid from "shortid";
import lowdb = require("lowdb");
import FileSync = require("lowdb/adapters/FileSync");
import * as jsonQuery from "json-query";
import * as fs from "fs";
import * as pdfreader from "pdfreader";

const uploadDir = "./uploads";
const db = lowdb(new FileSync("db.json"));

// Seed an empty DB
db.defaults({ uploads: [] }).write();

// Ensure upload directory exists
mkdirp.sync(uploadDir);

const storeUpload = async ({ stream, filename }): Promise<any> => {
  const id = shortid.generate();
  const path = `${uploadDir}/${id}-${filename}`;

  return new Promise((resolve, reject) =>
    stream
      .pipe(createWriteStream(path))
      .on("finish", () => resolve({ id, path }))
      .on("error", reject)
  );
};

const recordFile = file =>
  db
    .get("uploads")
    .push(file)
    .last()
    .write();

// new pdfreader.PdfReader().parseFileItems(
//   "./uploads/HyPxXoasmTf-Madison Reed-Invoice #41943.pdf",
//   function(err, item) {
//     if (err) callback(err);
//     else if (!item) callback();
//     else if (item.text) console.log(`item.text\n${item.text}`);
//   }
// );

const parsePdf = filePath => {
  // 1 - read the file from disk
  // 2 - save the json data to lowdb
  // 3 -

  let fs = require("fs");
  const PDFParser = require("pdf2json");

  let pdfParser = new PDFParser(this, 1);

  pdfParser.on("pdfParser_dataError", errData =>
    console.error(errData.parserError)
  );
  pdfParser.on("pdfParser_dataReady", pdfData => {
    fs.writeFile("./uploads/Invoice test 3.txt", pdfParser.getRawTextContent()); //
  });
  pdfParser.on("pdfParser_dataReady", pdfData => {
    fs.writeFile("./uploads/Invoice test 3.json", JSON.stringify(pdfData));
  });

  pdfParser.loadPDF(filePath);
};

const miData = parsePdf(
  "./uploads/HyPxXoasmTf-Madison Reed-Invoice #41943.pdf"
);

var jsonFileData = require("./uploads/Invoice test 3.json");

// var data = {
//   people: [
//     { name: "Matt", country: "NZ" },
//     { name: "Pete", country: "AU" },
//     { name: "Mikey", country: "NZ" }
//   ]
// };

// formImage > Pages > Texts
// formImage.Pages.Texts
// "people[country=NZ].name"
// console.log(miData);

const queryForText = jsonQuery("formImage.Pages.Texts", {
  data: jsonFileData
});

const linesArray = jsonFileData.formImage.Pages;

const textsObjMap = linesArray.map((x, index) => {
  return x.Texts;
});
const lineSet = new Set(
  ...textsObjMap.map((x, index) => {
    return x.map(innerArr => {
      return innerArr.y;
    });
  })
);

const lineObj = textsObjMap
  .map((x, index) => {
    return x
      .map((innerArr, i, origX) => {
        let words = "";
        if (
          i == 0 &&
          innerArr.y &&
          innerArr.y == 1.6440000000000001 &&
          innerArr.R["0"].T
        ) {
          // console.log("what is this?");
          // console.log(origX[i].R["0"].T);
          // console.log(origX[i].x);
          // console.log("A little math: first position");
          // console.log(origX[i].x);
          words = words + origX[i].R["0"].T;
        } else if (
          i > 0 &&
          origX[i].x - origX[i - 1].x > 0.5 &&
          innerArr.y &&
          innerArr.R["0"].T
        ) {
          // console.log("what is this?");
          // console.log(origX[i].R["0"].T);
          // console.log(origX[i].x);
          // console.log("A little math: greater than 0.5");
          // console.log(origX[i].x - origX[i - 1].x);
          words = words + "-BREAK-" + origX[i].R["0"].T;
        } else {
          // console.log("what is this?");
          // console.log(origX[i].R["0"].T);
          console.log("A little math: all the others");
          console.log(origX[i].x - origX[i - 1].x);
          // console.log(origX[i].x);
          words = words + origX[i].R["0"].T;
          console.log(words);
        }
        return words;
      })
      .join("");
  })
  .join("");

// const makeSet = new Set(...lineSet);
// console.log(JSON.stringify(linesArray, null, 2));
console.log("lineObj");
console.log(lineObj);
const quickArr = Array.from(lineSet);
console.log(quickArr.length);

// quickArr.forEach(element => {});

// let someText = queryForText.filter();

// console.log(JSON.stringify(queryForText, null, 2));

const callback = err => {
  // throws an error, you could also catch it here
  if (err) throw err;

  // success case, the file was saved
  console.log("Text saved!");
};

fs.writeFile(
  "./uploads/Invoice test 3 - queried.json",
  JSON.stringify(queryForText),
  "utf-8",
  callback
);

// const set1 = new Set();

// console.log(
//   jsonQuery("formImage.Pages.Texts.R.T", {
//     data: miData
//   })
// ); //=> {value: 'Matt', parents: [...], key: 0} ... etc

const processUpload = async upload => {
  const { stream, filename, mimetype, encoding } = await upload;
  const { id, path } = await storeUpload({ stream, filename });
  return recordFile({ id, filename, mimetype, encoding, path });
};

const typeDefs = `
  # this is needed for upload to work
  scalar Upload

  type Query {
    uploads: [File]
  }

  type Mutation {
    singleUpload (file: Upload!): File!
    multipleUpload (files: [Upload!]!): [File!]!
  }

  type File {
    id: ID!
    path: String!
    filename: String!
    mimetype: String!
    encoding: String!
  }
`;

const resolvers = {
  Query: {
    uploads: () => db.get("uploads").value()
  },
  Mutation: {
    singleUpload: (obj, { file }) => processUpload(file),
    multipleUpload: (obj, { files }) => Promise.all(files.map(processUpload))
  }
};
const options = {
  port: 8000,
  endpoint: "/graphql",
  subscriptions: "/subscriptions",
  playground: "/playground"
};

const server = new GraphQLServer({ typeDefs, resolvers });

server.start(options, ({ port }) =>
  console.log(`Server is running on http://localhost:${options.port}`)
);

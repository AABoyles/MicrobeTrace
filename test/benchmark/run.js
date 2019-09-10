const { fork } = require("child_process");
const puppeteer = require("puppeteer");

const process = fork("../../index.js");
let browser, samples;

puppeteer
  .launch()
  .then(b => {
    browser = b;
    [
      100,
      200,
      300,
      400,
      500,
      600,
      700,
      800,
      900,
      1000,
      1200,
      1400,
      1600,
      1800,
      2000,
      2400,
      2800,
      3200
    ].forEach(n => {
      samples = n;
      console.log("Attempting ", samples, " sample sequences.");
      browser
        .newPage()
        .then(page => {
          let messages = [];
          page.on("console", msg => messages.push(msg.text()));
          page
            .goto("http://localhost:5000")
            .then(() => {
              //TODO: Instead of taking a screenshot, load a network
              // page.screenshot({path: n + '.png'})
              //     .then(() => page.close().catch(shutdown))
              //     .catch(shutdown);
              //TODO: Figure out how to determine when the network has loaded
              console.log(n, messages.join("\n"));
            })
            .catch(shutdown);
        })
        .catch(shutdown);
    });
  })
  .catch(shutdown);

function shutdown(err) {
  console.log("aborted while attempting ", samples, " sample sequences.");
  browser.close().catch(err2 => console.error(err2));
  process.kill();
  if (err) console.error(err);
}

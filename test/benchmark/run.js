const { fork } = require("child_process");
const { chromium } = require("playwright");

const process = fork("../../index.js");
let browser, samples;

const SAMPLE_SIZES = [
  100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
  1200, 1400, 1600, 1800, 2000, 2400, 2800, 3200,
];

chromium
  .launch()
  .then(b => {
    browser = b;
    SAMPLE_SIZES.forEach(n => {
      samples = n;
      console.log("Attempting ", samples, " sample sequences.");
      browser
        .newContext()
        .then(async context => {
          const page = await context.newPage();
          const messages = [];
          page.on("console", msg => messages.push(msg.text()));
          try {
            await page.goto("http://localhost:5000");
            // TODO: Instead of taking a screenshot, load a network
            // await page.screenshot({ path: n + '.png' });
            // TODO: Figure out how to determine when the network has loaded
            console.log(n, messages.join("\n"));
          } catch (err) {
            shutdown(err);
          } finally {
            await page.close().catch(() => {});
            await context.close().catch(() => {});
          }
        })
        .catch(shutdown);
    });
  })
  .catch(shutdown);

function shutdown(err) {
  console.log("aborted while attempting ", samples, " sample sequences.");
  if (browser) browser.close().catch(e => console.error(e));
  process.kill();
  if (err) console.error(err);
}
